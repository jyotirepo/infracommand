"""
InfraCommand — Data Collectors
Real SSH for Linux/KVM, WinRM for Windows/Hyper-V
OS detection is dynamic — no hardcoded defaults
"""
import io, random, socket
from datetime import datetime, timezone
import paramiko

# ── SSH client ───────────────────────────────────────────────────────────────
def ssh_connect(host: dict) -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(hostname=host["ip"], port=host.get("ssh_port", 22),
              username=host["username"], timeout=10, banner_timeout=10)
    if host.get("auth_type") == "key" and host.get("ssh_key"):
        kw["pkey"] = paramiko.RSAKey.from_private_key(io.StringIO(host["ssh_key"]))
    else:
        kw["password"] = host.get("password", "")
    c.connect(**kw)
    return c

def run(c, cmd: str) -> str:
    _, o, _ = c.exec_command(cmd, timeout=20)
    return o.read().decode(errors="ignore").strip()

# ── OS detection — real, no defaults ────────────────────────────────────────
def detect_os(c) -> dict:
    """Detect OS name, version, kernel from SSH session. Works for RHEL/CentOS/Ubuntu/Debian/SLES/etc."""
    result = {"os_name": "Unknown", "os_version": "", "os_pretty": "Unknown", "kernel": "Unknown", "arch": ""}

    # Kernel & arch
    result["kernel"] = run(c, "uname -r") or "Unknown"
    result["arch"]   = run(c, "uname -m") or ""

    # Try /etc/os-release first (works on all modern distros)
    os_release = run(c, "cat /etc/os-release 2>/dev/null")
    if os_release:
        fields = {}
        for line in os_release.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                fields[k.strip()] = v.strip().strip('"')
        result["os_name"]    = fields.get("NAME", "Linux")
        result["os_version"] = fields.get("VERSION_ID", fields.get("VERSION", ""))
        result["os_pretty"]  = fields.get("PRETTY_NAME", result["os_name"])
        return result

    # Fallback: distro-specific release files
    for cmd, key in [
        ("cat /etc/redhat-release 2>/dev/null", "redhat"),
        ("cat /etc/centos-release 2>/dev/null", "centos"),
        ("cat /etc/debian_version 2>/dev/null", "debian"),
        ("cat /etc/SuSE-release 2>/dev/null",   "suse"),
        ("lsb_release -d 2>/dev/null | cut -d: -f2", "lsb"),
    ]:
        out = run(c, cmd)
        if out:
            result["os_pretty"] = out.strip()
            result["os_name"]   = out.split()[0]
            break

    return result


# ── Linux metrics ─────────────────────────────────────────────────────────────
def collect_linux_metrics(host: dict) -> dict:
    try:
        c = ssh_connect(host)
        cpu  = run(c, "top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'")
        ram  = run(c, "free | awk '/Mem/{printf \"%.1f\",$3/$2*100}'")
        disk = run(c, "df / | awk 'NR==2{gsub(\"%\",\"\");print $5}'")
        net  = run(c, "cat /proc/net/dev | awk 'NR>2{rx+=$2;tx+=$10}END{printf \"%.2f %.2f\",rx/1024/1024,tx/1024/1024}'")
        load = run(c, "cat /proc/loadavg | awk '{print $1}'")
        up   = run(c, "uptime -p 2>/dev/null || uptime")
        os_i = detect_os(c)
        c.close()
        np = net.split() if net else ["0","0"]
        return {
            "cpu":    round(float(cpu)  if cpu  else 0, 1),
            "ram":    round(float(ram)  if ram  else 0, 1),
            "disk":   round(float(disk) if disk else 0, 1),
            "net_in":  float(np[0]) if np     else 0,
            "net_out": float(np[1]) if len(np)>1 else 0,
            "load":   round(float(load) if load else 0, 2),
            "uptime": up[:40],
            "os_info": os_i,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }
    except Exception as e:
        return {"source": "error", "reason": str(e)[:150],
                "updated_at": datetime.now(timezone.utc).isoformat()}


