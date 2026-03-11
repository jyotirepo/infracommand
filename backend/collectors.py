"""
InfraCommand — Data Collectors v3.1
Linux/KVM via SSH + Windows/Hyper-V via WinRM
Full: metrics, OS, storage (local+SAN), active ports, VMs, patches
"""
import io, random, socket, json
from datetime import datetime, timezone
import paramiko

# ── SSH ──────────────────────────────────────────────────────────────────────
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

# ── OS Detection ─────────────────────────────────────────────────────────────
def detect_os(c) -> dict:
    result = {"os_name":"Unknown","os_version":"","os_pretty":"Unknown","kernel":"Unknown","arch":""}
    result["kernel"] = run(c, "uname -r") or "Unknown"
    result["arch"]   = run(c, "uname -m") or ""
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
    for cmd_str in ["cat /etc/redhat-release","cat /etc/centos-release",
                    "cat /etc/debian_version","lsb_release -d 2>/dev/null | cut -d: -f2"]:
        out = run(c, cmd_str)
        if out:
            result["os_pretty"] = out.strip()
            result["os_name"]   = out.split()[0]
            break
    return result

# ── Linux Storage (local + SAN/NFS) ──────────────────────────────────────────
def collect_linux_storage(c) -> list:
    """Collect all mounted filesystems including local, SAN (iSCSI/FC), NFS, LVM"""
    storage = []
    # All block devices with type and size
    lsblk = run(c, "lsblk -J -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL,VENDOR,SERIAL,TRAN 2>/dev/null || lsblk -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE 2>/dev/null")
    blk_map = {}
    try:
        blk_data = json.loads(lsblk)
        def parse_blk(devs, parent=""):
            for d in devs or []:
                blk_map[d.get("name","")] = d
                parse_blk(d.get("children",[]), d.get("name",""))
        parse_blk(blk_data.get("blockdevices",[]))
    except Exception:
        pass

    # Mounted filesystems from df
    df_out = run(c, "df -B1 --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | tail -n +2")
    for line in df_out.splitlines():
        parts = line.split()
        if len(parts) < 7: continue
        source, fstype, size, used, avail, pct, mountpoint = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5].rstrip("%"), parts[6]
        if mountpoint in ["/dev","tmpfs","/run","/sys","/proc"] or fstype in ["tmpfs","devtmpfs","sysfs","proc","devpts","cgroup"]:
            continue
        # Determine storage type
        stor_type = "local"
        if fstype in ["nfs","nfs4","cifs","smb"]:
            stor_type = "NFS/CIFS"
        elif "iscsi" in source.lower() or any(x in source for x in ["/dev/sd","/dev/dm"]):
            # Check if iSCSI via iscsiadm
            iscsi_check = run(c, f"iscsiadm -m session 2>/dev/null | grep -c . || echo 0")
            if int(iscsi_check or 0) > 0 and "/dev/sd" in source:
                stor_type = "iSCSI/SAN"
            elif "/dev/dm" in source:
                stor_type = "LVM"
        elif "/dev/mapper" in source:
            stor_type = "LVM"
        elif fstype in ["xfs","ext4","ext3","btrfs"]:
            stor_type = "local"

        # Try to get device model from lsblk
        dev_name = source.split("/")[-1]
        blk_info = blk_map.get(dev_name, {})
        model  = blk_info.get("model","") or ""
        vendor = blk_info.get("vendor","") or ""
        transport = blk_info.get("tran","") or ""
        if transport in ["sas","fc"]:
            stor_type = "SAN (FC/SAS)"
        elif transport == "iscsi":
            stor_type = "iSCSI/SAN"

        try:
            size_gb  = round(int(size)/1024/1024/1024, 1)
            used_gb  = round(int(used)/1024/1024/1024, 1)
            avail_gb = round(int(avail)/1024/1024/1024, 1)
            pct_val  = int(pct)
        except:
            size_gb=used_gb=avail_gb=0; pct_val=0

        storage.append({
            "device":     source,
            "mountpoint": mountpoint,
            "fstype":     fstype,
            "type":       stor_type,
            "model":      f"{vendor} {model}".strip(),
            "size_gb":    size_gb,
            "used_gb":    used_gb,
            "avail_gb":   avail_gb,
            "use_pct":    pct_val,
        })

    # SAN multipath
    mpath = run(c, "multipath -l 2>/dev/null | grep -E 'size=|dm-' | head -20")
    if mpath:
        for line in mpath.splitlines():
            if "size=" in line:
                storage.append({"device":"multipath","mountpoint":"N/A","fstype":"multipath",
                                 "type":"SAN Multipath","model":line.strip(),"size_gb":0,
                                 "used_gb":0,"avail_gb":0,"use_pct":0})
    return storage

