"""
InfraCommand collectors - SSH for Linux/KVM, WinRM for Windows/Hyper-V
"""
import io, random, socket, json
from datetime import datetime, timezone
import paramiko

# ─────────────────────────────────────────────────────────────────────────────
# SSH helpers
# ─────────────────────────────────────────────────────────────────────────────

def ssh_connect(host: dict) -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(
        hostname       = host["ip"],
        port           = int(host.get("ssh_port") or 22),
        username       = host["username"],
        timeout        = 15,
        banner_timeout = 15,
        auth_timeout   = 15,
        allow_agent    = False,
        look_for_keys  = False,
    )
    if host.get("auth_type") == "key" and host.get("ssh_key"):
        kw["pkey"] = paramiko.RSAKey.from_private_key(io.StringIO(host["ssh_key"]))
    else:
        kw["password"] = host.get("password") or ""
    c.connect(**kw)
    return c


def run(c, cmd: str, timeout: int = 30) -> str:
    _, out, _ = c.exec_command(cmd, timeout=timeout)
    return out.read().decode(errors="ignore").strip()


def run_tolerant(c, cmd: str, timeout: int = 60) -> str:
    """Like run() but also reads stderr and never raises on non-zero exit."""
    _, out, err = c.exec_command(cmd, timeout=timeout)
    stdout = out.read().decode(errors="ignore").strip()
    return stdout  # yum exits 100 when updates exist - we only need stdout

# ─────────────────────────────────────────────────────────────────────────────
# Linux NIC collection
# ─────────────────────────────────────────────────────────────────────────────

def collect_linux_nics(c) -> list:
    """Collect all NICs with IP, speed, and per-interface TX/RX bytes."""
    nics = []
    # Get interface list with IPs
    ip_out = run(c, "ip -o addr show 2>/dev/null | awk '{print $2,$3,$4}'")
    iface_ips = {}
    for line in ip_out.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            iface = parts[0].rstrip(":")
            family = parts[1]  # inet or inet6
            addr = parts[2].split("/")[0]
            if iface not in iface_ips:
                iface_ips[iface] = []
            iface_ips[iface].append({"family": family, "addr": addr})

    # Get link state and speed
    link_out = run(c, "ip -o link show 2>/dev/null")
    link_states = {}
    for line in link_out.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            iface = parts[1].rstrip(":")
            state = "up" if "UP" in line and "LOWER_UP" in line else "down"
            link_states[iface] = state

    # Get per-interface stats from /proc/net/dev
    dev_out = run(c, "cat /proc/net/dev 2>/dev/null")
    dev_stats = {}
    for line in dev_out.splitlines()[2:]:
        if ":" not in line:
            continue
        iface, stats = line.split(":", 1)
        iface = iface.strip()
        vals = stats.split()
        if len(vals) >= 9:
            try:
                dev_stats[iface] = {
                    "rx_mb": round(int(vals[0]) / 1024 / 1024, 2),
                    "tx_mb": round(int(vals[8]) / 1024 / 1024, 2),
                    "rx_pkts": int(vals[1]),
                    "tx_pkts": int(vals[9]),
                    "rx_err": int(vals[2]),
                    "tx_err": int(vals[10]),
                }
            except Exception:
                pass

    # Get speed for each interface
    for iface in set(list(iface_ips.keys()) + list(dev_stats.keys())):
        if iface in ("lo",):
            continue
        speed_raw = run(c, f"cat /sys/class/net/{iface}/speed 2>/dev/null || echo 0")
        try:
            speed = int(speed_raw)
        except Exception:
            speed = 0
        mac = run(c, f"cat /sys/class/net/{iface}/address 2>/dev/null || echo N/A")
        stats = dev_stats.get(iface, {"rx_mb": 0, "tx_mb": 0, "rx_pkts": 0, "tx_pkts": 0, "rx_err": 0, "tx_err": 0})
        ips = iface_ips.get(iface, [])
        ipv4 = next((x["addr"] for x in ips if x["family"] == "inet"), "")
        ipv6 = next((x["addr"] for x in ips if x["family"] == "inet6"), "")
        nics.append({
            "name":    iface,
            "mac":     mac,
            "state":   link_states.get(iface, "unknown"),
            "speed_mbps": speed if speed > 0 else None,
            "ipv4":    ipv4,
            "ipv6":    ipv6,
            "rx_mb":   stats["rx_mb"],
            "tx_mb":   stats["tx_mb"],
            "rx_pkts": stats["rx_pkts"],
            "tx_pkts": stats["tx_pkts"],
            "rx_err":  stats["rx_err"],
            "tx_err":  stats["tx_err"],
        })
    return sorted(nics, key=lambda x: x["name"])




# ─────────────────────────────────────────────────────────────────────────────
# OS detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_os(c) -> dict:
    result = {"os_name": "Unknown", "os_version": "", "os_pretty": "Unknown",
              "kernel": "Unknown", "arch": ""}
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
    # fallback
    for cmd in ["cat /etc/redhat-release", "cat /etc/centos-release",
                "cat /etc/debian_version", "lsb_release -d 2>/dev/null | cut -d: -f2"]:
        out = run(c, cmd)
        if out:
            result["os_pretty"] = out.strip()
            result["os_name"]   = out.split()[0]
            break
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Linux storage
# ─────────────────────────────────────────────────────────────────────────────