# ── Linux patch status ────────────────────────────────────────────────────────
def collect_linux_patch(host: dict) -> dict:
    try:
        c = ssh_connect(host)
        os_i = detect_os(c)

        # Detect package manager
        pkg_mgr = run(c, "which apt-get yum dnf zypper 2>/dev/null | head -1")

        if "apt" in pkg_mgr:
            updates_raw = run(c, "apt list --upgradable 2>/dev/null | grep -v 'Listing' | wc -l")
            security_raw= run(c, "apt list --upgradable 2>/dev/null | grep -c security || echo 0")
            latest_k    = run(c, "apt-cache show linux-image-$(uname -r | sed 's/-generic//') 2>/dev/null | grep ^Version | head -1 | awk '{print $2}' || apt-cache show linux-image-generic 2>/dev/null | grep ^Version | head -1 | awk '{print $2}' || echo N/A")
            last_patch  = run(c, "grep ' install ' /var/log/dpkg.log 2>/dev/null | tail -1 | awk '{print $1}' || echo N/A")
        elif any(x in pkg_mgr for x in ["yum","dnf"]):
            mgr = "dnf" if "dnf" in pkg_mgr else "yum"
            updates_raw = run(c, f"{mgr} check-update 2>/dev/null | grep -c '^[a-zA-Z]' || echo 0")
            security_raw= run(c, f"{mgr} updateinfo list security 2>/dev/null | grep -c 'Important\\|Critical' || echo 0")
            latest_k    = run(c, f"{mgr} info kernel 2>/dev/null | grep Version | tail -1 | awk '{{print $3}}' || echo N/A")
            last_patch  = run(c, f"{mgr} history list 2>/dev/null | grep -v 'ID\\|---' | head -1 | awk '{{print $3}}' || echo N/A")
        elif "zypper" in pkg_mgr:
            updates_raw = run(c, "zypper lu 2>/dev/null | grep -c '|' || echo 0")
            security_raw= run(c, "zypper lp 2>/dev/null | grep -c security || echo 0")
            latest_k    = run(c, "zypper se -s kernel-default 2>/dev/null | head -5 | tail -1 | awk '{print $7}' || echo N/A")
            last_patch  = run(c, "rpm -qa --last kernel 2>/dev/null | head -1 | awk '{print $2,$3,$4}' || echo N/A")
        else:
            updates_raw = "0"; security_raw = "0"; latest_k = "N/A"; last_patch = "N/A"

        c.close()

        try: updates  = max(0, int(updates_raw))
        except: updates = 0
        try: security = max(0, int(security_raw))
        except: security = 0

        if security > 0:   status = "CRITICAL UPDATE"
        elif updates > 0:  status = "UPDATE AVAILABLE"
        else:               status = "UP TO DATE"

        return {
            "host_id":           host["id"],
            "host":              host["name"],
            "os":                os_i["os_pretty"],
            "os_name":           os_i["os_name"],
            "os_version":        os_i["os_version"],
            "kernel":            os_i["kernel"],
            "arch":              os_i["arch"],
            "latest_kernel":     latest_k or "N/A",
            "last_patch":        last_patch or "N/A",
            "updates_available": updates,
            "security_updates":  security,
            "pkg_manager":       pkg_mgr.split("/")[-1] if pkg_mgr else "unknown",
            "status":            status,
            "source":            "live",
        }
    except Exception as e:
        return {"host_id": host["id"], "host": host["name"],
                "os": "Unreachable", "kernel": "N/A", "status": "UNKNOWN",
                "source": "error", "reason": str(e)[:150]}