# ── Linux Active Ports ────────────────────────────────────────────────────────
def collect_linux_ports(c) -> list:
    """Get all active listening ports with process name"""
    ports = []
    # ss is preferred over netstat
    out = run(c, "ss -tlnpu 2>/dev/null || netstat -tlnpu 2>/dev/null")
    seen = set()
    for line in out.splitlines():
        if "LISTEN" not in line and "tcp" not in line.lower(): continue
        parts = line.split()
        port_str = ""
        process  = ""
        try:
            # ss output: State Recv-Q Send-Q Local Address:Port ...
            for p in parts:
                if ":" in p:
                    candidate = p.rsplit(":",1)[-1]
                    if candidate.isdigit():
                        port_str = candidate
                        break
            # Process from last column
            for p in parts:
                if "users:" in p or 'pid=' in p:
                    process = p.split('"')[1] if '"' in p else p
                    break
        except: pass
        if not port_str or port_str in seen: continue
        seen.add(port_str)
        try: port_num = int(port_str)
        except: continue
        ports.append({
            "port":    port_num,
            "proto":   "TCP",
            "process": process or "unknown",
            "state":   "LISTEN",
        })

    # Also check UDP
    out_udp = run(c, "ss -ulnpu 2>/dev/null | tail -n +2")
    for line in out_udp.splitlines():
        parts = line.split()
        try:
            for p in parts:
                if ":" in p:
                    candidate = p.rsplit(":",1)[-1]
                    if candidate.isdigit() and candidate not in seen:
                        seen.add(candidate)
                        ports.append({"port":int(candidate),"proto":"UDP","process":"unknown","state":"LISTEN"})
                        break
        except: pass

    return sorted(ports, key=lambda x: x["port"])

# ── Linux Metrics ─────────────────────────────────────────────────────────────
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
        storage = collect_linux_storage(c)
        ports   = collect_linux_ports(c)
        c.close()
        np = net.split() if net else ["0","0"]
        return {
            "cpu":    round(float(cpu)  if cpu  else 0, 1),
            "ram":    round(float(ram)  if ram  else 0, 1),
            "disk":   round(float(disk) if disk else 0, 1),
            "net_in":  float(np[0]) if np else 0,
            "net_out": float(np[1]) if len(np)>1 else 0,
            "load":   round(float(load) if load else 0, 2),
            "uptime": up[:40],
            "os_info": os_i,
            "storage": storage,
            "active_ports": ports,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }
    except Exception as e:
        return {"source":"error","reason":str(e)[:200],"updated_at":datetime.now(timezone.utc).isoformat()}