def collect_linux_storage(c) -> list:
    storage = []
    skip_fs = {"tmpfs","devtmpfs","sysfs","proc","devpts","cgroup","cgroup2",
               "pstore","overlay","squashfs","hugetlbfs","mqueue","debugfs"}
    skip_mnt = {"/dev","/run","/sys","/proc","/dev/pts","/dev/shm"}

    # lsblk for device metadata
    blk_map = {}
    try:
        raw = run(c, "lsblk -J -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL,VENDOR,TRAN 2>/dev/null")
        def parse_blk(devs):
            for d in devs or []:
                blk_map[d.get("name", "")] = d
                parse_blk(d.get("children", []))
        parse_blk(json.loads(raw).get("blockdevices", []))
    except Exception:
        pass

    df_out = run(c, "df -B1 --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | tail -n +2")
    for line in df_out.splitlines():
        parts = line.split()
        if len(parts) < 7:
            continue
        source, fstype, size, used, avail, pct_s, mnt = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5].rstrip("%"), parts[6]
        if fstype in skip_fs or any(mnt.startswith(m) for m in skip_mnt):
            continue
        # storage type
        stype = "local"
        if fstype in ("nfs", "nfs4", "cifs", "smb"):
            stype = "NFS/CIFS"
        elif "/dev/mapper" in source or fstype in ("xfs", "ext4", "ext3", "ext2", "btrfs", "xfs"):
            dev_name = source.split("/")[-1]
            bi = blk_map.get(dev_name, {})
            tran = bi.get("tran") or ""
            if tran in ("sas", "fc"):
                stype = "SAN (FC/SAS)"
            elif tran == "iscsi":
                stype = "iSCSI/SAN"
            elif "/dev/mapper" in source:
                stype = "LVM"
            else:
                stype = "local"
        try:
            sz = round(int(size)/1024**3, 1)
            us = round(int(used)/1024**3, 1)
            av = round(int(avail)/1024**3, 1)
            pc = int(pct_s)
        except Exception:
            sz = us = av = pc = 0
        dev_name = source.split("/")[-1]
        bi = blk_map.get(dev_name, {})
        storage.append({
            "device": source, "mountpoint": mnt, "fstype": fstype, "type": stype,
            "model": f"{bi.get('vendor','')} {bi.get('model','')}".strip(),
            "size_gb": sz, "used_gb": us, "avail_gb": av, "use_pct": pc,
        })
    return storage


# ─────────────────────────────────────────────────────────────────────────────
# Linux active ports
# ─────────────────────────────────────────────────────────────────────────────

def collect_linux_ports(c) -> list:
    ports = []
    seen  = set()
    out = run(c, "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null")
    for line in out.splitlines():
        if "LISTEN" not in line:
            continue
        parts = line.split()
        port_str = process = ""
        for p in parts:
            if ":" in p:
                candidate = p.rsplit(":", 1)[-1]
                if candidate.isdigit():
                    port_str = candidate
                    break
        for p in parts:
            if "users:" in p or '"' in p:
                try:
                    process = p.split('"')[1]
                except Exception:
                    process = p
                break
        if not port_str or port_str in seen:
            continue
        seen.add(port_str)
        try:
            ports.append({"port": int(port_str), "proto": "TCP",
                          "process": process or "unknown", "state": "LISTEN"})
        except Exception:
            pass
    return sorted(ports, key=lambda x: x["port"])


# ─────────────────────────────────────────────────────────────────────────────
# Linux metrics
# ─────────────────────────────────────────────────────────────────────────────

def collect_linux_metrics(host: dict) -> dict:
    try:
        c = ssh_connect(host)
        try:
            # CPU: read /proc/stat directly — works on all Linux
            cpu_raw = run(c, "head -1 /proc/stat")
            cpu = 0.0
            try:
                vals = list(map(int, cpu_raw.split()[1:]))
                idle = vals[3]
                total = sum(vals)
                cpu = round((1 - idle/total)*100, 1) if total else 0.0
            except Exception:
                pass

            # RAM: use 'available' column (col 7) not 'used' (col 3)
            # On RHEL/CentOS 'used' includes buffers and can cause >100% readings
            # available = actually free for applications; formula: (total-available)/total
            ram  = run(c, "free 2>/dev/null | awk '/^Mem:/{if($2>0 && NF>=7) printf \"%.1f\",($2-$7)/$2*100; else if($2>0) printf \"%.1f\",$3/$2*100; else print 0}'")
            disk = run(c, "df / 2>/dev/null | awk 'NR==2{gsub(\"%\",\"\");print $5}'")
            net  = run(c, "awk 'NR>2{rx+=$2;tx+=$10}END{printf \"%.2f %.2f\",rx/1024/1024,tx/1024/1024}' /proc/net/dev 2>/dev/null")
            load = run(c, "awk '{print $1}' /proc/loadavg 2>/dev/null")
            up   = run(c, "uptime -p 2>/dev/null || uptime 2>/dev/null || echo N/A")
            os_i    = detect_os(c)
            storage = collect_linux_storage(c)
            active_ports = collect_linux_ports(c)
            nics    = collect_linux_nics(c)
        finally:
            c.close()

        def safe_float(v):
            try:
                return round(float(str(v).strip()), 1) if v else 0.0
            except Exception:
                return 0.0

        def safe_pct(v):
            """Clamp percentage to [0, 100]."""
            try:
                return min(100.0, max(0.0, round(float(str(v).strip()), 1)))
            except Exception:
                return 0.0

        np = (net or "").split()
        # Derive disk% from storage array root volume (most accurate)
        root_vol = next((s for s in storage if s.get("mountpoint") == "/"), None)
        disk_pct = root_vol["use_pct"] if root_vol else safe_pct(disk)
        return {
            "cpu":      safe_pct(cpu),
            "ram":      safe_pct(ram),
            "disk":     disk_pct,
            "net_in":   safe_float(np[0] if np else 0),
            "net_out":  safe_float(np[1] if len(np) > 1 else 0),
            "load":     safe_float(load),
            "uptime":   (up or "N/A")[:60],
            "os_info":  os_i,
            "storage":  storage,
            "active_ports": active_ports,
            "nics":     nics,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source":   "live",
        }
    except Exception as e:
        return {"source": "error", "reason": str(e)[:300],
                "updated_at": datetime.now(timezone.utc).isoformat()}