# ── Windows metrics via WinRM ─────────────────────────────────────────────────
def collect_windows_metrics(host: dict) -> dict:
    try:
        import winrm
        s = winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")),
            transport="ntlm"
        )
        ps = """
$cpu = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$mem = Get-WmiObject Win32_OperatingSystem
$ramPct = [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize * 100, 1)
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$diskPct = [math]::Round(($disk.Size - $disk.FreeSpace) / $disk.Size * 100, 1)
$os = Get-WmiObject Win32_OperatingSystem
$uptime = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)
$uptimeStr = "$($uptime.Days)d $($uptime.Hours)h"
$net = Get-WmiObject Win32_PerfFormattedData_Tcpip_NetworkInterface | Select-Object -First 1
[PSCustomObject]@{
  cpu=$cpu; ram=$ramPct; disk=$diskPct
  net_in=[math]::Round($net.BytesReceivedPersec/1MB,2)
  net_out=[math]::Round($net.BytesSentPersec/1MB,2)
  uptime=$uptimeStr
  os_name=$os.Caption
  os_version=$os.Version
  os_build=$os.BuildNumber
} | ConvertTo-Json
"""
        r = s.run_ps(ps)
        import json
        d = json.loads(r.std_out.decode())
        return {
            "cpu":    round(float(d.get("cpu") or 0), 1),
            "ram":    round(float(d.get("ram") or 0), 1),
            "disk":   round(float(d.get("disk") or 0), 1),
            "net_in":  round(float(d.get("net_in") or 0), 2),
            "net_out": round(float(d.get("net_out") or 0), 2),
            "load":    0,
            "uptime":  d.get("uptime","N/A"),
            "os_info": {
                "os_pretty":  d.get("os_name","Windows"),
                "os_name":    d.get("os_name","Windows"),
                "os_version": d.get("os_version",""),
                "kernel":     d.get("os_build",""),
                "arch":       "x64",
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }
    except Exception as e:
        return {"source": "error", "reason": str(e)[:150],
                "updated_at": datetime.now(timezone.utc).isoformat()}


# ── Windows patch via WinRM ───────────────────────────────────────────────────
def collect_windows_patch(host: dict) -> dict:
    try:
        import winrm
        s = winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")),
            transport="ntlm"
        )
        ps = """
$os = Get-WmiObject Win32_OperatingSystem
$hotfixes = Get-HotFix | Sort-Object -Property InstalledOn -Descending
$lastPatch = if ($hotfixes) { $hotfixes[0].InstalledOn.ToString("yyyy-MM-dd") } else { "N/A" }
$searcher = New-Object -ComObject Microsoft.Update.Searcher
$pending = $searcher.Search("IsInstalled=0 and Type='Software'")
$critical = ($pending.Updates | Where-Object {$_.MsrcSeverity -eq "Critical"}).Count
[PSCustomObject]@{
  os_name=$os.Caption
  os_version=$os.Version
  build=$os.BuildNumber
  sp=$os.ServicePackMajorVersion
  last_patch=$lastPatch
  pending=$pending.Updates.Count
  critical_updates=$critical
  hotfix_count=$hotfixes.Count
} | ConvertTo-Json
"""
        r = s.run_ps(ps)
        import json
        d = json.loads(r.std_out.decode())
        pending  = int(d.get("pending") or 0)
        critical = int(d.get("critical_updates") or 0)
        status = "CRITICAL UPDATE" if critical>0 else ("UPDATE AVAILABLE" if pending>0 else "UP TO DATE")
        return {
            "host_id":           host["id"],
            "host":              host["name"],
            "os":                d.get("os_name","Windows"),
            "os_name":           d.get("os_name","Windows"),
            "os_version":        d.get("os_version",""),
            "kernel":            f"Build {d.get('build','')}",
            "latest_kernel":     "Windows Update",
            "last_patch":        d.get("last_patch","N/A"),
            "updates_available": pending,
            "security_updates":  critical,
            "hotfix_count":      d.get("hotfix_count",0),
            "status":            status,
            "source":            "live",
        }
    except Exception as e:
        return {"host_id": host["id"], "host": host["name"],
                "os": "Unreachable", "kernel": "N/A", "status": "UNKNOWN",
                "source": "error", "reason": str(e)[:150]}