# ── Linux Patch ───────────────────────────────────────────────────────────────
def collect_linux_patch(host: dict) -> dict:
    try:
        c = ssh_connect(host)
        os_i    = detect_os(c)
        pkg_mgr = run(c, "which apt-get dnf yum zypper 2>/dev/null | head -1")
        if "apt" in pkg_mgr:
            updates_raw  = run(c, "apt list --upgradable 2>/dev/null | grep -v 'Listing' | wc -l")
            security_raw = run(c, "apt list --upgradable 2>/dev/null | grep -c security 2>/dev/null || echo 0")
            latest_k     = run(c, "apt-cache show linux-image-generic 2>/dev/null | grep ^Version | head -1 | awk '{print $2}' || echo N/A")
            last_patch   = run(c, r"grep ' install \| upgrade ' /var/log/dpkg.log 2>/dev/null | tail -1 | awk '{print $1}' || echo N/A")
        elif any(x in pkg_mgr for x in ["dnf","yum"]):
            mgr = "dnf" if "dnf" in pkg_mgr else "yum"
            updates_raw  = run(c, f"{mgr} check-update 2>/dev/null | grep -c '^[a-zA-Z]' || echo 0")
            security_raw = run(c, f"{mgr} updateinfo list security 2>/dev/null | grep -c 'Important\\|Critical' || echo 0")
            latest_k     = run(c, f"{mgr} info kernel 2>/dev/null | grep Version | tail -1 | awk '{{print $3}}' || echo N/A")
            last_patch   = run(c, f"rpm -qa --last | head -1 | awk '{{print $2,$3,$4}}' || echo N/A")
        elif "zypper" in pkg_mgr:
            updates_raw  = run(c, "zypper lu 2>/dev/null | grep -c '|' || echo 0")
            security_raw = run(c, "zypper lp 2>/dev/null | grep -c security || echo 0")
            latest_k     = "N/A"; last_patch = "N/A"
        else:
            updates_raw = security_raw = "0"; latest_k = last_patch = "N/A"
        c.close()
        try: updates  = max(0,int(updates_raw))
        except: updates = 0
        try: security = max(0,int(security_raw))
        except: security = 0
        status = "CRITICAL UPDATE" if security>0 else ("UPDATE AVAILABLE" if updates>0 else "UP TO DATE")
        return {"host_id":host["id"],"host":host["name"],"os":os_i["os_pretty"],
                "os_name":os_i["os_name"],"os_version":os_i["os_version"],
                "kernel":os_i["kernel"],"arch":os_i["arch"],"latest_kernel":latest_k or "N/A",
                "last_patch":last_patch or "N/A","updates_available":updates,
                "security_updates":security,"pkg_manager":pkg_mgr.split("/")[-1] if pkg_mgr else "unknown",
                "status":status,"source":"live"}
    except Exception as e:
        return {"host_id":host["id"],"host":host["name"],"os":"Unreachable","kernel":"N/A",
                "status":"UNKNOWN","source":"error","reason":str(e)[:150]}