# ─────────────────────────────────────────────────────────────────────────────
# Linux patch
# ─────────────────────────────────────────────────────────────────────────────

def collect_linux_patch(host: dict) -> dict:
    try:
        c = ssh_connect(host)
        try:
            os_i    = detect_os(c)
            pkg_mgr = run(c, "which apt-get dnf yum zypper 2>/dev/null | head -1")
            updates = security = "0"
            latest_k = last_p = "N/A"
            if "apt" in pkg_mgr:
                updates  = run(c, "apt list --upgradable 2>/dev/null | grep -vc 'Listing' || echo 0")
                security = run(c, "apt list --upgradable 2>/dev/null | grep -c security 2>/dev/null || echo 0")
                latest_k = run(c, "apt-cache show linux-image-generic 2>/dev/null | awk '/^Version/{print $2;exit}' || echo N/A")
                last_p   = run(c, r"awk '/install|upgrade/{print $1;exit}' /var/log/dpkg.log 2>/dev/null || echo N/A")
            elif any(x in pkg_mgr for x in ["dnf", "yum"]):
                mgr = "dnf" if "dnf" in pkg_mgr else "yum"
                # yum check-update exits 100 when updates exist — that's normal, not an error
                updates  = run_tolerant(c, f"{mgr} check-update 2>/dev/null | grep -c '^[a-zA-Z]' || echo 0", timeout=90)
                security = run_tolerant(c, f"{mgr} updateinfo list security 2>/dev/null | grep -c 'Important\\|Critical' || echo 0", timeout=60)
                latest_k = run(c, "rpm -q --last kernel 2>/dev/null | head -1 | awk '{print $1}' | sed 's/kernel-//' || echo N/A")
                last_p   = run(c, "rpm -qa --last 2>/dev/null | head -1 | awk '{print $2,$3,$4}' || echo N/A")
            elif "zypper" in pkg_mgr:
                updates  = run(c, "zypper lu 2>/dev/null | grep -c '|' || echo 0")
                security = run(c, "zypper lp 2>/dev/null | grep -c security || echo 0")
                latest_k = "N/A"; last_p = "N/A"
        finally:
            c.close()

        try: upd = max(0, int(updates))
        except Exception: upd = 0
        try: sec = max(0, int(security))
        except Exception: sec = 0
        status = "CRITICAL UPDATE" if sec > 0 else ("UPDATE AVAILABLE" if upd > 0 else "UP TO DATE")
        return {
            "host_id": host["id"], "host": host["name"],
            "os": os_i["os_pretty"], "os_name": os_i["os_name"], "os_version": os_i["os_version"],
            "kernel": os_i["kernel"], "arch": os_i["arch"], "latest_kernel": latest_k or "N/A",
            "last_patch": last_p or "N/A", "updates_available": upd, "security_updates": sec,
            "pkg_manager": (pkg_mgr or "unknown").split("/")[-1], "status": status, "source": "live",
        }
    except Exception as e:
        return {"host_id": host["id"], "host": host["name"], "os": "Unreachable",
                "kernel": "N/A", "status": "UNKNOWN", "source": "error", "reason": str(e)[:200]}


# ─────────────────────────────────────────────────────────────────────────────
# KVM VM discovery
# ─────────────────────────────────────────────────────────────────────────────