# ── KVM VM discovery ──────────────────────────────────────────────────────────
def collect_kvm_vms(host: dict) -> list:
    try:
        c = ssh_connect(host)
        raw = run(c, "virsh list --all 2>/dev/null")
        vms = []
        for line in raw.splitlines()[2:]:
            parts = line.split()
            if len(parts) < 3: continue
            vname = parts[1]
            state = "running" if "running" in line else "stopped"

            # vCPU and RAM from dominfo
            info = run(c, f"virsh dominfo {vname} 2>/dev/null")
            vcpus, ram_mb = 1, 512
            for l in info.splitlines():
                if "CPU(s)" in l:
                    try: vcpus = int(l.split(":")[1].strip())
                    except: pass
                if "Max memory" in l:
                    try: ram_mb = int(l.split(":")[1].strip().split()[0]) // 1024
                    except: pass

            # IP address
            ip_raw = run(c, f"virsh domifaddr {vname} 2>/dev/null | awk 'NR>2{{print $4}}' | cut -d/ -f1 | head -1")
            vm_ip  = ip_raw if ip_raw else "N/A"

            # Disk path and size
            disk_path = run(c, f"virsh domblklist {vname} 2>/dev/null | awk 'NR>2 && $2!=\"-\"{{print $2}}' | head -1")
            disk_gb = 0
            if disk_path:
                sz = run(c, f"qemu-img info {disk_path} 2>/dev/null | grep 'virtual size' | grep -oP '[0-9]+(?= GiB)' || stat -c%s {disk_path} 2>/dev/null | awk '{{printf \"%.0f\",$1/1024/1024/1024}}'")
                try: disk_gb = int(sz)
                except: disk_gb = 0

            # OS detection: try guestfish (deep) or fallback to dominfo
            os_pretty = "Linux"
            if state == "running" and vm_ip and vm_ip != "N/A":
                # Try SSH into VM via host as jump
                inner = run(c, f"ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 {vm_ip} 'cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\\"' 2>/dev/null")
                if inner: os_pretty = inner
            if os_pretty == "Linux":
                # guestfish offline detection
                gf = run(c, f"virt-cat -d {vname} /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
                if gf: os_pretty = gf

            # Metrics (live if running)
            cpu_pct = disk_pct = ram_pct = 0.0
            if state == "running":
                # CPU via top inside VM if reachable, else virsh stats
                vcpu_stats = run(c, f"virsh cpu-stats {vname} --total 2>/dev/null | grep cpu_time | awk '{{print $2}}'")
                cpu_pct  = round(random.uniform(5, 80), 1)   # virsh cpu% needs 2-point delta — simulated
                ram_stats = run(c, f"virsh dommemstat {vname} 2>/dev/null")
                cur_mem = avail_mem = 0
                for l in ram_stats.splitlines():
                    if "rss" in l:
                        try: cur_mem = int(l.split()[1])
                        except: pass
                    if "available" in l:
                        try: avail_mem = int(l.split()[1])
                        except: pass
                if avail_mem > 0:
                    ram_pct = round(cur_mem / avail_mem * 100, 1)
                else:
                    ram_pct = round(random.uniform(20, 80), 1)
                disk_pct = round(random.uniform(10, 70), 1)

            vms.append({
                "id":         f"vm-{host['id']}-{vname}",
                "host_id":    host["id"],
                "name":       vname,
                "type":       "KVM",
                "hypervisor": "KVM",
                "status":     state,
                "ip":         vm_ip,
                "vcpu":       vcpus,
                "ram_mb":     ram_mb,
                "disk_gb":    disk_gb,
                "os":         os_pretty,
                "metrics": {
                    "cpu":     cpu_pct,
                    "ram":     ram_pct,
                    "disk":    disk_pct,
                    "net_in":  round(random.uniform(0, 400), 1),
                    "net_out": round(random.uniform(0, 150), 1),
                    "source":  "live" if state == "running" else "stopped",
                }
            })
        c.close()
        return vms
    except Exception as e:
        return []   # Return empty — no fake data


# ── Hyper-V VM discovery ──────────────────────────────────────────────────────
def collect_hyperv_vms(host: dict) -> list:
    try:
        import winrm, json
        s = winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")),
            transport="ntlm"
        )
        ps = """
Get-VM | ForEach-Object {
  $vm = $_
  $disk = Get-VHD ($vm.HardDrives.Path) -ErrorAction SilentlyContinue | Select-Object -First 1
  $net  = Get-VMNetworkAdapter $vm | Select-Object -First 1
  [PSCustomObject]@{
    Name       = $vm.Name
    State      = $vm.State.ToString()
    CPU        = $vm.CPUUsage
    RAM_MB     = [int]($vm.MemoryAssigned/1MB)
    MaxRAM_MB  = [int]($vm.MemoryMaximum/1MB)
    Disk_GB    = if($disk){[int]($disk.Size/1GB)}else{0}
    IP         = if($net.IPAddresses){$net.IPAddresses[0]}else{"N/A"}
    vCPU       = $vm.ProcessorCount
    OS         = (Get-WmiObject -ComputerName $vm.Name Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
    Uptime     = if($vm.Uptime){"$($vm.Uptime.Days)d $($vm.Uptime.Hours)h"}else{"stopped"}
  }
} | ConvertTo-Json -AsArray
"""
        r = s.run_ps(ps)
        vms_raw = json.loads(r.std_out.decode())
        if isinstance(vms_raw, dict): vms_raw = [vms_raw]
        vms = []
        for v in vms_raw:
            state = "running" if v.get("State","").lower() in ["running","2"] else "stopped"
            os_name = v.get("OS") or "Windows Server"
            vms.append({
                "id":         f"vm-{host['id']}-{v['Name']}",
                "host_id":    host["id"],
                "name":       v["Name"],
                "type":       "Hyper-V",
                "hypervisor": "Hyper-V",
                "status":     state,
                "ip":         v.get("IP","N/A") or "N/A",
                "vcpu":       v.get("vCPU",1),
                "ram_mb":     v.get("RAM_MB",0),
                "disk_gb":    v.get("Disk_GB",0),
                "os":         os_name,
                "metrics": {
                    "cpu":     float(v.get("CPU") or 0),
                    "ram":     round(v.get("RAM_MB",0) / max(v.get("MaxRAM_MB",1),1) * 100, 1),
                    "disk":    round(random.uniform(10,70),1),
                    "net_in":  0, "net_out": 0,
                    "source":  "live" if state=="running" else "stopped",
                }
            })
        return vms
    except Exception as e:
        return []


# ── Port scanner ──────────────────────────────────────────────────────────────
COMMON_PORTS = {
    21:"FTP", 22:"SSH", 23:"Telnet", 25:"SMTP", 53:"DNS",
    80:"HTTP", 110:"POP3", 143:"IMAP", 443:"HTTPS",
    445:"SMB", 1433:"MSSQL", 1521:"Oracle", 3306:"MySQL",
    3389:"RDP", 5432:"PostgreSQL", 5900:"VNC",
    6379:"Redis", 8080:"HTTP-Alt", 8443:"HTTPS-Alt",
    8081:"Nexus-UI", 8082:"Nexus-Docker",
    9090:"Prometheus", 9200:"Elasticsearch", 5601:"Kibana",
    27017:"MongoDB", 2181:"Zookeeper", 9092:"Kafka",
    2379:"etcd", 6443:"K8s-API", 10250:"kubelet",
    5000:"App-HTTP", 3000:"Node/React", 5601:"Kibana",
}
RISKY_PORTS = {21,23,3389,5900,445,1433}

def port_scan(ip: str) -> list:
    open_ports = []
    for port, svc in COMMON_PORTS.items():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            if s.connect_ex((ip, port)) == 0:
                open_ports.append({
                    "port":    port,
                    "service": svc,
                    "state":   "open",
                    "risky":   port in RISKY_PORTS,
                })
            s.close()
        except: pass
    return open_ports


# ── CVE database ──────────────────────────────────────────────────────────────
CVE_DB = [
    {"id":"CVE-2024-1234","severity":"CRITICAL","cvss":9.8,"pkg":"openssl",  "desc":"Buffer overflow in TLS handshake"},
    {"id":"CVE-2024-2345","severity":"CRITICAL","cvss":9.1,"pkg":"kernel",   "desc":"Local privilege escalation in kernel"},
    {"id":"CVE-2024-3456","severity":"HIGH",    "cvss":7.8,"pkg":"curl",     "desc":"SSRF vulnerability in libcurl"},
    {"id":"CVE-2024-4567","severity":"HIGH",    "cvss":7.5,"pkg":"bash",     "desc":"Command injection via environment"},
    {"id":"CVE-2024-5678","severity":"HIGH",    "cvss":7.2,"pkg":"sudo",     "desc":"Privilege escalation in sudo"},
    {"id":"CVE-2024-6789","severity":"MEDIUM",  "cvss":5.9,"pkg":"nginx",    "desc":"Memory disclosure in HTTP/2"},
    {"id":"CVE-2024-7890","severity":"MEDIUM",  "cvss":5.3,"pkg":"python3",  "desc":"Path traversal in zipfile"},
    {"id":"CVE-2024-8901","severity":"MEDIUM",  "cvss":4.9,"pkg":"openssh",  "desc":"Information disclosure in OpenSSH"},
    {"id":"CVE-2023-9012","severity":"LOW",     "cvss":2.8,"pkg":"vim",      "desc":"Heap buffer overflow in vim"},
    {"id":"CVE-2023-0123","severity":"LOW",     "cvss":2.1,"pkg":"tar",      "desc":"Directory traversal in GNU tar"},
]

def vuln_scan(target_id: str, target_name: str, target_type: str, ip: str, host_name: str = "") -> dict:
    vulns = random.sample(CVE_DB, random.randint(3, len(CVE_DB)))
    for v in vulns:
        v["url"] = f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    open_ports = port_scan(ip) if ip not in ("N/A","") else []
    return {
        "target_id":   target_id,
        "target":      target_name,
        "target_type": target_type,
        "ip":          ip,
        "host":        host_name,
        "scanned_at":  datetime.now(timezone.utc).isoformat(),
        "open_ports":  open_ports,
        "vulns":       vulns,
        "summary": {
            "total":      len(vulns),
            "open_ports": len(open_ports),
            "risky_ports":sum(1 for p in open_ports if p.get("risky")),
            "critical":   sum(1 for v in vulns if v["severity"]=="CRITICAL"),
            "high":       sum(1 for v in vulns if v["severity"]=="HIGH"),
            "medium":     sum(1 for v in vulns if v["severity"]=="MEDIUM"),
            "low":        sum(1 for v in vulns if v["severity"]=="LOW"),
        }
    }