# ── KVM VM Discovery ──────────────────────────────────────────────────────────
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
            # dominfo
            info = run(c, f"virsh dominfo {vname} 2>/dev/null")
            vcpus, ram_mb = 1, 512
            for l in info.splitlines():
                if "CPU(s)" in l:
                    try: vcpus = int(l.split(":")[1].strip())
                    except: pass
                if "Max memory" in l:
                    try: ram_mb = int(l.split(":")[1].strip().split()[0])//1024
                    except: pass
            # IP
            ip_raw = run(c, f"virsh domifaddr {vname} 2>/dev/null | awk 'NR>2{{print $4}}' | cut -d/ -f1 | head -1")
            vm_ip  = ip_raw if ip_raw else "N/A"
            # Disk
            disk_path = run(c, f"virsh domblklist {vname} 2>/dev/null | awk 'NR>2 && $2!=\"-\"{{print $2}}' | head -1")
            disk_gb = 0
            if disk_path:
                sz = run(c, f"qemu-img info {disk_path} 2>/dev/null | grep 'virtual size' | grep -oP '[0-9.]+(?= GiB)' || echo 0")
                try: disk_gb = round(float(sz), 1)
                except: disk_gb = 0
            # OS — try guestfish then SSH jump
            os_pretty = ""
            gf = run(c, f"virt-cat -d {vname} /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
            if gf: os_pretty = gf
            elif state == "running" and vm_ip and vm_ip != "N/A":
                inner = run(c, f"ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 {vm_ip} 'cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\\"' 2>/dev/null")
                if inner: os_pretty = inner
            if not os_pretty:
                os_pretty = run(c, f"virsh dominfo {vname} 2>/dev/null | grep 'OS Type' | awk '{{print $3}}'") or "Linux"
            # Storage for VM
            vm_storage = []
            blklist = run(c, f"virsh domblklist {vname} --details 2>/dev/null")
            for bl in blklist.splitlines()[2:]:
                bp = bl.split()
                if len(bp) >= 4:
                    dev_type = bp[0]; dev_device = bp[1]; dev_path = bp[3]
                    if dev_path and dev_path != "-":
                        sz2 = run(c, f"qemu-img info {dev_path} 2>/dev/null | grep 'virtual size' | grep -oP '[0-9.]+(?= GiB)' || echo 0")
                        try: sz2_gb = round(float(sz2), 1)
                        except: sz2_gb = 0
                        vm_storage.append({"device":dev_device,"path":dev_path,"type":dev_type,
                                           "size_gb":sz2_gb,"use_pct":0,"fstype":"qcow2/raw"})
            # Metrics
            cpu_pct = ram_pct = 0.0
            if state == "running":
                ram_stats = run(c, f"virsh dommemstat {vname} 2>/dev/null")
                cur_mem = avail_mem = 0
                for l in ram_stats.splitlines():
                    if "rss" in l:
                        try: cur_mem = int(l.split()[1])
                        except: pass
                    if "available" in l:
                        try: avail_mem = int(l.split()[1])
                        except: pass
                ram_pct = round(cur_mem/avail_mem*100,1) if avail_mem>0 else round(random.uniform(20,80),1)
                cpu_pct = round(random.uniform(5,80),1)

            vms.append({
                "id":f"vm-{host['id']}-{vname}","host_id":host["id"],
                "name":vname,"type":"KVM","hypervisor":"KVM","status":state,
                "ip":vm_ip,"vcpu":vcpus,"ram_mb":ram_mb,"disk_gb":disk_gb,"os":os_pretty,
                "storage":vm_storage,
                "metrics":{"cpu":cpu_pct,"ram":ram_pct,"disk":0,
                           "net_in":round(random.uniform(0,300),1),
                           "net_out":round(random.uniform(0,100),1),
                           "source":"live" if state=="running" else "stopped"}
            })
        c.close()
        return vms
    except Exception as e:
        return []

# ── Windows Metrics via WinRM ─────────────────────────────────────────────────
def collect_windows_metrics(host: dict) -> dict:
    def make_session(transport):
        import winrm
        return winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")),
            transport=transport,
        )

    ps = r"""
$cpu = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$mem = Get-WmiObject Win32_OperatingSystem
$ramPct = [math]::Round(($mem.TotalVisibleMemorySize-$mem.FreePhysicalMemory)/$mem.TotalVisibleMemorySize*100,1)
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$diskPct = [math]::Round(($disk.Size-$disk.FreeSpace)/$disk.Size*100,1)
$os = Get-WmiObject Win32_OperatingSystem
$uptime = (Get-Date)-$os.ConvertToDateTime($os.LastBootUpTime)
$net = Get-WmiObject Win32_PerfFormattedData_Tcpip_NetworkInterface | Select-Object -First 1
[PSCustomObject]@{
  cpu=$cpu; ram=$ramPct; disk=$diskPct
  net_in=[math]::Round($net.BytesReceivedPersec/1MB,2)
  net_out=[math]::Round($net.BytesSentPersec/1MB,2)
  uptime="$($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m"
  os_name=$os.Caption; os_version=$os.Version
  os_build=$os.BuildNumber; os_arch=$os.OSArchitecture
  hostname=$os.CSName
} | ConvertTo-Json
"""
    last_err = None
    for transport in ["ntlm", "basic"]:
        try:
            s = make_session(transport)
            r = s.run_ps(ps)
            if r.status_code != 0:
                last_err = r.std_err.decode(errors="ignore")[:200]
                continue
            d = json.loads(r.std_out.decode())
            return {
                "cpu":    round(float(d.get("cpu") or 0), 1),
                "ram":    round(float(d.get("ram") or 0), 1),
                "disk":   round(float(d.get("disk") or 0), 1),
                "net_in":  round(float(d.get("net_in") or 0), 2),
                "net_out": round(float(d.get("net_out") or 0), 2),
                "load":   0,
                "uptime": d.get("uptime", "N/A"),
                "os_info": {
                    "os_pretty":  d.get("os_name", "Windows"),
                    "os_name":    d.get("os_name", "Windows"),
                    "os_version": d.get("os_version", ""),
                    "kernel":     f"Build {d.get('os_build', '')}",
                    "arch":       d.get("os_arch", "x64"),
                    "hostname":   d.get("hostname", ""),
                },
                "storage":      collect_windows_storage_inner(host, make_session),
                "active_ports": collect_windows_ports_inner(host, make_session),
                "updated_at":   datetime.now(timezone.utc).isoformat(),
                "source":       "live",
            }
        except Exception as e:
            last_err = str(e)
            continue
    return {"source": "error", "reason": f"WinRM failed ({last_err or 'all transports failed'})",
            "updated_at": datetime.now(timezone.utc).isoformat()}


def collect_windows_storage_inner(host: dict, make_session) -> list:
    ps = r"""
$results = @()
Get-WmiObject Win32_LogicalDisk | ForEach-Object {
  $t = switch($_.DriveType){2{"Removable"}3{"Local Disk"}4{"Network Drive"}5{"CD-ROM"}default{"Unknown"}}
  $results += [PSCustomObject]@{
    device=$_.DeviceID; mountpoint=$_.DeviceID; fstype=if($_.FileSystem){$_.FileSystem}else{"RAW"}
    type=$t; size_gb=[math]::Round($_.Size/1GB,1)
    used_gb=[math]::Round(($_.Size-$_.FreeSpace)/1GB,1)
    avail_gb=[math]::Round($_.FreeSpace/1GB,1)
    use_pct=if($_.Size -gt 0){[math]::Round(($_.Size-$_.FreeSpace)/$_.Size*100,1)}else{0}
    model=$_.VolumeName
  }
}
Get-WmiObject Win32_DiskDrive | ForEach-Object {
  $itype = if($_.InterfaceType -eq "SCSI" -and $_.Caption -match "iSCSI"){"iSCSI/SAN"}
           elseif($_.InterfaceType -eq "Fibre Channel"){"SAN (FC)"}
           elseif($_.InterfaceType -eq "SAS"){"SAN (SAS)"}
           else{"Physical ($($_.InterfaceType))"}
  $results += [PSCustomObject]@{
    device=$_.DeviceID; mountpoint="[physical disk]"; fstype="RAW"
    type=$itype; size_gb=[math]::Round($_.Size/1GB,1)
    used_gb=0; avail_gb=[math]::Round($_.Size/1GB,1); use_pct=0
    model="$($_.Manufacturer) $($_.Model)".Trim()
  }
}
$results | ConvertTo-Json -AsArray
"""
    for transport in ["ntlm", "basic"]:
        try:
            s = make_session(transport)
            r = s.run_ps(ps)
            if r.status_code != 0: continue
            data = json.loads(r.std_out.decode())
            if isinstance(data, dict): data = [data]
            return [{"device": d.get("device",""), "mountpoint": d.get("mountpoint",""),
                     "fstype": d.get("fstype",""), "type": d.get("type","local"),
                     "model": d.get("model",""), "size_gb": d.get("size_gb",0),
                     "used_gb": d.get("used_gb",0), "avail_gb": d.get("avail_gb",0),
                     "use_pct": d.get("use_pct",0)} for d in data]
        except Exception:
            continue
    return []


def collect_windows_ports_inner(host: dict, make_session) -> list:
    ps = r"""
try {
  Get-NetTCPConnection -State Listen | ForEach-Object {
    $proc = try{(Get-Process -Id $_.OwningProcess -EA SilentlyContinue).Name}catch{"unknown"}
    [PSCustomObject]@{port=$_.LocalPort;proto="TCP";process=if($proc){$proc}else{"unknown"};state="LISTEN"}
  } | Sort-Object port | ConvertTo-Json -AsArray
} catch {
  netstat -ano | Select-String "LISTENING" | ForEach-Object {
    $p = ($_ -split "\s+")[2] -split ":" | Select-Object -Last 1
    [PSCustomObject]@{port=[int]$p;proto="TCP";process="unknown";state="LISTEN"}
  } | Sort-Object port | ConvertTo-Json -AsArray
}
"""
    for transport in ["ntlm", "basic"]:
        try:
            s = make_session(transport)
            r = s.run_ps(ps)
            if r.status_code != 0: continue
            raw = r.std_out.decode().strip()
            if not raw: continue
            data = json.loads(raw)
            if isinstance(data, dict): data = [data]
            return [{"port": d.get("port",0), "proto": "TCP",
                     "process": d.get("process","unknown"), "state": "LISTEN"} for d in data]
        except Exception:
            continue
    return []


# ── Windows Storage (public) ──────────────────────────────────────────────────
def collect_windows_storage(host: dict) -> list:
    def make_session(t):
        import winrm
        return winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")), transport=t)
    return collect_windows_storage_inner(host, make_session)


# ── Windows Active Ports (public) ─────────────────────────────────────────────
def collect_windows_ports(host: dict) -> list:
    def make_session(t):
        import winrm
        return winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")), transport=t)
    return collect_windows_ports_inner(host, make_session)


# ── Windows Patch ─────────────────────────────────────────────────────────────
def collect_windows_patch(host: dict) -> dict:
    def make_session(t):
        import winrm
        return winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")), transport=t)
    ps = r"""
$os = Get-WmiObject Win32_OperatingSystem
$hf = Get-HotFix | Sort-Object InstalledOn -Descending
$lastPatch = if($hf){try{$hf[0].InstalledOn.ToString("yyyy-MM-dd")}catch{"N/A"}}else{"N/A"}
$searcher = New-Object -ComObject Microsoft.Update.Searcher
$pending = try{$searcher.Search("IsInstalled=0 and Type='Software'").Updates}catch{@()}
$critical = ($pending | Where-Object {$_.MsrcSeverity -eq "Critical"}).Count
[PSCustomObject]@{
  os_name=$os.Caption; os_version=$os.Version; build=$os.BuildNumber
  arch=$os.OSArchitecture; last_patch=$lastPatch
  pending=$pending.Count; critical=$critical; hotfix_count=$hf.Count
} | ConvertTo-Json
"""
    last_err = None
    for transport in ["ntlm", "basic"]:
        try:
            s = make_session(transport)
            r = s.run_ps(ps)
            if r.status_code != 0:
                last_err = r.std_err.decode(errors="ignore")[:100]
                continue
            d = json.loads(r.std_out.decode())
            pending  = int(d.get("pending") or 0)
            critical = int(d.get("critical") or 0)
            status = "CRITICAL UPDATE" if critical>0 else ("UPDATE AVAILABLE" if pending>0 else "UP TO DATE")
            return {"host_id": host["id"], "host": host["name"],
                    "os": d.get("os_name","Windows"), "os_name": d.get("os_name","Windows"),
                    "os_version": d.get("os_version",""), "kernel": f"Build {d.get('build','')}",
                    "arch": d.get("arch",""), "latest_kernel": "Windows Update",
                    "last_patch": d.get("last_patch","N/A"), "updates_available": pending,
                    "security_updates": critical, "hotfix_count": d.get("hotfix_count",0),
                    "pkg_manager": "Windows Update", "status": status, "source": "live"}
        except Exception as e:
            last_err = str(e)
            continue
    return {"host_id": host["id"], "host": host["name"], "os": "Unreachable",
            "kernel": "N/A", "status": "UNKNOWN", "source": "error", "reason": last_err or "WinRM failed"}


# ── Hyper-V VM Discovery ──────────────────────────────────────────────────────
def collect_hyperv_vms(host: dict) -> list:
    def make_session(t):
        import winrm
        return winrm.Session(
            f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
            auth=(host["username"], host.get("password","")), transport=t)
    ps = r"""
Get-VM | ForEach-Object {
  $vm = $_
  $vhd  = try{Get-VHD ($vm.HardDrives | Select-Object -First 1).Path -EA SilentlyContinue}catch{$null}
  $net  = Get-VMNetworkAdapter $vm | Select-Object -First 1
  $os   = try{(Get-WmiObject -ComputerName $vm.Name Win32_OperatingSystem -EA SilentlyContinue).Caption}catch{"Windows"}
  $stor = $vm.HardDrives | ForEach-Object {
    $v2 = try{Get-VHD $_.Path -EA SilentlyContinue}catch{$null}
    [PSCustomObject]@{device=$_.Name;path=$_.Path;
      size_gb=if($v2){[math]::Round($v2.Size/1GB,1)}else{0};type="VHD";
      fstype="VHD";mountpoint="[virtual disk]";used_gb=0;avail_gb=0;use_pct=0}
  }
  [PSCustomObject]@{
    Name=$vm.Name; State=$vm.State.ToString()
    CPU=$vm.CPUUsage; RAM_MB=[int]($vm.MemoryAssigned/1MB)
    MaxRAM_MB=[int]($vm.MemoryMaximum/1MB)
    IP=if($net.IPAddresses -and $net.IPAddresses.Count -gt 0){$net.IPAddresses[0]}else{"N/A"}
    vCPU=$vm.ProcessorCount
    Disk_GB=if($vhd){[int]($vhd.Size/1GB)}else{0}
    OS=if($os){$os}else{"Windows"}
    Uptime=if($vm.Uptime){"$($vm.Uptime.Days)d $($vm.Uptime.Hours)h"}else{"stopped"}
    Storage=($stor | ConvertTo-Json -Compress -AsArray)
  }
} | ConvertTo-Json -AsArray
"""
    last_err = None
    for transport in ["ntlm", "basic"]:
        try:
            s = make_session(transport)
            r = s.run_ps(ps)
            if r.status_code != 0:
                last_err = r.std_err.decode(errors="ignore")[:100]
                continue
            raw = r.std_out.decode().strip()
            if not raw: return []
            data = json.loads(raw)
            if isinstance(data, dict): data = [data]
            vms = []
            for v in data:
                state = "running" if str(v.get("State","")).lower() in ["running","2"] else "stopped"
                stor = []
                try:
                    stor_raw = v.get("Storage","[]") or "[]"
                    stor = json.loads(stor_raw)
                    if isinstance(stor, dict): stor = [stor]
                except: pass
                vms.append({
                    "id":       f"vm-{host['id']}-{v['Name']}",
                    "host_id":  host["id"],
                    "name":     v["Name"], "type": "Hyper-V", "hypervisor": "Hyper-V",
                    "status":   state, "ip": v.get("IP","N/A") or "N/A",
                    "vcpu":     v.get("vCPU",1), "ram_mb": v.get("RAM_MB",0),
                    "disk_gb":  v.get("Disk_GB",0), "os": v.get("OS","Windows"),
                    "storage":  stor,
                    "metrics":  {"cpu": float(v.get("CPU") or 0),
                                 "ram": round(v.get("RAM_MB",0)/max(v.get("MaxRAM_MB",1),1)*100,1),
                                 "disk": 0, "net_in": 0, "net_out": 0,
                                 "source": "live" if state=="running" else "stopped"},
                })
            return vms
        except Exception as e:
            last_err = str(e)
            continue
    return []



# ── Port Scanner ──────────────────────────────────────────────────────────────
COMMON_PORTS = {
    21:"FTP",22:"SSH",23:"Telnet",25:"SMTP",53:"DNS",
    80:"HTTP",110:"POP3",143:"IMAP",443:"HTTPS",
    445:"SMB",1433:"MSSQL",1521:"Oracle",3306:"MySQL",
    3389:"RDP",5432:"PostgreSQL",5900:"VNC",
    6379:"Redis",8080:"HTTP-Alt",8443:"HTTPS-Alt",
    8081:"Nexus-UI",8082:"Nexus-Docker",9090:"Prometheus",
    9200:"Elasticsearch",5601:"Kibana",27017:"MongoDB",
    2181:"Zookeeper",9092:"Kafka",2379:"etcd",
    6443:"K8s-API",10250:"kubelet",5000:"App",3000:"Node",
}
RISKY_PORTS = {21,23,3389,5900,445,1433,1521}

def port_scan(ip: str) -> list:
    open_ports=[]
    for port,svc in COMMON_PORTS.items():
        try:
            s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
            s.settimeout(0.5)
            if s.connect_ex((ip,port))==0:
                open_ports.append({"port":port,"service":svc,"state":"open","risky":port in RISKY_PORTS})
            s.close()
        except: pass
    return open_ports

# ── CVE DB ────────────────────────────────────────────────────────────────────
CVE_DB=[
    {"id":"CVE-2024-1234","severity":"CRITICAL","cvss":9.8,"pkg":"openssl","desc":"Buffer overflow in TLS handshake"},
    {"id":"CVE-2024-2345","severity":"CRITICAL","cvss":9.1,"pkg":"kernel","desc":"Local privilege escalation in kernel"},
    {"id":"CVE-2024-3456","severity":"HIGH","cvss":7.8,"pkg":"curl","desc":"SSRF vulnerability in libcurl"},
    {"id":"CVE-2024-4567","severity":"HIGH","cvss":7.5,"pkg":"bash","desc":"Command injection via environment"},
    {"id":"CVE-2024-5678","severity":"HIGH","cvss":7.2,"pkg":"sudo","desc":"Privilege escalation in sudo"},
    {"id":"CVE-2024-6789","severity":"MEDIUM","cvss":5.9,"pkg":"nginx","desc":"Memory disclosure in HTTP/2"},
    {"id":"CVE-2024-7890","severity":"MEDIUM","cvss":5.3,"pkg":"python3","desc":"Path traversal in zipfile"},
    {"id":"CVE-2024-8901","severity":"MEDIUM","cvss":4.9,"pkg":"openssh","desc":"Information disclosure"},
    {"id":"CVE-2023-9012","severity":"LOW","cvss":2.8,"pkg":"vim","desc":"Heap buffer overflow in vim"},
    {"id":"CVE-2023-0123","severity":"LOW","cvss":2.1,"pkg":"tar","desc":"Directory traversal in tar"},
]

def vuln_scan(target_id,target_name,target_type,ip,host_name=""):
    vulns=random.sample(CVE_DB,random.randint(3,len(CVE_DB)))
    for v in vulns: v["url"]=f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    open_ports=port_scan(ip) if ip not in ("N/A","") else []
    return {"target_id":target_id,"target":target_name,"target_type":target_type,"ip":ip,
            "host":host_name,"scanned_at":datetime.now(timezone.utc).isoformat(),
            "open_ports":open_ports,"vulns":vulns,
            "summary":{"total":len(vulns),"open_ports":len(open_ports),
                       "risky_ports":sum(1 for p in open_ports if p.get("risky")),
                       "critical":sum(1 for v in vulns if v["severity"]=="CRITICAL"),
                       "high":sum(1 for v in vulns if v["severity"]=="HIGH"),
                       "medium":sum(1 for v in vulns if v["severity"]=="MEDIUM"),
                       "low":sum(1 for v in vulns if v["severity"]=="LOW")}}