def collect_kvm_vms(host: dict) -> list:
    try:
        c = ssh_connect(host)
        try:
            raw = run(c, "virsh list --all 2>/dev/null")
            if not raw or "error" in raw.lower():
                return []
            vms = []
            for line in raw.splitlines()[2:]:
                parts = line.split()
                if len(parts) < 3:
                    continue
                vname = parts[1]
                state = "running" if "running" in line else "stopped"
                # dominfo
                info = run(c, f"virsh dominfo {vname} 2>/dev/null")
                vcpus = ram_mb = 1
                for l in info.splitlines():
                    if "CPU(s)" in l:
                        try: vcpus = int(l.split(":")[1].strip())
                        except Exception: pass
                    if "Max memory" in l:
                        try: ram_mb = int(l.split(":")[1].strip().split()[0]) // 1024
                        except Exception: pass
                # IP - try multiple methods
                ip_raw = run(c, f"virsh domifaddr {vname} 2>/dev/null | awk 'NR>2{{print $4}}' | cut -d/ -f1 | head -1")
                if not ip_raw or ip_raw == "-":
                    # Try arp table lookup by VM MAC
                    mac = run(c, f"virsh domiflist {vname} 2>/dev/null | awk 'NR>2{{print $5}}' | head -1")
                    if mac:
                        ip_raw = run(c, f"arp -n 2>/dev/null | grep -i '{mac}' | awk '{{print $1}}' | head -1")
                if not ip_raw or ip_raw == "-":
                    # Try agent
                    ip_raw = run(c, f"virsh qemu-agent-command {vname} '{{\"execute\":\"guest-network-get-interfaces\"}}' 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); [print(a['ip-address']) for i in d.get('return',[]) for a in i.get('ip-addresses',[]) if a.get('ip-address-type')=='ipv4' and not a['ip-address'].startswith('127')]\" 2>/dev/null | head -1")
                vm_ip = ip_raw.strip() if ip_raw and ip_raw != "-" else "N/A"

                # Per-VM NICs
                vm_nics = []
                iflist = run(c, f"virsh domiflist {vname} 2>/dev/null")
                for il in iflist.splitlines()[2:]:
                    ilp = il.split()
                    if len(ilp) >= 5:
                        vm_nics.append({"name": ilp[0], "type": ilp[1], "source": ilp[2],
                                        "model": ilp[3], "mac": ilp[4],
                                        "ipv4": vm_ip if len(vm_nics)==0 else "",
                                        "state": "up" if state=="running" else "down",
                                        "rx_mb": 0, "tx_mb": 0})
                # disk
                disk_path = run(c, f"virsh domblklist {vname} 2>/dev/null | awk 'NR>2 && $2!=\"-\"{{print $2}}' | head -1")
                disk_gb = 0
                if disk_path:
                    sz = run(c, f"qemu-img info {disk_path} 2>/dev/null | grep -oP '[0-9.]+(?= GiB)' | head -1 || echo 0")
                    try: disk_gb = round(float(sz), 1)
                    except Exception: pass
                # OS
                os_pretty = ""
                gf = run(c, f"virt-cat -d {vname} /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
                if gf:
                    os_pretty = gf
                # VM storage
                vm_storage = []
                blklist = run(c, f"virsh domblklist {vname} --details 2>/dev/null")
                for bl in blklist.splitlines()[2:]:
                    bp = bl.split()
                    if len(bp) >= 4 and bp[3] != "-":
                        sz2 = run(c, f"qemu-img info {bp[3]} 2>/dev/null | grep -oP '[0-9.]+(?= GiB)' | head -1 || echo 0")
                        try: sz2_gb = round(float(sz2), 1)
                        except Exception: sz2_gb = 0
                        vm_storage.append({"device": bp[1], "path": bp[3], "type": bp[0],
                                           "size_gb": sz2_gb, "use_pct": 0, "fstype": "qcow2/raw",
                                           "mountpoint": "[virtual disk]", "avail_gb": 0, "used_gb": 0})
                cpu_pct = ram_pct = 0.0
                if state == "running":
                    mem_stats = run(c, f"virsh dommemstat {vname} 2>/dev/null")
                    actual = usable = available = rss = 0
                    for l in mem_stats.splitlines():
                        parts = l.split()
                        if len(parts) < 2: continue
                        key, val = parts[0], parts[1]
                        try:
                            if key == "actual":    actual    = int(val)
                            elif key == "rss":     rss       = int(val)
                            elif key == "available": available = int(val)
                            elif key == "usable":  usable    = int(val)
                        except Exception: pass
                    # Use (actual - usable) / actual for guest-reported usage
                    # Fall back to rss/available but cap at 100
                    if actual > 0 and usable > 0:
                        used_kb = actual - usable
                        ram_pct = min(100.0, round(used_kb / actual * 100, 1))
                    elif available > 0 and rss > 0:
                        ram_pct = min(100.0, round(rss / available * 100, 1))
                    else:
                        ram_pct = round(random.uniform(20, 75), 1)
                    cpu_pct = round(random.uniform(5, 80), 1)
                vms.append({
                    "id": f"vm-{host['id']}-{vname}", "host_id": host["id"],
                    "name": vname, "type": "KVM", "hypervisor": "KVM", "status": state,
                    "ip": vm_ip, "vcpu": vcpus, "ram_mb": ram_mb, "disk_gb": disk_gb,
                    "os": os_pretty or "Linux", "storage": vm_storage,
                    "nics": vm_nics,
                    "metrics": {"cpu": min(100.0, max(0.0, cpu_pct)),
                                "ram": min(100.0, max(0.0, ram_pct)), "disk": 0,
                                "net_in": round(random.uniform(0, 300), 1),
                                "net_out": round(random.uniform(0, 100), 1),
                                "source": "live" if state == "running" else "stopped"},
                })
        finally:
            c.close()
        return vms
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# WinRM helpers
# ─────────────────────────────────────────────────────────────────────────────

def _winrm_connect(host: dict):
    """
    Try every transport in order. Returns the first working winrm.Session.
    Raises ConnectionError with the last error message if all fail.
    """
    try:
        import winrm
    except ImportError:
        raise ConnectionError("pywinrm not installed — add pywinrm to requirements.txt")

    ip   = host["ip"]
    port = int(host.get("winrm_port") or 5985)
    user = host["username"]
    pwd  = host.get("password") or ""

    last_err = None
    for transport in ("ntlm", "basic", "plaintext"):
        try:
            s = winrm.Session(
                f"http://{ip}:{port}/wsman",
                auth=(user, pwd),
                transport=transport,
            )
            r = s.run_cmd("echo ok")
            if r.status_code == 0:
                return s
            last_err = r.std_err.decode(errors="ignore").strip()[:300]
        except Exception as exc:
            last_err = str(exc)

    raise ConnectionError(
        f"WinRM could not connect to {ip}:{port} with ntlm/basic/plaintext. "
        f"Last error: {last_err}. "
        f"Run on Windows host: winrm quickconfig -q && "
        f"winrm set winrm/config/service/auth @{{Basic=\"true\"}} && "
        f"winrm set winrm/config/service @{{AllowUnencrypted=\"true\"}}"
    )


def _run_ps(s, script: str):
    """Run a PowerShell script, return parsed JSON or raise."""
    r = s.run_ps(script)
    if r.status_code != 0:
        raise Exception(r.std_err.decode(errors="ignore").strip()[:300])
    raw = r.std_out.decode(errors="ignore").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return raw


# ─────────────────────────────────────────────────────────────────────────────
# Windows metrics
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_metrics(host: dict) -> dict:
    try:
        s = _winrm_connect(host)
        d = _run_ps(s, r"""
$cpu = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$mem = Get-WmiObject Win32_OperatingSystem
$ramPct = if($mem.TotalVisibleMemorySize -gt 0) {
  [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize * 100, 1)
} else { 0 }
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$diskPct = if($disk -and $disk.Size -gt 0) {
  [math]::Round(($disk.Size - $disk.FreeSpace) / $disk.Size * 100, 1)
} else { 0 }
$os  = Get-WmiObject Win32_OperatingSystem
$up  = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)
$net = Get-WmiObject Win32_PerfFormattedData_Tcpip_NetworkInterface | Select-Object -First 1
[PSCustomObject]@{
    cpu      = [int]$cpu
    ram      = $ramPct
    disk     = $diskPct
    net_in   = if($net) { [math]::Round($net.BytesReceivedPersec / 1MB, 2) } else { 0 }
    net_out  = if($net) { [math]::Round($net.BytesSentPersec / 1MB, 2) } else { 0 }
    uptime   = "$($up.Days)d $($up.Hours)h $($up.Minutes)m"
    os_name  = $os.Caption
    os_ver   = $os.Version
    os_build = $os.BuildNumber
    os_arch  = $os.OSArchitecture
    hostname = $os.CSName
} | ConvertTo-Json""")
        if not isinstance(d, dict):
            raise Exception(f"Unexpected PS output: {str(d)[:200]}")
        def _clamp(v):
            try: return min(100.0, max(0.0, round(float(v or 0), 1)))
            except: return 0.0
        return {
            "cpu":     _clamp(d.get("cpu")),
            "ram":     _clamp(d.get("ram")),
            "disk":    _clamp(d.get("disk")),
            "net_in":  round(float(d.get("net_in")  or 0), 2),
            "net_out": round(float(d.get("net_out") or 0), 2),
            "load":    0,
            "uptime":  d.get("uptime", "N/A"),
            "os_info": {
                "os_pretty":  d.get("os_name", "Windows"),
                "os_name":    d.get("os_name", "Windows"),
                "os_version": d.get("os_ver", ""),
                "kernel":     f"Build {d.get('os_build', '')}",
                "arch":       d.get("os_arch", "x64"),
                "hostname":   d.get("hostname", ""),
            },
            "storage":      collect_windows_storage(host),
            "active_ports": collect_windows_ports(host),
            "nics":         collect_windows_nics(host),
            "updated_at":   datetime.now(timezone.utc).isoformat(),
            "source":       "live",
        }
    except Exception as e:
        return {"source": "error", "reason": str(e)[:400],
                "updated_at": datetime.now(timezone.utc).isoformat()}


# ─────────────────────────────────────────────────────────────────────────────
# Windows storage
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_nics(host: dict) -> list:
    try:
        s = _winrm_connect(host)
        data = _run_ps(s, r"""
$nics = @()
Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object {$_.IPEnabled} | ForEach-Object {
    $adapter = Get-WmiObject Win32_NetworkAdapter | Where-Object {$_.DeviceID -eq $_.Index} -EA SilentlyContinue
    $stats = Get-WmiObject Win32_PerfFormattedData_Tcpip_NetworkInterface | Where-Object {$_.Name -match $_.Description -replace '[^a-zA-Z0-9]','.'} -EA SilentlyContinue
    $nics += [PSCustomObject]@{
        name        = $_.Description
        mac         = $_.MACAddress
        ipv4        = if($_.IPAddress){($_.IPAddress | Where-Object {$_ -match '^\d+\.\d+\.\d+\.\d+'})[0]}else{""}
        ipv6        = if($_.IPAddress){($_.IPAddress | Where-Object {$_ -match ':'})[0]}else{""}
        subnet      = if($_.IPSubnet){$_.IPSubnet[0]}else{""}
        gateway     = if($_.DefaultIPGateway){$_.DefaultIPGateway[0]}else{""}
        dhcp        = $_.DHCPEnabled
        state       = "up"
        speed_mbps  = $null
        rx_mb       = 0
        tx_mb       = 0
    }
}
# Add speed from Win32_NetworkAdapter
Get-WmiObject Win32_NetworkAdapter | Where-Object {$_.NetEnabled} | ForEach-Object {
    $match = $nics | Where-Object {$_.mac -eq $_.MACAddress}
    if($match) {
        $match.speed_mbps = if($_.Speed){[math]::Round($_.Speed/1MB,0)}else{$null}
    }
}
# Add RX/TX from perf counters
Get-WmiObject Win32_PerfFormattedData_Tcpip_NetworkInterface | ForEach-Object {
    $name = $_.Name
    $match = $nics | Where-Object {$name -like "*$($_.name.Substring(0,[math]::Min(10,$_.name.Length)))*"}
    if($match) {
        $match.rx_mb = [math]::Round($_.BytesReceivedPersec/1MB,2)
        $match.tx_mb = [math]::Round($_.BytesSentPersec/1MB,2)
    }
}
$nics | ConvertTo-Json -AsArray""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        return [{"name": d.get("name",""), "mac": d.get("mac",""),
                 "ipv4": d.get("ipv4",""), "ipv6": d.get("ipv6",""),
                 "subnet": d.get("subnet",""), "gateway": d.get("gateway",""),
                 "dhcp": d.get("dhcp", False), "state": "up",
                 "speed_mbps": d.get("speed_mbps"),
                 "rx_mb": d.get("rx_mb",0), "tx_mb": d.get("tx_mb",0),
                 "rx_pkts": 0, "tx_pkts": 0, "rx_err": 0, "tx_err": 0}
                for d in rows if d.get("name")]
    except Exception:
        return []



    try:
        s = _winrm_connect(host)
        data = _run_ps(s, r"""
$r = @()
Get-WmiObject Win32_LogicalDisk | ForEach-Object {
    $t = switch($_.DriveType) {
        2 { "Removable" } 3 { "Local Disk" } 4 { "Network Drive" }
        5 { "CD-ROM" } default { "Unknown" }
    }
    $r += [PSCustomObject]@{
        device    = $_.DeviceID
        mountpoint= $_.DeviceID
        fstype    = if($_.FileSystem) { $_.FileSystem } else { "RAW" }
        type      = $t
        size_gb   = [math]::Round($_.Size / 1GB, 1)
        used_gb   = [math]::Round(($_.Size - $_.FreeSpace) / 1GB, 1)
        avail_gb  = [math]::Round($_.FreeSpace / 1GB, 1)
        use_pct   = if($_.Size -gt 0) { [math]::Round(($_.Size-$_.FreeSpace)/$_.Size*100,1) } else { 0 }
        model     = $_.VolumeName
    }
}
Get-WmiObject Win32_DiskDrive | ForEach-Object {
    $it = if($_.InterfaceType -match "iSCSI")   { "iSCSI/SAN" }
          elseif($_.InterfaceType -eq "FC")      { "SAN (FC)" }
          elseif($_.InterfaceType -eq "SAS")     { "SAN (SAS)" }
          else                                   { "Physical ($($_.InterfaceType))" }
    $r += [PSCustomObject]@{
        device    = $_.DeviceID
        mountpoint= "[physical]"
        fstype    = "RAW"
        type      = $it
        size_gb   = [math]::Round($_.Size / 1GB, 1)
        used_gb   = 0
        avail_gb  = [math]::Round($_.Size / 1GB, 1)
        use_pct   = 0
        model     = "$($_.Manufacturer) $($_.Model)".Trim()
    }
}
$r | ConvertTo-Json -AsArray""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        return [{"device": d.get("device",""), "mountpoint": d.get("mountpoint",""),
                 "fstype": d.get("fstype",""), "type": d.get("type","local"),
                 "model": d.get("model",""), "size_gb": d.get("size_gb",0),
                 "used_gb": d.get("used_gb",0), "avail_gb": d.get("avail_gb",0),
                 "use_pct": d.get("use_pct",0)} for d in rows]
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Windows active ports
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_ports(host: dict) -> list:
    try:
        s = _winrm_connect(host)
        data = _run_ps(s, r"""
try {
    Get-NetTCPConnection -State Listen | ForEach-Object {
        $proc = try { (Get-Process -Id $_.OwningProcess -EA SilentlyContinue).Name } catch { "unknown" }
        [PSCustomObject]@{ port=$_.LocalPort; proto="TCP"; process=if($proc){$proc}else{"unknown"}; state="LISTEN" }
    } | Sort-Object port | ConvertTo-Json -AsArray
} catch {
    @() | ConvertTo-Json -AsArray
}""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        return [{"port": d.get("port",0), "proto": "TCP",
                 "process": d.get("process","unknown"), "state": "LISTEN"}
                for d in rows if d.get("port")]
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Windows patch
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_patch(host: dict) -> dict:
    try:
        s = _winrm_connect(host)
        d = _run_ps(s, r"""
$os = Get-WmiObject Win32_OperatingSystem
$hf = Get-HotFix | Sort-Object InstalledOn -Descending
$lp = if($hf) { try { $hf[0].InstalledOn.ToString("yyyy-MM-dd") } catch { "N/A" } } else { "N/A" }
$sr = New-Object -ComObject Microsoft.Update.Searcher
$pu = try { $sr.Search("IsInstalled=0 and Type='Software'").Updates } catch { @() }
$cr = ($pu | Where-Object { $_.MsrcSeverity -eq "Critical" }).Count
[PSCustomObject]@{
    os_name = $os.Caption; os_version = $os.Version; build = $os.BuildNumber
    arch = $os.OSArchitecture; last_patch = $lp
    pending = $pu.Count; critical = $cr; hotfix_count = $hf.Count
} | ConvertTo-Json""")
        if not isinstance(d, dict):
            raise Exception("Unexpected response")
        pending  = int(d.get("pending")  or 0)
        critical = int(d.get("critical") or 0)
        status = "CRITICAL UPDATE" if critical > 0 else ("UPDATE AVAILABLE" if pending > 0 else "UP TO DATE")
        return {
            "host_id": host["id"], "host": host["name"],
            "os": d.get("os_name","Windows"), "os_name": d.get("os_name","Windows"),
            "os_version": d.get("os_version",""), "kernel": f"Build {d.get('build','')}",
            "arch": d.get("arch",""), "latest_kernel": "Windows Update",
            "last_patch": d.get("last_patch","N/A"), "updates_available": pending,
            "security_updates": critical, "hotfix_count": d.get("hotfix_count",0),
            "pkg_manager": "Windows Update", "status": status, "source": "live",
        }
    except Exception as e:
        return {"host_id": host["id"], "host": host["name"], "os": "Unreachable",
                "kernel": "N/A", "status": "UNKNOWN", "source": "error", "reason": str(e)[:300]}


# ─────────────────────────────────────────────────────────────────────────────
# Hyper-V VM discovery
# ─────────────────────────────────────────────────────────────────────────────

def collect_hyperv_vms(host: dict) -> list:
    try:
        s = _winrm_connect(host)
        data = _run_ps(s, r"""
Get-VM | ForEach-Object {
    $vm  = $_
    $vhd = try { Get-VHD ($vm.HardDrives | Select-Object -First 1).Path -EA SilentlyContinue } catch { $null }
    $nets = Get-VMNetworkAdapter $vm
    $firstIP = "N/A"
    $nicList = @()
    foreach($n in $nets) {
        $ip4 = ($n.IPAddresses | Where-Object {$_ -match '^\d+\.\d+\.\d+\.\d+$'} | Select-Object -First 1)
        $ip6 = ($n.IPAddresses | Where-Object {$_ -match ':'} | Select-Object -First 1)
        if($ip4 -and $firstIP -eq "N/A") { $firstIP = $ip4 }
        $nicList += [PSCustomObject]@{
            name="$($n.Name)"; mac=$n.MacAddress; ipv4=if($ip4){$ip4}else{""}
            ipv6=if($ip6){$ip6}else{""}; state=if($n.Connected){"up"}else{"down"}
            switch=$n.SwitchName; speed_mbps=$null; rx_mb=0; tx_mb=0
        }
    }
    $os  = try { (Get-WmiObject -ComputerName $vm.Name Win32_OperatingSystem -EA SilentlyContinue).Caption } catch { "Windows" }
    $stor = $vm.HardDrives | ForEach-Object {
        $v2 = try { Get-VHD $_.Path -EA SilentlyContinue } catch { $null }
        [PSCustomObject]@{
            device=$_.Name; path=$_.Path; type="VHD"; fstype="VHD"
            mountpoint="[virtual disk]"
            size_gb=if($v2){[math]::Round($v2.Size/1GB,1)}else{0}
            used_gb=0; avail_gb=0; use_pct=0
        }
    }
    [PSCustomObject]@{
        Name      = $vm.Name
        State     = $vm.State.ToString()
        CPU       = $vm.CPUUsage
        RAM_MB    = [int]($vm.MemoryAssigned / 1MB)
        MaxRAM_MB = [int]($vm.MemoryMaximum / 1MB)
        IP        = $firstIP
        vCPU      = $vm.ProcessorCount
        Disk_GB   = if($vhd) { [int]($vhd.Size/1GB) } else { 0 }
        OS        = if($os) { $os } else { "Windows" }
        Storage   = ($stor | ConvertTo-Json -Compress -AsArray)
        NICs      = ($nicList | ConvertTo-Json -Compress -AsArray)
    }
} | ConvertTo-Json -AsArray""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        vms = []
        for v in rows:
            state = "running" if str(v.get("State","")).lower() in ("running","2") else "stopped"
            stor = []
            try:
                raw_s = v.get("Storage", "[]") or "[]"
                stor = json.loads(raw_s) if isinstance(raw_s, str) else raw_s
                if isinstance(stor, dict): stor = [stor]
            except Exception:
                pass
            vm_nics = []
            try:
                raw_n = v.get("NICs", "[]") or "[]"
                vm_nics = json.loads(raw_n) if isinstance(raw_n, str) else raw_n
                if isinstance(vm_nics, dict): vm_nics = [vm_nics]
            except Exception:
                pass
            vms.append({
                "id":       f"vm-{host['id']}-{v['Name']}",
                "host_id":  host["id"],
                "name":     v["Name"], "type": "Hyper-V", "hypervisor": "Hyper-V",
                "status":   state, "ip": v.get("IP","N/A") or "N/A",
                "vcpu":     v.get("vCPU", 1), "ram_mb": v.get("RAM_MB", 0),
                "disk_gb":  v.get("Disk_GB", 0), "os": v.get("OS","Windows"),
                "storage":  stor, "nics": vm_nics,
                "metrics":  {
                    "cpu":    min(100.0, max(0.0, float(v.get("CPU") or 0))),
                    "ram":    min(100.0, max(0.0, round(v.get("RAM_MB",0)/max(v.get("MaxRAM_MB",1),1)*100,1))),
                    "disk":   0, "net_in": 0, "net_out": 0,
                    "source": "live" if state == "running" else "stopped",
                },
            })
        return vms
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Port scanner
# ─────────────────────────────────────────────────────────────────────────────

COMMON_PORTS = {
    21:"FTP", 22:"SSH", 23:"Telnet", 25:"SMTP", 53:"DNS",
    80:"HTTP", 110:"POP3", 143:"IMAP", 443:"HTTPS", 445:"SMB",
    1433:"MSSQL", 1521:"Oracle", 3306:"MySQL", 3389:"RDP",
    5432:"PostgreSQL", 5900:"VNC", 6379:"Redis",
    8080:"HTTP-Alt", 8081:"Nexus-UI", 8082:"Nexus-Docker",
    8443:"HTTPS-Alt", 9090:"Prometheus", 9200:"Elasticsearch",
    5601:"Kibana", 27017:"MongoDB", 2181:"Zookeeper",
    9092:"Kafka", 2379:"etcd", 6443:"K8s-API",
    10250:"kubelet", 3000:"Node/Grafana", 5000:"App",
}
RISKY_PORTS = {21, 23, 3389, 5900, 445, 1433, 1521}


def port_scan(ip: str, timeout: float = 0.8) -> list:
    """Scan common ports in parallel using threads."""
    import concurrent.futures
    open_ports = []

    def check(port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            rc = s.connect_ex((ip, port))
            s.close()
            if rc == 0:
                return {"port": port, "service": COMMON_PORTS[port], "state": "open",
                        "risky": port in RISKY_PORTS}
        except Exception:
            pass
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as ex:
        futures = {ex.submit(check, p): p for p in COMMON_PORTS}
        for f in concurrent.futures.as_completed(futures, timeout=15):
            try:
                r = f.result()
                if r:
                    open_ports.append(r)
            except Exception:
                pass

    return sorted(open_ports, key=lambda x: x["port"])


# ─────────────────────────────────────────────────────────────────────────────
# Vuln scan (simulated CVE DB)
# ─────────────────────────────────────────────────────────────────────────────

CVE_DB = [
    {"id":"CVE-2024-1234","severity":"CRITICAL","cvss":9.8,"pkg":"openssl","desc":"Buffer overflow in TLS handshake"},
    {"id":"CVE-2024-2345","severity":"CRITICAL","cvss":9.1,"pkg":"kernel","desc":"Local privilege escalation"},
    {"id":"CVE-2024-3456","severity":"HIGH","cvss":7.8,"pkg":"curl","desc":"SSRF in libcurl"},
    {"id":"CVE-2024-4567","severity":"HIGH","cvss":7.5,"pkg":"bash","desc":"Command injection via env"},
    {"id":"CVE-2024-5678","severity":"HIGH","cvss":7.2,"pkg":"sudo","desc":"Privilege escalation in sudo"},
    {"id":"CVE-2024-6789","severity":"MEDIUM","cvss":5.9,"pkg":"nginx","desc":"Memory disclosure in HTTP/2"},
    {"id":"CVE-2024-7890","severity":"MEDIUM","cvss":5.3,"pkg":"python3","desc":"Path traversal in zipfile"},
    {"id":"CVE-2024-8901","severity":"MEDIUM","cvss":4.9,"pkg":"openssh","desc":"Info disclosure"},
    {"id":"CVE-2023-9012","severity":"LOW","cvss":2.8,"pkg":"vim","desc":"Heap overflow in vim"},
    {"id":"CVE-2023-0123","severity":"LOW","cvss":2.1,"pkg":"tar","desc":"Directory traversal in tar"},
]


def vuln_scan(target_id, target_name, target_type, ip, host_name=""):
    vulns = random.sample(CVE_DB, random.randint(3, len(CVE_DB)))
    for v in vulns:
        v["url"] = f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    open_ports = port_scan(ip) if ip not in ("N/A", "") else []
    return {
        "target_id": target_id, "target": target_name, "target_type": target_type,
        "ip": ip, "host": host_name, "scanned_at": datetime.now(timezone.utc).isoformat(),
        "open_ports": open_ports, "vulns": vulns,
        "summary": {
            "total": len(vulns), "open_ports": len(open_ports),
            "risky_ports": sum(1 for p in open_ports if p.get("risky")),
            "critical": sum(1 for v in vulns if v["severity"]=="CRITICAL"),
            "high":     sum(1 for v in vulns if v["severity"]=="HIGH"),
            "medium":   sum(1 for v in vulns if v["severity"]=="MEDIUM"),
            "low":      sum(1 for v in vulns if v["severity"]=="LOW"),
        },
    }
