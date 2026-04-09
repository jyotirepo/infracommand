"""
ServerCapacity collectors - SSH for Linux/KVM, WinRM for Windows/Hyper-V
"""
import io, random, socket, json
from datetime import datetime, timezone
import paramiko

# ─────────────────────────────────────────────────────────────────────────────
# SSH helpers
# ─────────────────────────────────────────────────────────────────────────────

def ssh_connect(host: dict) -> paramiko.SSHClient:
    """
    Connect via SSH. Handles paramiko 3.x + old OpenSSH (RHEL 7/CentOS 7) by
    trying modern algorithms first, then falling back to legacy ones.
    Raises a clear exception if connection fails.
    """
    def _make_client():
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        return c

    base_kw = dict(
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
        # Try RSA first, then Ed25519
        for key_cls in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey):
            try:
                base_kw["pkey"] = key_cls.from_private_key(io.StringIO(host["ssh_key"]))
                break
            except Exception:
                continue
    else:
        base_kw["password"] = host.get("password") or ""

    last_err = None

    # Attempt 1: default paramiko settings (modern algorithms)
    try:
        c = _make_client()
        c.connect(**base_kw)
        # Validate transport is actually open
        if c.get_transport() and c.get_transport().is_active():
            return c
        c.close()
    except Exception as e:
        last_err = e

    # Attempt 2: enable legacy algorithms for RHEL 7 / CentOS 7 / OpenSSH 7.x
    try:
        c = _make_client()
        legacy_kw = {**base_kw}
        legacy_kw["disabled_algorithms"] = {
            "pubkeys":   [],        # allow all pubkey types incl ssh-rsa
            "keys":      [],        # allow all key exchange
        }
        c.connect(**legacy_kw)
        if c.get_transport() and c.get_transport().is_active():
            return c
        c.close()
    except Exception as e:
        last_err = e

    # Attempt 3: force diffie-hellman-group-exchange (RHEL 7.7 default KEx)
    try:
        c = _make_client()
        t_kw = {**base_kw}
        c.connect(**t_kw)
        transport = c.get_transport()
        if transport is None:
            raise paramiko.SSHException("Transport is None after connect — algorithm negotiation failed")
        if not transport.is_active():
            raise paramiko.SSHException("Transport inactive after connect")
        return c
    except Exception as e:
        last_err = e

    raise Exception(f"SSH connection to {host['ip']}:{base_kw['port']} failed: {last_err}")


def run(c, cmd: str, timeout: int = 30) -> str:
    try:
        transport = c.get_transport() if c else None
        if not transport or not transport.is_active():
            return ""
        _, out, _ = c.exec_command(cmd, timeout=timeout)
        return out.read().decode(errors="ignore").strip()
    except Exception:
        return ""


def run_tolerant(c, cmd: str, timeout: int = 60) -> str:
    """Like run() but never raises on non-zero exit (e.g. yum exits 100)."""
    try:
        transport = c.get_transport() if c else None
        if not transport or not transport.is_active():
            return ""
        _, out, err = c.exec_command(cmd, timeout=timeout)
        return out.read().decode(errors="ignore").strip()
    except Exception:
        return ""

# ─────────────────────────────────────────────────────────────────────────────
# Linux NIC collection
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# Cross-distro Linux collection helpers
# Supports: RHEL/CentOS 6/7/8/9, Fedora, Ubuntu 14-24, Debian 8-12,
#           SLES/openSUSE, Alpine, Amazon Linux 1/2/2023, Oracle Linux,
#           Rocky/AlmaLinux, Arch, Gentoo, old kernels (2.6+)
# ─────────────────────────────────────────────────────────────────────────────

def detect_os_cross(c) -> dict:
    """Detect OS on any Linux distro, any version."""
    result = {"os_name": "Linux", "os_version": "", "os_pretty": "Linux",
              "kernel": "", "arch": "", "hostname": ""}
    result["kernel"]   = run(c, "uname -r 2>/dev/null || echo unknown") or "unknown"
    result["arch"]     = run(c, "uname -m 2>/dev/null || arch 2>/dev/null || echo unknown") or "unknown"
    result["hostname"] = run(c, "hostname -s 2>/dev/null || hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null") or ""

    # Primary: /etc/os-release (systemd era, most modern distros)
    os_rel = run(c, "cat /etc/os-release 2>/dev/null")
    if os_rel:
        f = {}
        for line in os_rel.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                f[k.strip()] = v.strip().strip('"')
        result["os_name"]    = f.get("NAME", "Linux")
        result["os_version"] = f.get("VERSION_ID", f.get("VERSION", ""))
        result["os_pretty"]  = f.get("PRETTY_NAME", result["os_name"])
        if result["os_pretty"] and result["os_pretty"] != "Linux":
            return result

    # Fallback chain — try every known release file
    fallbacks = [
        ("cat /etc/redhat-release 2>/dev/null",   None),
        ("cat /etc/centos-release 2>/dev/null",    None),
        ("cat /etc/oracle-release 2>/dev/null",    None),
        ("cat /etc/rocky-release 2>/dev/null",     None),
        ("cat /etc/almalinux-release 2>/dev/null", None),
        ("cat /etc/fedora-release 2>/dev/null",    None),
        ("cat /etc/system-release 2>/dev/null",    None),
        ("cat /etc/SuSE-release 2>/dev/null | head -2 | tr '\n' ' '", None),
        ("cat /etc/SUSE-brand 2>/dev/null | head -1", None),
        ("cat /etc/debian_version 2>/dev/null",    "Debian"),
        ("lsb_release -ds 2>/dev/null",            None),
        ("cat /etc/arch-release 2>/dev/null",      "Arch Linux"),
        ("cat /etc/gentoo-release 2>/dev/null",    None),
        ("cat /etc/alpine-release 2>/dev/null",    "Alpine Linux"),
        ("cat /etc/issue 2>/dev/null | head -1",   None),
    ]
    for cmd, prefix in fallbacks:
        out = run(c, cmd)
        if out and out.strip() and out.strip() not in ("", "\\n", "\\l"):
            val = out.strip()
            result["os_pretty"] = f"{prefix} {val}" if prefix else val
            result["os_name"]   = prefix or val.split()[0]
            # Extract version from string like "CentOS Linux release 7.9.2009"
            import re
            m = re.search(r'(\d+[\.\d]*)', val)
            if m and not result["os_version"]:
                result["os_version"] = m.group(1)
            return result

    return result


def collect_linux_nics_cross(c) -> list:
    """Collect NICs on any Linux distro."""
    nics = []

    # /proc/net/dev — present on ALL Linux kernels 2.2+
    dev_out = run(c, "cat /proc/net/dev 2>/dev/null")
    dev_stats = {}
    for line in (dev_out or "").splitlines()[2:]:
        if ":" not in line:
            continue
        iface, stats = line.split(":", 1)
        iface = iface.strip()
        vals = stats.split()
        if len(vals) >= 9:
            try:
                dev_stats[iface] = {
                    "rx_mb":   round(int(vals[0]) / 1024 / 1024, 2),
                    "tx_mb":   round(int(vals[8]) / 1024 / 1024, 2),
                    "rx_pkts": int(vals[1]),
                    "tx_pkts": int(vals[9]),
                    "rx_err":  int(vals[2]),
                    "tx_err":  int(vals[10]),
                }
            except Exception:
                pass

    # IP addresses — try ip first, fall back to ifconfig
    iface_ips = {}
    ip_out = run(c, "ip -o addr show 2>/dev/null")
    if ip_out:
        for line in ip_out.splitlines():
            parts = line.split()
            if len(parts) >= 4:
                iface  = parts[1].rstrip(":")
                family = parts[2]
                addr   = parts[3].split("/")[0]
                if iface not in iface_ips:
                    iface_ips[iface] = []
                iface_ips[iface].append({"family": family, "addr": addr})
    else:
        # ifconfig fallback (old RHEL 6, Alpine minimal, etc.)
        ifc_out = run(c, "ifconfig -a 2>/dev/null")
        cur = None
        for line in (ifc_out or "").splitlines():
            # Interface line: "eth0    Link encap:Ethernet" or "eth0: flags=..."
            import re
            m = re.match(r'^(\S+?)[\s:]', line)
            if m and not line.startswith(" ") and not line.startswith("\t"):
                cur = m.group(1).rstrip(":")
                if cur not in iface_ips:
                    iface_ips[cur] = []
            elif cur:
                # inet addr:1.2.3.4  or  inet 1.2.3.4
                m4 = re.search(r'inet\s+(?:addr:)?(\d+\.\d+\.\d+\.\d+)', line)
                if m4:
                    iface_ips[cur].append({"family": "inet", "addr": m4.group(1)})
                m6 = re.search(r'inet6\s+(?:addr:)?([0-9a-f:]+)', line)
                if m6:
                    iface_ips[cur].append({"family": "inet6", "addr": m6.group(1)})

    # Link state
    link_states = {}
    link_out = run(c, "ip -o link show 2>/dev/null")
    if link_out:
        for line in link_out.splitlines():
            parts = line.split()
            if len(parts) >= 3:
                iface = parts[1].rstrip(":")
                link_states[iface] = "up" if "LOWER_UP" in line else "down"
    else:
        # /sys/class/net fallback
        sysnet = run(c, "ls /sys/class/net/ 2>/dev/null")
        for iface in (sysnet or "").split():
            operstate = run(c, f"cat /sys/class/net/{iface}/operstate 2>/dev/null") or "unknown"
            link_states[iface] = "up" if operstate.strip() == "up" else "down"

    for iface in set(list(iface_ips.keys()) + list(dev_stats.keys())):
        if iface in ("lo",) or iface.startswith("lo:"):
            continue
        # Speed
        speed = 0
        try:
            sp = run(c, f"cat /sys/class/net/{iface}/speed 2>/dev/null || echo 0")
            speed = int(sp.strip()) if sp.strip().lstrip("-").isdigit() else 0
            if speed < 0: speed = 0
        except Exception:
            pass
        # MAC
        mac = run(c, f"cat /sys/class/net/{iface}/address 2>/dev/null || "
                     f"ip link show {iface} 2>/dev/null | awk '/link\\/ether/{{print $2}}'") or ""
        stats = dev_stats.get(iface, {"rx_mb": 0, "tx_mb": 0, "rx_pkts": 0,
                                       "tx_pkts": 0, "rx_err": 0, "tx_err": 0})
        ips   = iface_ips.get(iface, [])
        ipv4  = next((x["addr"] for x in ips if x["family"] == "inet"), "")
        ipv6  = next((x["addr"] for x in ips if x["family"] == "inet6"
                      and not x["addr"].startswith("fe80")), "")
        nics.append({
            "name":       iface,
            "mac":        (mac or "").strip(),
            "state":      link_states.get(iface, "unknown"),
            "speed_mbps": speed if speed > 0 else None,
            "ipv4":       ipv4,
            "ipv6":       ipv6,
            **stats,
        })

    return sorted(nics, key=lambda x: x["name"])


def collect_linux_storage_cross(c) -> list:
    """Collect storage on any Linux — handles old df, no lsblk, no JSON."""
    storage = []
    skip_fs  = {"tmpfs","devtmpfs","sysfs","proc","devpts","cgroup","cgroup2",
                "pstore","overlay","squashfs","hugetlbfs","mqueue","debugfs",
                "securityfs","fusectl","tracefs","configfs","binfmt_misc",
                "efivarfs","autofs","ramfs","rootfs"}
    skip_mnt = {"/dev","/run","/sys","/proc","/dev/pts","/dev/shm",
                "/run/lock","/run/user","/snap"}

    # df -P: POSIX portable format — works on ALL Linux/UNIX
    # -B1 gives bytes; fall back to -k if -B1 not supported (old df)
    df_out = run(c, "df -PB1 2>/dev/null || df -Pk 2>/dev/null || df -P 2>/dev/null")
    use_bytes = "-PB1" in (df_out or "")[:20] or (len((df_out or "").splitlines()) > 1 and
                 any(line.split()[1:2] and str(line.split()[1]).isdigit() and
                     len(str(line.split()[1])) > 10
                     for line in (df_out or "").splitlines()[1:] if line.split()))

    for line in (df_out or "").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 6:
            continue
        source  = parts[0]
        # df -P: Filesystem 1B-blocks Used Available Use% Mounted
        try:
            size_raw = int(parts[1])
            used_raw = int(parts[2])
            avail_raw= int(parts[3])
        except Exception:
            continue
        pct_s = parts[4].rstrip("%")
        mnt   = parts[5]

        # Skip pseudo filesystems
        if any(mnt.startswith(m) for m in skip_mnt):
            continue
        if source.startswith("tmpfs") or source.startswith("devtmpfs"):
            continue

        # Get fstype — try /proc/mounts first, then mount command
        fstype = ""
        try:
            mnt_info = run(c, f"awk '$2==\"{mnt}\"{{print $3;exit}}' /proc/mounts 2>/dev/null")
            fstype = (mnt_info or "").strip()
        except Exception:
            pass
        if not fstype:
            fstype = run(c, f"mount 2>/dev/null | awk '$3==\"{mnt}\"{{print $5;exit}}'") or "unknown"

        if fstype in skip_fs:
            continue

        # Convert units
        divisor = 1 if use_bytes else 1024  # if -Pk, values are in kB
        # Actually check column width to determine unit
        sz = round(size_raw  / (1024**3 if use_bytes else 1024**2), 1)
        us = round(used_raw  / (1024**3 if use_bytes else 1024**2), 1)
        av = round(avail_raw / (1024**3 if use_bytes else 1024**2), 1)
        try:
            pc = int(pct_s)
        except Exception:
            pc = round(us / sz * 100) if sz > 0 else 0

        # Storage type
        stype = "local"
        if fstype in ("nfs", "nfs4", "cifs", "smb", "smb2", "smbfs"):
            stype = "NFS/CIFS"
        elif "/dev/mapper" in source:
            stype = "LVM"
        else:
            # Try to detect SAN/iSCSI from /sys
            dev_name = source.split("/")[-1].rstrip("0123456789")
            tran = run(c, f"cat /sys/block/{dev_name}/queue/rotational 2>/dev/null || "
                          f"cat /sys/block/{dev_name}/device/type 2>/dev/null || echo ''") or ""
            trans = run(c, f"ls -la /sys/block/{dev_name} 2>/dev/null | grep -o 'host[0-9]' | head -1")
            if "iscsi" in (run(c, f"cat /sys/block/{dev_name}/device/transport_id 2>/dev/null") or "").lower():
                stype = "iSCSI/SAN"

        # lsblk device info (may not be available on old kernels)
        model = ""
        try:
            dev_name = source.split("/")[-1]
            base = ''.join(c for c in dev_name if not c.isdigit())
            model_raw = run(c, f"cat /sys/block/{base}/device/model 2>/dev/null | tr -d ' ' || echo ''")
            vendor_raw= run(c, f"cat /sys/block/{base}/device/vendor 2>/dev/null | tr -d ' ' || echo ''")
            model = f"{vendor_raw} {model_raw}".strip()
        except Exception:
            pass

        storage.append({
            "device":    source,
            "mountpoint":mnt,
            "fstype":    fstype or "unknown",
            "type":      stype,
            "model":     model,
            "size_gb":   sz,
            "used_gb":   us,
            "avail_gb":  av,
            "use_pct":   min(100, pc),
        })

    # De-duplicate occasional duplicate df rows (same mount + device).
    uniq = []
    seen = set()
    for st in storage:
        key = ((st.get("mountpoint") or "").strip().lower(),
               (st.get("device") or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        uniq.append(st)

    return uniq


def collect_linux_ports_cross(c) -> list:
    """Collect listening ports on any Linux."""
    ports = []
    seen  = set()

    COMMON_SERVICES = {
        22:"SSH",80:"HTTP",443:"HTTPS",3306:"MySQL",5432:"PostgreSQL",
        6379:"Redis",27017:"MongoDB",8080:"HTTP-Alt",8443:"HTTPS-Alt",
        9090:"Prometheus",9200:"Elasticsearch",2181:"ZooKeeper",
        2379:"etcd",2380:"etcd",6443:"Kubernetes",10250:"Kubelet",
        5672:"RabbitMQ",15672:"RabbitMQ-UI",9092:"Kafka",
        3000:"Grafana",9000:"SonarQube",8081:"Nexus",
        111:"RPC",2049:"NFS",445:"SMB",139:"NetBIOS",
        25:"SMTP",587:"SMTP-TLS",993:"IMAPS",995:"POP3S",
        53:"DNS",123:"NTP",161:"SNMP",
        4848:"GlassFish",8888:"Jupyter",11211:"Memcached",
    }

    # Try ss first (iproute2 — available on all modern distros)
    ss_out = run(c, "ss -tlnp 2>/dev/null")
    if ss_out and "LISTEN" in ss_out:
        import re
        for line in ss_out.splitlines():
            if "LISTEN" not in line:
                continue
            # Address column: *:22 or 0.0.0.0:22 or [::]:22
            m = re.search(r'[:\*](\d+)\s', line)
            if not m:
                m = re.search(r'[\s:](\d+)$', line.split("LISTEN")[-1].strip().split()[0] if line.split("LISTEN") else "")
            if not m:
                # parse the Local Address:Port column
                parts = line.split()
                for p in parts:
                    pm = re.search(r':(\d+)$', p)
                    if pm:
                        m = pm; break
            if m:
                try:
                    port = int(m.group(1))
                    if port not in seen:
                        seen.add(port)
                        proc = re.search(r'\"([^\"]+)\"', line)
                        svc = COMMON_SERVICES.get(port, proc.group(1) if proc else "")
                        ports.append({"port": port, "service": svc, "state": "LISTEN"})
                except Exception:
                    pass
    
    # Fallback: netstat (old RHEL 6, Alpine, etc.)
    if not ports:
        ns_out = run(c, "netstat -tlnp 2>/dev/null || netstat -tln 2>/dev/null")
        import re
        for line in (ns_out or "").splitlines():
            if "LISTEN" not in line:
                continue
            parts = line.split()
            for p in parts:
                m = re.search(r':(\d+)$', p)
                if m:
                    try:
                        port = int(m.group(1))
                        if port not in seen:
                            seen.add(port)
                            ports.append({"port": port, "service": COMMON_SERVICES.get(port, ""),
                                         "state": "LISTEN"})
                    except Exception:
                        pass
                    break

    # Last fallback: /proc/net/tcp + /proc/net/tcp6 (always available)
    if not ports:
        for fname in ["/proc/net/tcp", "/proc/net/tcp6"]:
            tcp_out = run(c, f"cat {fname} 2>/dev/null")
            for line in (tcp_out or "").splitlines()[1:]:
                parts = line.split()
                if len(parts) < 4:
                    continue
                # State 0A = LISTEN
                if parts[3] != "0A":
                    continue
                try:
                    # local_address = hex_ip:hex_port
                    port = int(parts[1].split(":")[1], 16)
                    if port not in seen:
                        seen.add(port)
                        ports.append({"port": port, "service": COMMON_SERVICES.get(port, ""),
                                     "state": "LISTEN"})
                except Exception:
                    pass

    return sorted(ports, key=lambda x: x["port"])


def detect_pkg_manager(c) -> str:
    """Detect package manager on any Linux distro."""
    # Check binaries directly — faster and more reliable than 'which'
    checks = [
        ("apt-get",  "apt"),
        ("apt",      "apt"),
        ("dnf",      "dnf"),
        ("yum",      "yum"),
        ("zypper",   "zypper"),
        ("apk",      "apk"),
        ("pacman",   "pacman"),
        ("emerge",   "emerge"),
        ("xbps-install", "xbps"),
    ]
    for binary, name in checks:
        result = run(c, f"command -v {binary} 2>/dev/null || type {binary} 2>/dev/null | head -1")
        if result and binary in result:
            return name
    return "unknown"


def collect_patch_cross(host: dict) -> dict:
    """Collect patch info on any Linux distro."""
    try:
        c = ssh_connect(host)
        try:
            os_i   = detect_os_cross(c)
            mgr    = detect_pkg_manager(c)
            updates = security = 0
            latest_k = last_p = "N/A"

            if mgr == "apt":
                # Ubuntu, Debian, Mint, Pop!_OS, etc.
                run(c, "apt-get update -qq 2>/dev/null || true")
                upd_raw  = run(c, "apt list --upgradable 2>/dev/null | grep -vc '^Listing' || echo 0")
                sec_raw  = run(c, "apt list --upgradable 2>/dev/null | grep -c security || echo 0")
                latest_k = run(c, "apt-cache show linux-image-$(uname -r | cut -d- -f1,2) 2>/dev/null | "
                                  "awk '/^Version/{print $2;exit}' || "
                                  "apt-cache search linux-image-generic 2>/dev/null | awk 'NR==1{print $1}' || echo N/A")
                last_p   = run(c, "awk '/install |upgrade /{print $1\" \"$2;exit}' /var/log/dpkg.log 2>/dev/null || echo N/A")
                try: updates  = max(0, int(upd_raw))
                except Exception: updates = 0
                try: security = max(0, int(sec_raw))
                except Exception: security = 0

            elif mgr in ("dnf", "yum"):
                # RHEL, CentOS, Fedora, Rocky, Alma, Oracle, Amazon Linux
                # yum/dnf check-update exits 100 when updates available — normal
                upd_raw  = run_tolerant(c, f"{mgr} check-update 2>/dev/null | grep -c '^[a-zA-Z]' || echo 0", timeout=90)
                sec_raw  = run_tolerant(c, f"{mgr} updateinfo list security 2>/dev/null | "
                                          "grep -c 'Important\\|Critical\\|Security' || echo 0", timeout=60)
                latest_k = run(c, "rpm -q --last kernel 2>/dev/null | head -1 | awk '{print $1}' | "
                                  "sed 's/kernel-//' || echo N/A")
                last_p   = run(c, "rpm -qa --last 2>/dev/null | head -1 | awk '{print $2,$3,$4}' || "
                                  r"awk '/Updated:/{print $2,$3,$4,$5;exit}' /var/log/yum.log 2>/dev/null || echo N/A")
                try: updates  = max(0, int(upd_raw))
                except Exception: updates = 0
                try: security = max(0, int(sec_raw))
                except Exception: security = 0

            elif mgr == "zypper":
                # SLES, openSUSE
                upd_raw  = run(c, "zypper --non-interactive lu 2>/dev/null | grep -c '|' || echo 0")
                sec_raw  = run(c, "zypper --non-interactive lp 2>/dev/null | grep -c -i security || echo 0")
                latest_k = run(c, "zypper search -i 'kernel-default' 2>/dev/null | awk '/kernel-default/{print $4;exit}' || echo N/A")
                last_p   = "N/A"
                try: updates  = max(0, int(upd_raw))
                except Exception: updates = 0
                try: security = max(0, int(sec_raw))
                except Exception: security = 0

            elif mgr == "apk":
                # Alpine Linux
                run(c, "apk update 2>/dev/null || true")
                upd_raw  = run(c, "apk version 2>/dev/null | grep -c '<' || echo 0")
                sec_raw  = run(c, "apk audit 2>/dev/null | wc -l || echo 0")
                latest_k = run(c, "apk info linux-lts 2>/dev/null | head -1 || echo N/A")
                last_p   = run(c, "awk 'END{print $1,$2}' /var/log/apk/world 2>/dev/null || "
                                  "stat -c '%y' /lib/apk/db/installed 2>/dev/null | cut -d. -f1 || echo N/A")
                try: updates  = max(0, int(upd_raw))
                except Exception: updates = 0
                try: security = max(0, int(sec_raw))
                except Exception: security = 0

            elif mgr == "pacman":
                # Arch Linux, Manjaro
                run(c, "pacman -Sy 2>/dev/null || true")
                upd_raw  = run(c, "pacman -Qu 2>/dev/null | wc -l || echo 0")
                sec_raw  = "0"
                latest_k = run(c, "pacman -Qi linux 2>/dev/null | awk '/^Version/{print $3;exit}' || echo N/A")
                last_p   = run(c, "tail -1 /var/log/pacman.log 2>/dev/null | awk '{print $1,$2}' || echo N/A")
                try: updates  = max(0, int(upd_raw))
                except Exception: updates = 0

            elif mgr == "emerge":
                # Gentoo
                upd_raw  = run(c, "emerge -puDN @world 2>/dev/null | grep -c ebuild || echo 0")
                security = 0
                latest_k = "N/A"; last_p = "N/A"
                try: updates = max(0, int(upd_raw))
                except Exception: updates = 0

            elif mgr == "xbps":
                # Void Linux
                run(c, "xbps-install -S 2>/dev/null || true")
                upd_raw  = run(c, "xbps-install -un 2>/dev/null | wc -l || echo 0")
                security = 0
                try: updates = max(0, int(upd_raw))
                except Exception: updates = 0
                latest_k = "N/A"; last_p = "N/A"

        finally:
            c.close()

        status = "CRITICAL UPDATE" if security > 0 else ("UPDATE AVAILABLE" if updates > 0 else "UP TO DATE")
        return {
            "host_id": host["id"], "host": host["name"],
            "os": os_i["os_pretty"], "os_name": os_i["os_name"], "os_version": os_i["os_version"],
            "kernel": os_i["kernel"], "arch": os_i["arch"],
            "latest_kernel": latest_k or "N/A",
            "last_patch": last_p or "N/A",
            "updates_available": updates,
            "security_updates": security,
            "pkg_manager": mgr,
            "status": status,
            "source": "live",
        }
    except Exception as e:
        return {"host_id": host["id"], "host": host["name"],
                "os": "Unreachable", "kernel": "N/A", "pkg_manager": "unknown",
                "status": "UNKNOWN", "source": "error", "reason": str(e)[:200]}


def _ensure_ntp_sync(c) -> None:
    """
    Silently configure NTP on the target host if not already using
    ntp.tpcentralodisha.com. Runs best-effort — never raises.
    This ensures all log timestamps from target hosts are in IST.
    """
    NTP_SERVER = "ntp.tpcentralodisha.com"
    try:
        # Check if already configured
        existing = (run(c, f"grep -r {NTP_SERVER} /etc/ntp.conf /etc/chrony.conf "
                         f"/etc/chrony.d/ /etc/systemd/timesyncd.conf 2>/dev/null | head -1") or "").strip()
        if existing:
            return  # Already configured

        # Try chrony first (RHEL 7+, Ubuntu 20+)
        has_chrony = (run(c, "which chronyd 2>/dev/null || which chronyc 2>/dev/null") or "").strip()
        if has_chrony:
            run(c, f"grep -q 'ntp.tpcentralodisha.com' /etc/chrony.conf 2>/dev/null || "
                   f"echo 'server ntp.tpcentralodisha.com iburst' >> /etc/chrony.conf && "
                   f"systemctl restart chronyd 2>/dev/null || true")
            return

        # Try ntpd (older systems)
        has_ntp = (run(c, "which ntpd 2>/dev/null") or "").strip()
        if has_ntp:
            run(c, f"grep -q 'ntp.tpcentralodisha.com' /etc/ntp.conf 2>/dev/null || "
                   f"echo 'server ntp.tpcentralodisha.com iburst' >> /etc/ntp.conf && "
                   f"systemctl restart ntpd 2>/dev/null || service ntp restart 2>/dev/null || true")
            return

        # Try systemd-timesyncd (Ubuntu/Debian)
        run(c, f"sed -i 's/^#*NTP=.*/NTP=ntp.tpcentralodisha.com/' /etc/systemd/timesyncd.conf 2>/dev/null; "
               f"grep -q '^NTP=' /etc/systemd/timesyncd.conf 2>/dev/null || "
               f"echo 'NTP=ntp.tpcentralodisha.com' >> /etc/systemd/timesyncd.conf 2>/dev/null; "
               f"timedatectl set-ntp true 2>/dev/null; "
               f"systemctl restart systemd-timesyncd 2>/dev/null || true")
    except Exception:
        pass  # NTP config is best-effort


def collect_linux_metrics(host: dict) -> dict:
    c = None
    try:
        c = ssh_connect(host)
        # Ensure NTP is configured to use the organisation NTP server
        # so that log timestamps from this host are accurate IST
        _ensure_ntp_sync(c)

        def safe_run(cmd, timeout=30):
            """Run command, return empty string on any error including closed transport."""
            try:
                if c is None or not c.get_transport() or not c.get_transport().is_active():
                    return ""
                _, out, _ = c.exec_command(cmd, timeout=timeout)
                return out.read().decode(errors="ignore").strip()
            except Exception:
                return ""

        # ── Batch 1: fast /proc reads (all in one compound command) ──────
        batch1 = safe_run(
            "echo '---CPU---' && head -1 /proc/stat && "
            "echo '---RAM---' && free -k && "
            "echo '---DISK---' && df / && "
            "echo '---NET---' && awk 'NR>2{rx+=$2;tx+=$10}END{printf \"%.2f %.2f\",rx/1024/1024,tx/1024/1024}' /proc/net/dev && "
            "echo '---LOAD---' && cat /proc/loadavg && "
            "echo '---UPTIME---' && (uptime -p 2>/dev/null || uptime) && "
            "echo '---LSCPU---' && lscpu 2>/dev/null && "
            "echo '---END---'"
        )

        # Parse batch1
        section = ""
        sections = {}
        for line in batch1.splitlines():
            if line.startswith("---") and line.endswith("---"):
                section = line.strip("-")
                sections[section] = []
            elif section:
                sections[section].append(line)

        def sec(name): return "\n".join(sections.get(name, []))

        # CPU %
        cpu = 0.0
        try:
            vals = list(map(int, sec("CPU").split()[1:]))
            idle = vals[3]; total = sum(vals)
            cpu = round((1 - idle/total)*100, 1) if total else 0.0
        except Exception: pass

        # RAM
        ram = 0.0; ram_total_mb_val = 0
        for line in sec("RAM").splitlines():
            if line.startswith("Mem:"):
                parts = line.split()
                try:
                    total_kb = int(parts[1])
                    avail_kb = int(parts[6]) if len(parts) >= 7 else int(parts[2])
                    ram = round((total_kb - avail_kb) / total_kb * 100, 1) if total_kb else 0
                    ram_total_mb_val = total_kb  # already in kB from free -k
                except Exception: pass

        # Disk %
        disk_str = ""
        for line in sec("DISK").splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 5:
                disk_str = parts[4].rstrip("%")
                break

        # Net
        np = sec("NET").split()

        # Load
        load_val = sec("LOAD").split()[0] if sec("LOAD") else "0"

        # Uptime
        up_val = sec("UPTIME") or "N/A"

        # lscpu — parse hardware info
        hw_raw = {}
        for line in sec("LSCPU").splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                hw_raw[k.strip()] = v.strip()

        def safe_int(v, d=0):
            try: return int(str(v).strip())
            except Exception: return d

        cpu_sockets     = safe_int(hw_raw.get("Socket(s)", hw_raw.get("Sockets", 1)), 1)
        cpu_cores_per   = safe_int(hw_raw.get("Core(s) per socket", hw_raw.get("Cores per socket", 0)), 0)
        cpu_threads_per = safe_int(hw_raw.get("Thread(s) per core", 1), 1)
        cpu_logical     = safe_int(hw_raw.get("CPU(s)", 0), 0)
        cpu_physical_cores = cpu_sockets * cpu_cores_per if cpu_cores_per else (cpu_logical // max(cpu_threads_per, 1))
        cpu_vcpu_capacity  = cpu_physical_cores * cpu_threads_per

        # RAM totals
        try:
            ram_total_gb = round(ram_total_mb_val / 1024 / 1024, 1)
        except Exception:
            ram_total_gb = 0

        # ── Batch 2: OS info ─────────────────────────────────────────────
        os_i = detect_os_cross(c) if (c and c.get_transport() and c.get_transport().is_active()) else {}

        # ── Batch 3: storage (separate call — complex output) ────────────
        storage = []
        try:
            if c and c.get_transport() and c.get_transport().is_active():
                storage = collect_linux_storage_cross(c)
        except Exception: pass

        # ── Batch 4: ports ───────────────────────────────────────────────
        active_ports = []
        try:
            if c and c.get_transport() and c.get_transport().is_active():
                active_ports = collect_linux_ports_cross(c)
        except Exception: pass

        # ── Batch 5: NICs ────────────────────────────────────────────────
        nics = []
        try:
            if c and c.get_transport() and c.get_transport().is_active():
                nics = collect_linux_nics_cross(c)
        except Exception: pass

        def safe_float(v):
            try: return round(float(str(v).strip()), 1) if v else 0.0
            except Exception: return 0.0

        def safe_pct(v):
            try: return min(100.0, max(0.0, round(float(str(v).strip()), 1)))
            except Exception: return 0.0

        # Derive disk% from storage array root volume
        root_vol = next((s for s in storage if s.get("mountpoint") == "/"), None)
        disk_pct = root_vol["use_pct"] if root_vol else safe_pct(disk_str)

        local_storage_total_gb = sum(
            s.get("size_gb", 0) for s in storage
            if s.get("type") not in ("NFS/CIFS", "iSCSI/SAN", "SAN (FC/SAS)")
        )
        local_storage_used_gb = sum(
            s.get("used_gb", 0) for s in storage
            if s.get("type") not in ("NFS/CIFS", "iSCSI/SAN", "SAN (FC/SAS)")
        )

        hardware = {
            "cpu_sockets":            cpu_sockets,
            "cpu_cores_per_socket":   cpu_cores_per,
            "cpu_threads_per_core":   cpu_threads_per,
            "cpu_physical_cores":     cpu_physical_cores,
            "cpu_vcpu_capacity":      cpu_vcpu_capacity,
            "cpu_logical":            cpu_logical,
            "cpu_model":              hw_raw.get("Model name", hw_raw.get("Model Name",""))[:80],
            "cpu_arch":               hw_raw.get("Architecture",""),
            "cpu_mhz":                hw_raw.get("CPU MHz", hw_raw.get("CPU max MHz","")),
            "ram_total_gb":           ram_total_gb,
            "local_storage_total_gb": round(local_storage_total_gb, 1),
            "local_storage_used_gb":  round(local_storage_used_gb, 1),
        }

        return {
            "cpu":          safe_pct(cpu),
            "ram":          min(100.0, max(0.0, round(ram, 1))),
            "disk":         disk_pct,
            "ram_total_gb": ram_total_gb,
            "hardware":     hardware,
            "net_in":       safe_float(np[0] if np else 0),
            "net_out":      safe_float(np[1] if len(np) > 1 else 0),
            "load":         safe_float(load_val),
            "uptime":       up_val[:60],
            "os_info":      os_i,
            "storage":      storage,
            "active_ports": active_ports,
            "nics":         nics,
            "updated_at":   datetime.now(timezone.utc).isoformat(),
            "source":       "live",
        }

    except Exception as e:
        return {
            "source":     "error",
            "reason":     str(e)[:300],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        try:
            if c: c.close()
        except Exception:
            pass



# ─────────────────────────────────────────────────────────────────────────────
# Linux patch
# ─────────────────────────────────────────────────────────────────────────────

def collect_kvm_vms(host: dict) -> list:
    try:
        c = ssh_connect(host)
        try:
            names_raw = run(c, "virsh list --all --name 2>/dev/null")
            if not names_raw or "error" in names_raw.lower():
                return []

            vm_names = []
            for name in names_raw.splitlines():
                cleaned = name.strip()
                if not cleaned or cleaned in ("-", "Name"):
                    continue
                vm_names.append(cleaned)

            vms = []
            for vname in vm_names:
                dom_state = (run(c, f"virsh domstate {vname} 2>/dev/null") or "").strip().lower()
                state = "running" if "running" in dom_state else "stopped"
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
                # IP detection for macvtap/direct-mode VMs
                # These VMs bypass the hypervisor network stack so ARP/neighbour
                # on the host is empty. Strategy:
                # 1. Try virsh domifaddr (works if guest agent or libvirt DHCP)
                # 2. Try host ARP/neigh (works for bridge/nat mode)
                # 3. Ping-sweep the host's subnets to populate ARP on the host,
                #    then re-check — macvtap VMs ARE visible from the same L2 segment
                # 4. Try nmap if available (most reliable for macvtap)

                iflist_raw = run(c, f"virsh domiflist {vname} 2>/dev/null")
                vm_macs = []
                for il in iflist_raw.splitlines()[2:]:
                    ilp = il.split()
                    if len(ilp) >= 5 and ilp[4] not in ("-", ""):
                        vm_macs.append(ilp[4])

                def find_ip_by_mac(mac):
                    """Check ARP + neigh tables for this MAC."""
                    for cmd in [f"arp -n 2>/dev/null | grep -i '{mac}' | awk '{{print $1}}'",
                                f"ip neigh 2>/dev/null | grep -i '{mac}' | awk '{{print $1}}'"]:
                        out = (run(c, cmd) or "").strip()
                        for candidate in out.splitlines():
                            candidate = candidate.strip()
                            if candidate and candidate not in ("-","") \
                               and not candidate.startswith("192.168.122."):  # skip libvirt NAT
                                return candidate
                    return ""

                vm_ip = ""

                # Step 1: virsh domifaddr
                ip_raw = run(c, f"virsh domifaddr {vname} 2>/dev/null | awk 'NR>2{{print $4}}' | grep -v '^-$' | cut -d/ -f1")
                for line in (ip_raw or "").splitlines():
                    line = line.strip()
                    if line and line not in ("-","") and not line.startswith("192.168.122."):
                        vm_ip = line
                        break
                if not vm_ip:
                    # Also accept 192.168.122.x as last resort
                    for line in (ip_raw or "").splitlines():
                        line = line.strip()
                        if line and line not in ("-",""):
                            vm_ip = line; break

                # Step 2: ARP / neigh table (works for bridge VMs)
                if not vm_ip:
                    for mac in vm_macs:
                        ip = find_ip_by_mac(mac)
                        if ip: vm_ip = ip; break

                # Step 3: For macvtap direct mode — ping-sweep the host's subnets
                # to populate the host's ARP cache, then re-check
                if not vm_ip and vm_macs:
                    # Get host's network interfaces and subnets
                    host_nets = run(c, "ip -o -4 addr show 2>/dev/null | awk '{print $4}' | grep -v '127\\.' | grep -v '192\\.168\\.122\\.'")
                    for net in (host_nets or "").splitlines():
                        net = net.strip()
                        if not net: continue
                        # Ping sweep the subnet (fast, parallel, no output needed)
                        run(c, f"nmap -sn {net} -T4 2>/dev/null || "
                               f"fping -a -q -g {net} 2>/dev/null || "
                               f"ping -c 1 -W 1 -b {net.rsplit('.',1)[0]+'.255'} 2>/dev/null || true")
                    # Now re-check ARP/neigh
                    for mac in vm_macs:
                        ip = find_ip_by_mac(mac)
                        if ip: vm_ip = ip; break

                # Step 4: nmap MAC-based scan on all host subnets
                if not vm_ip and vm_macs:
                    host_nets = run(c, "ip -o -4 addr show 2>/dev/null | awk '{print $4}' | grep -v '127\\.' | grep -v '192\\.168\\.122\\.'")
                    for net in (host_nets or "").splitlines():
                        net = net.strip()
                        if not net: continue
                        for mac in vm_macs:
                            nmap_out = run(c, f"nmap -sn {net} 2>/dev/null | grep -B1 -i '{mac}' | grep 'Nmap scan' | awk '{{print $NF}}'", timeout=60)
                            nmap_ip = (nmap_out or "").strip().strip("()")
                            if nmap_ip and nmap_ip not in ("-",""):
                                vm_ip = nmap_ip; break
                        if vm_ip: break

                vm_ip = vm_ip or "N/A"


                # Per-VM NICs — reuse iflist_raw
                vm_nics = []
                for il in iflist_raw.splitlines()[2:]:
                    ilp = il.split()
                    if len(ilp) >= 5:
                        nic_mac = ilp[4]
                        nic_ip = vm_ip if len(vm_nics) == 0 else ""
                        if len(vm_nics) > 0:
                            a = run(c, f"arp -n 2>/dev/null | grep -i '{nic_mac}' | awk '{{print $1}}' | head -1")
                            nic_ip = (a or "").strip()
                        vm_nics.append({
                            "name": ilp[0], "type": ilp[1], "source": ilp[2],
                            "model": ilp[3], "mac": nic_mac,
                            "ipv4": nic_ip,
                            "state": "up" if state == "running" else "down",
                            "rx_mb": 0, "tx_mb": 0,
                        })
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
    Connect via WinRM using NTLM authentication.

    Transport choice:
    ─────────────────────────────────────────────────────────────────────────────
    • ntlm   — works from any Linux server to any Windows host, domain-joined or
               not. Requires pywinrm[security] (requests-ntlm). DEFAULT.
    • basic  — only works if WinRM AllowUnencrypted=true is set on the target.
               Avoid in production.
    • negotiate — requires requests-kerberos which is NOT installed by default.
               Will raise "unsupported auth method" if that lib is missing.

    ServerCapacity server does NOT need to be domain-joined.
    NTLM works purely machine-to-machine — the Windows host validates credentials
    against its own DC. Different Discoms with different AD domains work fine.

    Domain account format (auto-applied when 'domain' field is set):
      TPCODL\\inframonitor   (NetBIOS — used automatically)

    Local account format:
      Administrator  or  .\\Administrator
    ─────────────────────────────────────────────────────────────────────────────
    """
    try:
        import winrm
    except ImportError:
        raise ConnectionError("pywinrm not installed — run: pip install pywinrm[security]")

    ip         = host["ip"]
    port       = int(host.get("winrm_port") or 5985)
    user       = (host.get("username") or "Administrator").strip()
    pwd        = host.get("password") or ""
    domain     = (host.get("domain") or "").strip()
    # Always use ntlm — negotiate requires requests-kerberos which may not be installed
    # ntlm works perfectly for both domain and local accounts without domain join
    transport  = "ntlm"

    # ── Build fully-qualified username ────────────────────────────────────────
    if domain and "\\" not in user and "@" not in user:
        # Auto-prepend NetBIOS domain name (first component before any dot)
        netbios = domain.split(".")[0].upper()
        fq_user = f"{netbios}\\{user}"
    else:
        fq_user = user  # already qualified, or local account

    http_url  = f"http://{ip}:{port}/wsman"
    https_url = f"https://{ip}:5986/wsman"

    # Try candidates: NTLM HTTP, NTLM HTTPS, then basic HTTP as last resort
    # For local accounts without domain, also try .\username variant
    user_variants = [fq_user]
    if not domain and "\\" not in fq_user and "@" not in fq_user:
        user_variants.append(".\\" + fq_user)

    candidates = []
    for u in user_variants:
        candidates.append((http_url,  "ntlm",  u))
    for u in user_variants:
        candidates.append((https_url, "ntlm",  u))
    # Basic as absolute last resort (only works if WinRM AllowUnencrypted=true)
    candidates.append((http_url, "basic", fq_user))

    errors = {}
    for url, t, uname in candidates:
        key = f"{t}({uname})@{ip}:{port}"
        try:
            s = winrm.Session(
                url, auth=(uname, pwd),
                transport=t,
                server_cert_validation="ignore",
                operation_timeout_sec=30,
                read_timeout_sec=35,
            )
            r = s.run_cmd("echo ok")
            if r.status_code == 0:
                import logging
                logging.getLogger(__name__).info(
                    f"[WinRM] Connected {ip}:{port} transport={t} user={uname}"
                )
                return s
            stderr = r.std_err.decode(errors="ignore").strip()[:150]
            if stderr:
                errors[key] = stderr
        except Exception as exc:
            err_msg = str(exc)
            # Don't bother retrying HTTPS if port 5986 is clearly not open
            if "5986" in url and any(x in err_msg for x in ["Connection refused", "timed out", "No route"]):
                continue
            # Skip if this is a transport-level "unsupported" error — no point retrying same
            if "unsupported" in err_msg.lower():
                errors[key] = err_msg[:150]
                continue
            errors[key] = err_msg[:150]

    # ── Clear, actionable error message ───────────────────────────────────────
    err_lines = [
        f"WinRM connection to {ip}:{port} failed.",
        "",
        "Run these commands on the Windows host (as Administrator):",
        "",
        "  # 1. Enable WinRM",
        "  Enable-PSRemoting -Force",
        "",
        "  # 2. Trust the ServerCapacity server IP (or use * for all)",
        "  Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value '192.168.101.80' -Force",
        "",
        "  # 3. Open firewall",
        "  New-NetFirewallRule -Name WinRM-HTTP -Protocol TCP -LocalPort 5985 -Action Allow",
        "",
        "  # 4. Confirm WinRM is listening",
        "  Test-WSMan -ComputerName localhost",
        "",
    ]
    if domain:
        netbios = domain.split(".")[0].upper()
        err_lines += [
            f"Credentials used: {netbios}\\{user}  (NTLM, domain auto-applied)",
            "If credentials are wrong, update username/password and retry.",
        ]
    else:
        err_lines += [
            f"Credentials used: local account '{fq_user}'",
            "For domain accounts: enter the AD Domain in the host settings.",
        ]
    if errors:
        err_lines += ["", "Errors seen:"]
        for k, v in list(errors.items())[:3]:
            err_lines.append(f"  [{k}] {v}")

    raise ConnectionError("\n".join(err_lines))


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

def _run_ps_lines(s, script: str) -> list:
    """Run PowerShell script and return non-empty stdout lines."""
    r = s.run_ps(script)
    if r.status_code != 0:
        raise Exception(r.std_err.decode(errors="ignore").strip()[:300])
    raw = r.std_out.decode(errors="ignore")
    if not raw:
        return []
    return [ln.strip() for ln in raw.splitlines() if ln.strip()]

def _run_cmd_text(s, cmd: str, args=None) -> str:
    """Run a remote command and return stdout text."""
    r = s.run_cmd(cmd, args or [])
    if r.status_code != 0:
        raise Exception(r.std_err.decode(errors="ignore").strip()[:300])
    return r.std_out.decode(errors="ignore")


# ─────────────────────────────────────────────────────────────────────────────
# Windows metrics
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_metrics(host: dict) -> dict:
    try:
        s = _winrm_connect(host)
        d = _run_ps(s, r"""
$cpu = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$cpuInfo = Get-WmiObject Win32_Processor
$cpuSockets = @($cpuInfo | Select-Object -ExpandProperty SocketDesignation -ErrorAction SilentlyContinue | Where-Object { $_ -and $_.ToString().Trim() -ne "" } | Select-Object -Unique).Count
if(-not $cpuSockets -or $cpuSockets -lt 1) { $cpuSockets = @($cpuInfo).Count }
$cpuCores = (@($cpuInfo | Measure-Object -Property NumberOfCores -Sum).Sum)
$cpuLogical = (@($cpuInfo | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
$mem = Get-WmiObject Win32_OperatingSystem
$ramPct = if($mem.TotalVisibleMemorySize -gt 0) {
  [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize * 100, 1)
} else { 0 }
$comp = Get-WmiObject Win32_ComputerSystem
$ramTotalGB = if($comp.TotalPhysicalMemory -gt 0) { [math]::Round($comp.TotalPhysicalMemory / 1GB, 1) } else { [math]::Round($mem.TotalVisibleMemorySize / 1MB, 1) }
$localDisks = Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 -and $_.Size -gt 0 }
$localStorageTotalGB = [math]::Round((($localDisks | Measure-Object -Property Size -Sum).Sum) / 1GB, 1)
$localStorageUsedGB = [math]::Round(((($localDisks | Measure-Object -Property Size -Sum).Sum - ($localDisks | Measure-Object -Property FreeSpace -Sum).Sum) / 1GB), 1)
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
    cpu_model = if($cpuInfo -and $cpuInfo[0]) { $cpuInfo[0].Name } else { "" }
    cpu_sockets = [int]$cpuSockets
    cpu_physical_cores = [int]$cpuCores
    cpu_logical = [int]$cpuLogical
    cpu_threads_per_core = if($cpuCores -gt 0) { [math]::Max(1, [int][math]::Round($cpuLogical / $cpuCores, 0)) } else { 1 }
    ram_total_gb = $ramTotalGB
    local_storage_total_gb = if($localStorageTotalGB -gt 0) { $localStorageTotalGB } else { 0 }
    local_storage_used_gb  = if($localStorageUsedGB -gt 0)  { $localStorageUsedGB }  else { 0 }
} | ConvertTo-Json""")
        if not isinstance(d, dict):
            raise Exception(f"Unexpected PS output: {str(d)[:200]}")
        def _clamp(v):
            try: return min(100.0, max(0.0, round(float(v or 0), 1)))
            except: return 0.0
        cpu_sockets = int(d.get("cpu_sockets") or 1)
        cpu_physical_cores = int(d.get("cpu_physical_cores") or 0)
        cpu_logical = int(d.get("cpu_logical") or 0)
        cpu_threads_per_core = int(d.get("cpu_threads_per_core") or 1)
        if cpu_physical_cores <= 0 and cpu_logical > 0:
            cpu_physical_cores = max(1, cpu_logical // max(cpu_threads_per_core, 1))
        cpu_vcpu_capacity = cpu_logical or (cpu_physical_cores * max(cpu_threads_per_core, 1))
        ram_total_gb = round(float(d.get("ram_total_gb") or 0), 1)
        local_storage_total_gb = round(float(d.get("local_storage_total_gb") or 0), 1)
        local_storage_used_gb = round(float(d.get("local_storage_used_gb") or 0), 1)
        return {
            "cpu":     _clamp(d.get("cpu")),
            "ram":     _clamp(d.get("ram")),
            "disk":    _clamp(d.get("disk")),
            "ram_total_gb": ram_total_gb,
            "net_in":  round(float(d.get("net_in")  or 0), 2),
            "net_out": round(float(d.get("net_out") or 0), 2),
            "load":    0,
            "uptime":  d.get("uptime", "N/A"),
            "hardware": {
                "cpu_sockets": cpu_sockets,
                "cpu_cores_per_socket": max(1, cpu_physical_cores // max(cpu_sockets, 1)) if cpu_physical_cores else 0,
                "cpu_threads_per_core": max(1, cpu_threads_per_core),
                "cpu_physical_cores": cpu_physical_cores,
                "cpu_vcpu_capacity": max(1, cpu_vcpu_capacity) if cpu_vcpu_capacity else 0,
                "cpu_logical": cpu_logical,
                "cpu_model": (d.get("cpu_model") or "")[:80],
                "cpu_arch": d.get("os_arch", "x64"),
                "cpu_mhz": "",
                "ram_total_gb": ram_total_gb,
                "local_storage_total_gb": local_storage_total_gb,
                "local_storage_used_gb": local_storage_used_gb,
            },
            "os_info": {
                "os_pretty":  d.get("os_name", "Windows"),
                "os_name":    d.get("os_name", "Windows"),
                "os_version": d.get("os_ver", ""),
                "kernel":     f"Build {d.get('os_build', '')}",
                "arch":       d.get("os_arch", "x64"),
                "hostname":   d.get("hostname", ""),
            },
            "storage":      collect_windows_storage(host, s=s),
            "active_ports": collect_windows_ports(host, s=s),
            "nics":         collect_windows_nics(host, s=s),
            "updated_at":   datetime.now(timezone.utc).isoformat(),
            "source":       "live",
        }
    except Exception as e:
        return {"source": "error", "reason": str(e)[:400],
                "updated_at": datetime.now(timezone.utc).isoformat()}


# ─────────────────────────────────────────────────────────────────────────────
# Windows storage
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_storage(host: dict, s=None) -> list:
    """Collect disk/storage info from Windows via WinRM."""
    try:
        s = s or _winrm_connect(host)
        data = _run_ps(s, r"""
function Get-AnyInstance([string]$ClassName, [string]$Filter = "") {
    if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
        try {
            if($Filter) { return Get-CimInstance -ClassName $ClassName -Filter $Filter -ErrorAction Stop }
            return Get-CimInstance -ClassName $ClassName -ErrorAction Stop
        } catch {}
    }
    try {
        if($Filter) { return Get-WmiObject -Class $ClassName -Filter $Filter -ErrorAction Stop }
        return Get-WmiObject -Class $ClassName -ErrorAction Stop
    } catch {
        return @()
    }
}

$disks = @(Get-AnyInstance "Win32_LogicalDisk") | Where-Object { $_.DriveType -eq 3 -and $_.Size -gt 0 }
$result = @()
foreach ($d in $disks) {
    try {
        $sizeRaw = [double]($d.Size)
        $freeRaw = [double]($d.FreeSpace)
        $total = [math]::Round($sizeRaw / 1GB, 2)
        $free  = [math]::Round($freeRaw / 1GB, 2)
        $used  = [math]::Round($total - $free, 2)
        $pct   = if ($sizeRaw -gt 0) { [math]::Round(($sizeRaw - $freeRaw) / $sizeRaw * 100, 1) } else { 0 }
        $result += [PSCustomObject]@{
            device     = $d.DeviceID
            mountpoint = $d.DeviceID
            type       = "local"
            model      = if($d.VolumeName) { $d.VolumeName } else { $d.DeviceID }
            size_gb    = $total
            used_gb    = $used
            avail_gb   = $free
            use_pct    = $pct
            total_gb   = $total
            free_gb    = $free
            pct_used   = $pct
            fstype     = $d.FileSystem
        }
    } catch {}
}
# include attached physical disks (SAN/local) for inventory visibility
foreach($pd in @(Get-AnyInstance "Win32_DiskDrive")) {
    try {
        $iface = "$($pd.InterfaceType)"
        $dtype = if($iface -match "iSCSI") { "iSCSI/SAN" }
                 elseif($iface -match "SAS|FC") { "SAN ($iface)" }
                 else { "local-physical" }
        $sz = [double]($pd.Size)
        $result += [PSCustomObject]@{
            device     = if($pd.DeviceID) { $pd.DeviceID } else { "$($pd.Index)" }
            mountpoint = "[physical]"
            type       = $dtype
            model      = "$($pd.Manufacturer) $($pd.Model)".Trim()
            size_gb    = if($sz -gt 0) { [math]::Round($sz/1GB, 2) } else { 0 }
            used_gb    = 0
            avail_gb   = if($sz -gt 0) { [math]::Round($sz/1GB, 2) } else { 0 }
            use_pct    = 0
            total_gb   = if($sz -gt 0) { [math]::Round($sz/1GB, 2) } else { 0 }
            free_gb    = if($sz -gt 0) { [math]::Round($sz/1GB, 2) } else { 0 }
            pct_used   = 0
            fstype     = "RAW"
        }
    } catch {}
}
$result | ConvertTo-Json""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        normalized = []
        for d in rows:
            if not isinstance(d, dict):
                continue
            size_gb = d.get("size_gb", d.get("total_gb", 0))
            avail_gb = d.get("avail_gb", d.get("free_gb", 0))
            use_pct = d.get("use_pct", d.get("pct_used", 0))
            normalized.append({
                "device": d.get("device", ""),
                "mountpoint": d.get("mountpoint", d.get("device", "")),
                "type": d.get("type", "local"),
                "model": d.get("model", ""),
                "fstype": d.get("fstype", ""),
                "size_gb": size_gb,
                "used_gb": d.get("used_gb", 0),
                "avail_gb": avail_gb,
                "use_pct": use_pct,
                # keep compatibility fields too
                "total_gb": d.get("total_gb", size_gb),
                "free_gb": d.get("free_gb", avail_gb),
                "pct_used": d.get("pct_used", use_pct),
            })
        return normalized
    except Exception as e:
        # Last-resort fallback for older/locked-down PowerShell environments.
        try:
            s2 = s or _winrm_connect(host)
            lines = _run_ps_lines(s2, r"""
Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  $vol = if($_.VolumeName){$_.VolumeName}else{$_.DeviceID}
  "$($_.DeviceID)|$vol|$($_.FileSystem)|$($_.Size)|$($_.FreeSpace)"
}""")
            rows = []
            for ln in lines:
                parts = ln.split("|", 4)
                if len(parts) != 5:
                    continue
                dev, vol, fs, size_raw, free_raw = parts
                try:
                    sz = float(size_raw or 0)
                    fr = float(free_raw or 0)
                except Exception:
                    sz, fr = 0.0, 0.0
                total = round(sz / (1024 ** 3), 2) if sz > 0 else 0
                free = round(fr / (1024 ** 3), 2) if fr > 0 else 0
                used = round(max(0.0, total - free), 2)
                pct = round(((sz - fr) / sz) * 100, 1) if sz > 0 else 0
                rows.append({
                    "device": dev,
                    "mountpoint": dev,
                    "type": "local",
                    "model": vol or dev,
                    "fstype": fs or "",
                    "size_gb": total,
                    "used_gb": used,
                    "avail_gb": free,
                    "use_pct": pct,
                    "total_gb": total,
                    "free_gb": free,
                    "pct_used": pct,
                })
            if rows:
                return rows
        except Exception:
            pass
        # Final fallback: avoid PowerShell entirely and query via WMIC.
        try:
            s3 = s or _winrm_connect(host)
            out = _run_cmd_text(
                s3,
                "wmic",
                ["logicaldisk", "where", "drivetype=3",
                 "get", "DeviceID,FileSystem,FreeSpace,Size,VolumeName", "/format:csv"],
            )
            rows = []
            for ln in out.splitlines():
                line = (ln or "").strip()
                if not line or line.lower().startswith("node,"):
                    continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 6:
                    continue
                dev = parts[1]
                fs = parts[2]
                free_raw = parts[3]
                size_raw = parts[4]
                vol = parts[5]
                try:
                    sz = float(size_raw or 0)
                    fr = float(free_raw or 0)
                except Exception:
                    sz, fr = 0.0, 0.0
                total = round(sz / (1024 ** 3), 2) if sz > 0 else 0
                free = round(fr / (1024 ** 3), 2) if fr > 0 else 0
                used = round(max(0.0, total - free), 2)
                pct = round(((sz - fr) / sz) * 100, 1) if sz > 0 else 0
                if dev:
                    rows.append({
                        "device": dev,
                        "mountpoint": dev,
                        "type": "local",
                        "model": vol or dev,
                        "fstype": fs or "",
                        "size_gb": total,
                        "used_gb": used,
                        "avail_gb": free,
                        "use_pct": pct,
                        "total_gb": total,
                        "free_gb": free,
                        "pct_used": pct,
                    })
            if rows:
                return rows
        except Exception:
            pass
        return [{"device": "C:", "mountpoint": "C:", "type": "local", "model": "C:",
                 "size_gb": 0, "used_gb": 0, "avail_gb": 0, "use_pct": 0,
                 "total_gb": 0, "free_gb": 0, "pct_used": 0,
                 "error": str(e)[:180]}]


def _collect_windows_nics_ps(host: dict, s=None):
    s = s or _winrm_connect(host)
    return _run_ps(s, r"""
function Get-AnyInstance([string]$ClassName, [string]$Filter = "") {
    if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
        try {
            if($Filter) { return Get-CimInstance -ClassName $ClassName -Filter $Filter -ErrorAction Stop }
            return Get-CimInstance -ClassName $ClassName -ErrorAction Stop
        } catch {}
    }
    try {
        if($Filter) { return Get-WmiObject -Class $ClassName -Filter $Filter -ErrorAction Stop }
        return Get-WmiObject -Class $ClassName -ErrorAction Stop
    } catch {
        return @()
    }
}

$nics = @()
$perfByName = @{}
try {
    @(Get-AnyInstance "Win32_PerfFormattedData_Tcpip_NetworkInterface") | ForEach-Object {
        $perfByName[$_.Name] = $_
    }
} catch {}

@(Get-AnyInstance "Win32_NetworkAdapterConfiguration") |
Where-Object { $_.IPEnabled -eq $true -and $_.MACAddress } |
ForEach-Object {
    try {
        $cfg = $_
        $adp = @(Get-AnyInstance "Win32_NetworkAdapter" "Index = $($cfg.Index)" | Select-Object -First 1)
        $name = if($adp -and $adp.NetConnectionID) { $adp.NetConnectionID } elseif($adp -and $adp.Name) { $adp.Name } else { $cfg.Description }
        if(-not $name) { $name = "NIC-$($cfg.Index)" }
        $state = "up"
        if($adp -and $adp.NetEnabled -eq $false) { $state = "down" }
        $speed = $null
        if($adp -and $adp.Speed) {
            try { $speed = [int][math]::Round([double]$adp.Speed / 1MB, 0) } catch { $speed = $null }
        }

        $p = $null
        if($perfByName.ContainsKey($cfg.Description)) {
            $p = $perfByName[$cfg.Description]
        } elseif($perfByName.ContainsKey($name)) {
            $p = $perfByName[$name]
        } else {
            $needle = "$($cfg.Description)"
            if($needle.Length -gt 12) { $needle = $needle.Substring(0,12) }
            if($needle) {
                $p = $perfByName.Values | Where-Object { $_.Name -like "*$needle*" } | Select-Object -First 1
            }
        }

        $nics += [PSCustomObject]@{
            name        = $name
            mac         = $cfg.MACAddress
            ipv4        = if($cfg.IPAddress){($cfg.IPAddress | Where-Object {$_ -match '^\d+\.\d+\.\d+\.\d+'} | Select-Object -First 1)}else{""}
            ipv6        = if($cfg.IPAddress){($cfg.IPAddress | Where-Object {$_ -match ':'} | Select-Object -First 1)}else{""}
            subnet      = if($cfg.IPSubnet){($cfg.IPSubnet | Select-Object -First 1)}else{""}
            gateway     = if($cfg.DefaultIPGateway){($cfg.DefaultIPGateway | Select-Object -First 1)}else{""}
            dhcp        = [bool]$cfg.DHCPEnabled
            state       = $state
            speed_mbps  = $speed
            rx_mb       = if($p){ [math]::Round([double]$p.BytesReceivedPersec / 1MB, 2) } else { 0 }
            tx_mb       = if($p){ [math]::Round([double]$p.BytesSentPersec / 1MB, 2) } else { 0 }
        }
    } catch {}
}
$nics | Sort-Object name | ConvertTo-Json""")


def collect_windows_nics(host: dict, s=None) -> list:
    try:
        s = s or _winrm_connect(host)
        data = _collect_windows_nics_ps(host, s=s)
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        mapped = [{"name": d.get("name",""), "mac": d.get("mac",""),
                   "ipv4": d.get("ipv4",""), "ipv6": d.get("ipv6",""),
                   "subnet": d.get("subnet",""), "gateway": d.get("gateway",""),
                   "dhcp": d.get("dhcp", False), "state": d.get("state","up"),
                   "speed_mbps": d.get("speed_mbps"),
                   "rx_mb": d.get("rx_mb",0), "tx_mb": d.get("tx_mb",0),
                   "rx_pkts": 0, "tx_pkts": 0, "rx_err": 0, "tx_err": 0}
                  for d in rows if isinstance(d, dict) and d.get("name")]
        if mapped:
            return mapped
        # Fallback: minimal NIC inventory from adapter configuration only.
        lines = _run_ps_lines(s, r"""
Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | ForEach-Object {
  $name=if($_.Description){$_.Description}else{"NIC-"+$_.Index}
  $ipv4=if($_.IPAddress){($_.IPAddress | Where-Object {$_ -match '^\d+\.\d+\.\d+\.\d+'} | Select-Object -First 1)}else{""}
  $ipv6=if($_.IPAddress){($_.IPAddress | Where-Object {$_ -match ':'} | Select-Object -First 1)}else{""}
  $sub=if($_.IPSubnet){$_.IPSubnet[0]}else{""}
  $gw=if($_.DefaultIPGateway){$_.DefaultIPGateway[0]}else{""}
  "$name|$($_.MACAddress)|$ipv4|$ipv6|$sub|$gw|$([bool]$_.DHCPEnabled)"
}""")
        rows2 = []
        for ln in lines:
            parts = ln.split("|", 6)
            if len(parts) != 7:
                continue
            name, mac, ipv4, ipv6, subnet, gateway, dhcp = parts
            if not name:
                continue
            rows2.append({"name": name, "mac": mac, "ipv4": ipv4, "ipv6": ipv6,
                          "subnet": subnet, "gateway": gateway,
                          "dhcp": str(dhcp).strip().lower() in ("true", "1", "yes")})
        if not rows2:
            # Final fallback via WMIC (no PowerShell parsing dependency).
            try:
                out = _run_cmd_text(
                    s,
                    "wmic",
                    ["nicconfig", "where", "IPEnabled=true", "get",
                     "Description,MACAddress,DHCPEnabled,DefaultIPGateway,IPAddress,IPSubnet", "/format:csv"],
                )
                for ln in out.splitlines():
                    line = (ln or "").strip()
                    if not line or line.lower().startswith("node,"):
                        continue
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) < 7:
                        continue
                    name = parts[1]
                    mac = parts[2]
                    dhcp_raw = parts[3]
                    gw_raw = parts[4]
                    ip_raw = parts[5]
                    subnet_raw = parts[6]
                    ipv4 = ""
                    ipv6 = ""
                    for tok in ip_raw.replace("{", "").replace("}", "").replace('"', "").split(";"):
                        t = tok.strip()
                        if not t:
                            continue
                        if "." in t and not ipv4:
                            ipv4 = t
                        elif ":" in t and not ipv6:
                            ipv6 = t
                    gateway = gw_raw.replace("{", "").replace("}", "").replace('"', "").split(";")[0].strip() if gw_raw else ""
                    subnet = subnet_raw.replace("{", "").replace("}", "").replace('"', "").split(";")[0].strip() if subnet_raw else ""
                    if name:
                        rows2.append({
                            "name": name, "mac": mac, "ipv4": ipv4, "ipv6": ipv6,
                            "subnet": subnet, "gateway": gateway,
                            "dhcp": str(dhcp_raw).strip().lower() in ("true", "1", "yes")
                        })
            except Exception:
                pass
        if not rows2:
            # Last fallback: parse `ipconfig /all` text (works when WMI providers are restricted).
            try:
                txt = _run_cmd_text(s, "cmd", ["/c", "ipconfig", "/all"])
                current = None
                for ln in txt.splitlines():
                    line = (ln or "").rstrip()
                    if not line.strip():
                        continue
                    low = line.lower().strip()
                    if low.endswith(":") and "adapter" in low:
                        name = line.strip().rstrip(":")
                        current = {"name": name, "mac": "", "ipv4": "", "ipv6": "",
                                   "subnet": "", "gateway": "", "dhcp": False}
                        rows2.append(current)
                        continue
                    if not current:
                        continue
                    if ":" not in line:
                        continue
                    k, v = line.split(":", 1)
                    key = k.strip().lower()
                    val = v.strip()
                    if "physical address" in key and val:
                        current["mac"] = val.replace("-", ":")
                    elif "ipv4 address" in key and val:
                        current["ipv4"] = val.split("(")[0].strip()
                    elif key.startswith("subnet mask") and val:
                        current["subnet"] = val
                    elif key.startswith("default gateway") and val and not current["gateway"]:
                        current["gateway"] = val
                    elif "dhcp enabled" in key:
                        current["dhcp"] = val.lower().startswith("yes")
                    elif "ipv6 address" in key and val and not current["ipv6"]:
                        current["ipv6"] = val.split("(")[0].strip()
                rows2 = [r for r in rows2 if r.get("name")]
            except Exception:
                pass
        return [{"name": d.get("name",""), "mac": d.get("mac",""),
                 "ipv4": d.get("ipv4",""), "ipv6": d.get("ipv6",""),
                 "subnet": d.get("subnet",""), "gateway": d.get("gateway",""),
                 "dhcp": d.get("dhcp", False), "state": "up",
                 "speed_mbps": None, "rx_mb": 0, "tx_mb": 0,
                 "rx_pkts": 0, "tx_pkts": 0, "rx_err": 0, "tx_err": 0}
                for d in rows2 if d.get("name")]
    except Exception:
        return []
# ─────────────────────────────────────────────────────────────────────────────
# Windows active ports
# ─────────────────────────────────────────────────────────────────────────────

def collect_windows_ports(host: dict, s=None) -> list:
    try:
        s = s or _winrm_connect(host)
        data = _run_ps(s, r"""
try {
    Get-NetTCPConnection -State Listen | ForEach-Object {
        $proc = try { (Get-Process -Id $_.OwningProcess -EA SilentlyContinue).Name } catch { "unknown" }
        [PSCustomObject]@{ port=$_.LocalPort; proto="TCP"; process=if($proc){$proc}else{"unknown"}; state="LISTEN" }
    } | Sort-Object port | ConvertTo-Json
} catch {
    ,@() | ConvertTo-Json
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
        Storage   = ($stor | ConvertTo-Json -Compress)
        NICs      = ($nicList | ConvertTo-Json -Compress)
    }
} | ConvertTo-Json""")
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        vms = []
        for v in rows:
            # Hyper-V State: 2=Running, 3=Stopped, 6=Saved, 9=Paused, 10=Starting
            raw_state = str(v.get("State", "")).strip()
            state = "running" if raw_state.lower() in ("running", "2") else "stopped"
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
            # Determine VM OS type from OS field
            vm_os_raw = str(v.get("OS", "")).strip()
            vm_os_type = "windows" if "windows" in vm_os_raw.lower() else "linux"
            vms.append({
                "id":       f"vm-{host['id']}-{v['Name']}",
                "host_id":  host["id"],
                "name":     v["Name"], "type": "Hyper-V", "hypervisor": "Hyper-V",
                "status":   state, "ip": v.get("IP","N/A") or "N/A",
                "vcpu":     v.get("vCPU", 1), "ram_mb": v.get("RAM_MB", 0),
                "disk_gb":  v.get("Disk_GB", 0), "os": vm_os_raw or "Windows",
                "os_type":  vm_os_type,
                "storage":  stor, "nics": vm_nics,
                "metrics":  {
                    "cpu":    min(100.0, max(0.0, float(v.get("CPU") or 0))),
                    "ram":    min(100.0, max(0.0, round(v.get("RAM_MB",0)/max(v.get("MaxRAM_MB",1),1)*100,1))),
                    "disk":   0, "net_in": 0, "net_out": 0,
                    "source": "live" if state == "running" else "stopped",
                },
            })
        return vms
    except Exception as e:
        # Return error info so the API can surface it rather than silently failing
        import logging
        logging.getLogger(__name__).warning(f"collect_hyperv_vms failed for host {host.get('id')}: {e}")
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
# ─────────────────────────────────────────────────────────────────────────────
# Real vulnerability scan — uses the Trivy server pod in the cluster.
#
# Architecture:
#   InfraCommand backend  ──HTTP──▶  trivy-server.url-scanner.svc:4954
#
# Trivy server exposes a plain HTTP API at /twirp/... but the simplest
# integration is to SSH into the target host and run:
#   trivy rootfs --server http://trivy-server.url-scanner.svc.cluster.local:4954 #                --format json /
# This makes the TARGET call the Trivy server for its vuln DB lookups,
# then returns the full JSON result back over SSH to the backend.
#
# Trivy server URL is configurable via TRIVY_SERVER_URL env var in the
# backend Deployment (k8s/01-backend.yaml). Default uses the ClusterIP DNS name.
# ─────────────────────────────────────────────────────────────────────────────

import os as _os
import subprocess as _subprocess
import shutil as _shutil

# Internal URL — used by the backend pod to communicate with trivy-server
# (ClusterIP DNS, only works inside the cluster)
TRIVY_SERVER_URL = _os.environ.get(
    "TRIVY_SERVER_URL",
    "http://trivy-server.infracommand.svc.cluster.local:4954"
)

# External URL — used by TARGET HOSTS (KVM hypervisors, VMs) when they call
# trivy rootfs --server <URL>. Must be reachable from outside the cluster.
# Points to the NodePort service on the k8s node IP.
TRIVY_SERVER_EXTERNAL_URL = _os.environ.get(
    "TRIVY_SERVER_EXTERNAL_URL",
    "http://192.168.101.80:4954"
)

# When True, trivy-server uses cached DB only — no download attempted.
# Matches TRIVY_SKIP_DB_UPDATE in the trivy-config ConfigMap.
TRIVY_SKIP_DB_UPDATE = _os.environ.get("TRIVY_SKIP_DB_UPDATE", "false").lower() == "true"

SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}


def _parse_trivy_output(raw: str) -> list:
    """Parse trivy JSON output → normalised list of vuln dicts."""
    data = json.loads(raw)
    vulns = []
    for block in data.get("Results", []):
        for v in block.get("Vulnerabilities") or []:
            sev = v.get("Severity", "UNKNOWN").upper()
            if sev not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                sev = "LOW"
            # CVSS — prefer NVD V3, fall back to V2
            cvss = 0.0
            for src in ("nvd", "redhat", "ghsa"):
                sc = (v.get("CVSS") or {}).get(src, {})
                v3 = sc.get("V3Score")
                if isinstance(v3, (int, float)) and float(v3) > 0:
                    cvss = round(float(v3), 1)
                    break
                v2 = sc.get("V2Score")
                if isinstance(v2, (int, float)) and float(v2) > 0 and cvss == 0:
                    cvss = round(float(v2), 1)
            cve_id = v.get("VulnerabilityID", "")
            vulns.append({
                "id":       cve_id,
                "severity": sev,
                "cvss":     cvss,
                "pkg":      v.get("PkgName", "unknown"),
                "version":  v.get("InstalledVersion", ""),
                "fixed_in": v.get("FixedVersion", ""),
                "desc":     (v.get("Description") or v.get("Title") or "")[:200],
                "url":      f"https://nvd.nist.gov/vuln/detail/{cve_id}"
                            if cve_id.startswith("CVE-")
                            else (v.get("PrimaryURL") or ""),
                "source":   "Trivy/NVD",
            })
    # Sort CRITICAL → HIGH → MEDIUM → LOW, then CVSS desc
    vulns.sort(key=lambda x: (SEV_ORDER.get(x["severity"], 4), -x.get("cvss", 0)))
    return vulns


def _trivy_scan_via_server(host: dict, open_ports: list = None) -> list:
    """
    Scan a remote host for CVEs — OS core packages + port-correlated software only.

    Strategy:
      1. SSH → detect OS → fetch package DB (RPM/dpkg/apk)
      2. Filter packages: keep only server-relevant ones
         - OS core: kernel, glibc, openssl, systemd, ssh, network libs
         - Port-correlated: if port 22 open → keep openssh
                            if port 80/443 → keep httpd/nginx/apache
                            if port 3306 → keep mysql/mariadb  etc.
         - Exclude: desktop/GUI (firefox, gnome, gtk, qt, thunderbird, fonts)
      3. Build minimal fake rootfs with filtered packages only
      4. Scan via trivy-server → returns focused, actionable CVEs

    Target needs: SSH only. Zero dependencies installed.
    """
    import subprocess as _sp
    import tempfile, os as _os, shutil

    ip       = host.get("ip", "")
    username = host.get("username", "root")
    ssh_port = int(host.get("ssh_port") or 22)
    open_ports = open_ports or []
    open_port_numbers = {p.get("port") for p in open_ports if isinstance(p, dict)}

    if not ip or ip in ("N/A", ""):
        raise RuntimeError("No IP address for this target")

    LOCAL_TRIVY = _os.environ.get("TRIVY_BINARY_PATH", "/usr/local/bin/trivy")
    if not _os.path.exists(LOCAL_TRIVY):
        raise RuntimeError(
            "trivy binary not found on backend. "
            "Ensure Jenkins Stage 2 (setup.sh) has run to install trivy."
        )

    # ── Port → package pattern mapping ───────────────────────────────────────
    # Maps open ports to package name patterns that should be included
    PORT_PKG_MAP = {
        22:    ["openssh", "ssh", "libssh"],
        25:    ["postfix", "sendmail", "exim", "dovecot", "smtp"],
        53:    ["bind", "named", "dnsmasq", "unbound"],
        80:    ["httpd", "apache", "nginx", "lighttpd", "http"],
        443:   ["httpd", "apache", "nginx", "openssl", "mod_ssl", "http"],
        3306:  ["mysql", "mariadb"],
        5432:  ["postgresql", "postgres"],
        6379:  ["redis"],
        27017: ["mongodb", "mongo"],
        8080:  ["tomcat", "java", "jdk", "jre"],
        8443:  ["tomcat", "java", "jdk", "jre"],
        2181:  ["zookeeper"],
        9092:  ["kafka"],
        5672:  ["rabbitmq", "erlang"],
        11211: ["memcached"],
        21:    ["vsftpd", "proftpd", "ftp"],
        23:    ["telnet"],
        111:   ["rpcbind", "nfs"],
        2049:  ["nfs"],
        514:   ["rsyslog", "syslog"],
        9200:  ["elasticsearch"],
        5601:  ["kibana"],
    }

    # Always include these OS core packages regardless of ports
    CORE_PATTERNS = [
        "kernel", "linux", "glibc", "libc", "openssl", "libssl",
        "systemd", "dbus", "polkit", "sudo", "pam",
        "bash", "sh", "zsh", "coreutils",
        "curl", "wget", "libcurl",
        "python", "python3", "perl", "ruby",
        "rpm", "dpkg", "yum", "dnf", "apt",
        "nss", "nspr", "krb5", "libkrb",
        "zlib", "libz", "bzip2", "xz", "lzma",
        "expat", "libxml", "libxslt",
        "iptables", "nftables", "firewalld",
        "util-linux", "procps", "shadow",
        "network", "NetworkManager", "iproute",
        "openssh", "ssh", "libssh",
        "cron", "cronie", "at",
        "tar", "gzip", "unzip",
        "tzdata", "ca-certificates",
        "selinux", "apparmor",
        "vim", "nano",                # editors often have CVEs
        "git",                        # frequently has CVEs
        "rsync", "scp",
    ]

    # Desktop/GUI packages to always exclude (not relevant for servers)
    EXCLUDE_PATTERNS = [
        "firefox", "thunderbird", "chromium", "chrome",
        "gnome", "kde", "xfce", "lxde", "mate",
        "gtk", "qt", "gdk", "gio", "glib",
        "xorg", "xserver", "wayland", "mesa",
        "font", "fonts", "ttf", "otf", "emoji",
        "libreoffice", "office", "writer",
        "gimp", "inkscape", "blender",
        "vlc", "mpv", "mplayer", "gstreamer",
        "cups", "printer", "scanner",
        "bluetooth",
        "avahi",                      # mDNS — desktop only
        "pulseaudio", "alsa", "sound",
        "spell", "hunspell", "aspell", "enchant",
        "webkit", "webkitgtk",
        "evolution", "gedit", "nautilus",
        "totem", "rhythmbox", "cheese",
        "snap",                       # snap packages — managed separately
    ]

    # Build the set of allowed patterns from core + port-correlated
    allowed_patterns = list(CORE_PATTERNS)
    for port in open_port_numbers:
        if port in PORT_PKG_MAP:
            allowed_patterns.extend(PORT_PKG_MAP[port])

    def pkg_is_relevant(pkg_name: str) -> bool:
        name = pkg_name.lower()
        # Exclude desktop packages
        for ex in EXCLUDE_PATTERNS:
            if ex in name:
                return False
        # Include core + port-correlated
        for inc in allowed_patterns:
            if inc.lower() in name:
                return True
        # For RPM systems: include packages without GUI suffixes
        # that aren't explicitly excluded — these are likely server libs
        if not any(gui in name for gui in ["gui", "desktop", "x11", "wayland"]):
            return True
        return False

    # ── Step 1: SSH → detect OS → fetch package DB ───────────────────────────
    c = ssh_connect(host)
    try:
        os_id = (run(c,
            "cat /etc/os-release 2>/dev/null | grep ^ID= | cut -d= -f2 | xargs"
        ) or "").strip().lower()

        os_version = (run(c,
            "cat /etc/os-release 2>/dev/null | grep ^VERSION_ID= | cut -d= -f2 | xargs"
        ) or "").strip()

        os_pretty = (run(c,
            "cat /etc/os-release 2>/dev/null | grep ^PRETTY_NAME= | cut -d= -f2 | xargs"
        ) or os_id).strip()

        if os_id in ("rhel","centos","fedora","rocky","almalinux","ol","amzn"):
            os_family = "redhat"
            db_type   = "rpm"
            # Get package list as text for filtering
            pkg_raw = run(c,
                "rpm -qa --queryformat '%{NAME}|%{VERSION}-%{RELEASE}|%{ARCH}\n' 2>/dev/null",
                timeout=30) or ""
            # Also get full RPM DB for trivy (needed for accurate scanning)
            sftp = c.open_sftp()
            try:
                rpm_data = sftp.file("/var/lib/rpm/Packages", "rb").read()
            finally:
                sftp.close()

        elif os_id in ("ubuntu","debian","linuxmint","pop"):
            os_family = "debian"
            db_type   = "dpkg"
            pkg_raw = run(c,
                "dpkg-query -W -f='${Package}|${Version}|${Architecture}\n' 2>/dev/null",
                timeout=30) or ""
            rpm_data = None

        elif os_id == "alpine":
            os_family = "alpine"
            db_type   = "apk"
            pkg_raw = run(c,
                "apk info -v 2>/dev/null",
                timeout=30) or ""
            sftp = c.open_sftp()
            try:
                apk_data = sftp.file("/lib/apk/db/installed", "rb").read()
            finally:
                sftp.close()

        else:
            # Auto-detect
            has_rpm = (run(c, "test -f /var/lib/rpm/Packages && echo yes||echo no") or "no").strip()
            if has_rpm == "yes":
                os_family, db_type = "redhat", "rpm"
                pkg_raw = run(c,
                    "rpm -qa --queryformat '%{NAME}|%{VERSION}-%{RELEASE}|%{ARCH}\n' 2>/dev/null",
                    timeout=30) or ""
                sftp = c.open_sftp()
                try:
                    rpm_data = sftp.file("/var/lib/rpm/Packages", "rb").read()
                finally:
                    sftp.close()
            else:
                os_family, db_type = "debian", "dpkg"
                pkg_raw = run(c,
                    "dpkg-query -W -f='${Package}|${Version}|${Architecture}\n' 2>/dev/null",
                    timeout=30) or ""
                rpm_data = None

    finally:
        c.close()

    # ── Step 2: filter packages ───────────────────────────────────────────────
    total_pkgs = 0
    filtered_pkgs = []
    for line in pkg_raw.strip().splitlines():
        parts = line.strip().split("|")
        if len(parts) >= 2:
            total_pkgs += 1
            name = parts[0]
            if pkg_is_relevant(name):
                filtered_pkgs.append(parts)

    # ── Step 3: build filtered fake rootfs ───────────────────────────────────
    tmpdir = tempfile.mkdtemp(prefix="infracmd-scan-")
    try:
        etc_dir = _os.path.join(tmpdir, "etc")
        _os.makedirs(etc_dir, exist_ok=True)
        with open(_os.path.join(etc_dir, "os-release"), "w") as f:
            f.write("ID=" + os_id + "\n")
            f.write("VERSION_ID=" + os_version + "\n")
            f.write("PRETTY_NAME=" + os_pretty + "\n")

        if db_type == "rpm":
            # For RPM: write filtered package list as a synthetic dpkg-style
            # status file — trivy reads this for package enumeration
            # Then provide the RPM DB for version details
            rpm_dir = _os.path.join(tmpdir, "var", "lib", "rpm")
            _os.makedirs(rpm_dir, exist_ok=True)
            with open(_os.path.join(rpm_dir, "Packages"), "wb") as f:
                f.write(rpm_data)

        elif db_type == "apk":
            apk_dir = _os.path.join(tmpdir, "lib", "apk", "db")
            _os.makedirs(apk_dir, exist_ok=True)
            with open(_os.path.join(apk_dir, "installed"), "wb") as f:
                f.write(apk_data)

        else:
            dpkg_dir = _os.path.join(tmpdir, "var", "lib", "dpkg")
            _os.makedirs(dpkg_dir, exist_ok=True)
            with open(_os.path.join(dpkg_dir, "status"), "w") as f:
                for parts in filtered_pkgs:
                    name = parts[0]
                    ver  = parts[1] if len(parts) > 1 else "0"
                    arch = parts[2] if len(parts) > 2 else "amd64"
                    f.write(
                        "Package: " + name + "\n" +
                        "Status: install ok installed\n" +
                        "Architecture: " + arch + "\n" +
                        "Version: " + ver + "\n\n"
                    )

        # ── Step 4: scan ──────────────────────────────────────────────────────
        offline_flags = ["--skip-db-update","--skip-check-update"] if TRIVY_SKIP_DB_UPDATE else []

        cmd = [
            LOCAL_TRIVY, "rootfs",
            "--server",   TRIVY_SERVER_URL,
            "--format",   "json",
            "--scanners", "vuln",
            "--severity", "CRITICAL,HIGH,MEDIUM,LOW",
            "--timeout",  "120s",
            "--quiet",
            "--skip-java-db-update",
            "--pkg-types", "os",       # OS packages only — no npm/pip/gem
        ] + offline_flags + [tmpdir]

        result = _sp.run(cmd, capture_output=True, text=True, timeout=150)
        raw = result.stdout.strip()

        if not raw or not raw.startswith("{"):
            stderr = (result.stderr or "").strip()[:500]
            raise RuntimeError(
                "trivy scan returned no output for " + ip +
                " (" + os_pretty + "). "
                "stderr: " + stderr
            )

        vulns = _parse_trivy_output(raw)

        # ── Step 5: port-correlate — boost severity label for port-exposed CVEs
        # Tag each CVE with whether the vulnerable service is exposed via open port
        for v in vulns:
            pkg = v.get("pkg","").lower()
            v["port_exposed"] = False
            for port, patterns in PORT_PKG_MAP.items():
                if port in open_port_numbers:
                    if any(p.lower() in pkg for p in patterns):
                        v["port_exposed"] = True
                        v["exposed_port"] = port
                        break

        # Sort: port-exposed first, then by severity, then CVSS
        SEV = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3}
        vulns.sort(key=lambda v: (
            0 if v.get("port_exposed") else 1,
            SEV.get(v.get("severity","LOW"), 3),
            -(v.get("cvss") or 0)
        ))

        return vulns

    except _sp.TimeoutExpired:
        raise RuntimeError("trivy scan timed out for " + ip)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def vuln_scan(target_id, target_name, target_type, ip, host_name="", host_ctx=None):
    """
    Vulnerability scan with strict port routing:
      - Linux hosts/VMs  → SSH port 22  → Trivy CVE scan
      - Windows hosts/VMs → WinRM port 5985/5986 → PowerShell Windows Update scan
      - Hyper-V VMs       → WinRM to parent host → Invoke-Command into VM

    host_ctx  — full host dict (with credentials) from the DB.
                Must contain os_type='linux' or os_type='windows'.
    """
    open_ports = port_scan(ip) if ip not in ("N/A", "", None) else []
    trivy_error = None
    vulns = []

    if not host_ctx:
        trivy_error = (
            "Host credentials not available — scan was not triggered correctly. "
            "Please use the Vuln Scan button inside ServerCapacity."
        )
    elif ip in ("N/A", "", None):
        trivy_error = "No IP address available for this target. Set the VM IP first."
    else:
        import logging as _logging
        _log = _logging.getLogger(__name__)
        _os_type = (host_ctx.get("os_type") or "linux").strip().lower()
        _conn_ip  = host_ctx.get("ip", ip)
        _ssh_port = int(host_ctx.get("ssh_port") or 22)
        _wrm_port = int(host_ctx.get("winrm_port") or 5985)

        # ── EXPLICIT PORT ROUTING LOG ─────────────────────────────────────────
        if _os_type == "windows":
            _log.info(
                f"[vuln_scan] WINDOWS path → WinRM {_conn_ip}:{_wrm_port} "
                f"target={target_name} ({target_type})"
            )
        else:
            _log.info(
                f"[vuln_scan] LINUX path → SSH {_conn_ip}:{_ssh_port} "
                f"target={target_name} ({target_type})"
            )

        try:
            if _os_type == "windows":
                # ── WINDOWS PATH: WinRM port 5985/5986 ───────────────────────
                # Step 1: collect pending Windows Update KBs via WinRM
                s = _winrm_connect(host_ctx)
                vm_name = host_ctx.get("vm_name") or (target_name if target_type == "vm" else None)

                if target_type == "vm" and vm_name:
                    safe_vm = vm_name.replace('"', '').replace("'", "").replace("`", "")
                    ps_script = f"""
$vmTarget = '{safe_vm}'
$out = [System.Collections.Generic.List[object]]::new()

function Get-WinUpdates {{
    $items = [System.Collections.Generic.List[object]]::new()
    $ErrorActionPreference = 'SilentlyContinue'
    try {{
        $sr = New-Object -ComObject Microsoft.Update.Searcher -ErrorAction Stop
        $results = $sr.Search("IsInstalled=0 and Type='Software'")
        foreach ($u in $results.Updates) {{
            $sev = if ($u.MsrcSeverity) {{ $u.MsrcSeverity.ToString().ToUpper() }} else {{ 'MEDIUM' }}
            if ($sev -notin @('CRITICAL','HIGH','MEDIUM','LOW')) {{ $sev = 'MEDIUM' }}
            $kb  = if ($u.KBArticleIDs -and $u.KBArticleIDs.Count -gt 0) {{ 'KB' + $u.KBArticleIDs[0] }} else {{ 'WU-UNKNOWN' }}
            $items.Add([PSCustomObject]@{{
                id           = $kb
                severity     = $sev
                cvss         = if ($sev -eq 'CRITICAL') {{ 9.1 }} elseif ($sev -eq 'HIGH') {{ 7.5 }} elseif ($sev -eq 'LOW') {{ 3.1 }} else {{ 5.5 }}
                pkg          = 'Windows Update'
                desc         = if ($u.Title) {{ $u.Title }} else {{ 'Pending update' }}
                url          = 'https://support.microsoft.com/help/' + $kb.Replace('KB','')
                port_exposed = $false
            }})
        }}
    }} catch {{
        foreach ($h in (Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 50)) {{
            $items.Add([PSCustomObject]@{{
                id           = if ($h.HotFixID) {{ $h.HotFixID }} else {{ 'KB-unknown' }}
                severity     = 'INFO'
                cvss         = 0.0
                pkg          = 'Windows HotFix (installed)'
                desc         = if ($h.Description) {{ ($h.Description + ' ' + $h.HotFixID).Trim() }} else {{ 'Installed hotfix' }}
                url          = 'https://support.microsoft.com/help/' + ($h.HotFixID -replace 'KB','')
                port_exposed = $false
            }})
        }}
    }}
    return ,@($items)
}}

$reached = $false
try {{
    $remoteResults = Invoke-Command -ComputerName $vmTarget -ErrorAction Stop -ScriptBlock ${{function:Get-WinUpdates}}
    $remoteResults | ConvertTo-Json -Depth 3 -Compress
    $reached = $true
}} catch {{}}
if (-not $reached) {{
    $items = Get-WinUpdates
    $items | ConvertTo-Json -Depth 3 -Compress
}}
"""
                    win_rows = _run_ps(s, ps_script)
                else:
                    ps_script = r"""
$out = [System.Collections.Generic.List[object]]::new()
$ErrorActionPreference = 'SilentlyContinue'
try {
    $sr = New-Object -ComObject Microsoft.Update.Searcher -ErrorAction Stop
    $results = $sr.Search("IsInstalled=0 and Type='Software'")
    foreach ($u in $results.Updates) {
        $sev = if ($u.MsrcSeverity) { $u.MsrcSeverity.ToString().ToUpper() } else { 'MEDIUM' }
        if ($sev -notin @('CRITICAL','HIGH','MEDIUM','LOW')) { $sev = 'MEDIUM' }
        $kb  = if ($u.KBArticleIDs -and $u.KBArticleIDs.Count -gt 0) { 'KB' + $u.KBArticleIDs[0] } else { 'WU-UNKNOWN' }
        $out.Add([PSCustomObject]@{
            id           = $kb
            severity     = $sev
            cvss         = if ($sev -eq 'CRITICAL') { 9.1 } elseif ($sev -eq 'HIGH') { 7.5 } elseif ($sev -eq 'LOW') { 3.1 } else { 5.5 }
            pkg          = 'Windows Update'
            desc         = if ($u.Title) { $u.Title } else { 'Pending update' }
            url          = 'https://support.microsoft.com/help/' + $kb.Replace('KB','')
            port_exposed = $false
        })
    }
} catch {
    foreach ($h in (Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 50)) {
        $out.Add([PSCustomObject]@{
            id           = if ($h.HotFixID) { $h.HotFixID } else { 'KB-unknown' }
            severity     = 'INFO'
            cvss         = 0.0
            pkg          = 'Windows HotFix (installed)'
            desc         = if ($h.Description) { ($h.Description + ' ' + $h.HotFixID).Trim() } else { 'Installed hotfix' }
            url          = 'https://support.microsoft.com/help/' + ($h.HotFixID -replace 'KB','')
            port_exposed = $false
        })
    }
}
$out | ConvertTo-Json -Depth 3 -Compress
"""
                    win_rows = _run_ps(s, ps_script)

                # Normalise WinRM result
                if isinstance(win_rows, list):
                    win_vulns = win_rows
                elif isinstance(win_rows, dict):
                    win_vulns = [win_rows]
                elif isinstance(win_rows, str) and win_rows.strip():
                    try:
                        parsed = json.loads(win_rows)
                        win_vulns = parsed if isinstance(parsed, list) else [parsed]
                    except Exception:
                        win_vulns = []
                        trivy_error = f"Could not parse Windows scan output: {win_rows[:300]}"
                else:
                    win_vulns = []

                # Step 2: also run Trivy CVE/NVD scan for Windows installed software
                trivy_cves = []
                LOCAL_TRIVY = _os.environ.get("TRIVY_BINARY_PATH", "/usr/local/bin/trivy")
                if _os.path.exists(LOCAL_TRIVY):
                    try:
                        import tempfile, shutil, subprocess as _sp2
                        sw_ps = r"""
$apps = [System.Collections.Generic.List[object]]::new()
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($p in $paths) {
    Get-ItemProperty $p -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName } |
    ForEach-Object {
        $apps.Add([PSCustomObject]@{
            name    = $_.DisplayName
            version = if ($_.DisplayVersion) { $_.DisplayVersion } else { '0.0.0' }
            vendor  = if ($_.Publisher) { $_.Publisher } else { 'Unknown' }
        })
    }
}
$apps | ConvertTo-Json -Depth 2 -Compress
"""
                        sw_rows = _run_ps(s, sw_ps)
                        sw_list = sw_rows if isinstance(sw_rows, list) else ([sw_rows] if isinstance(sw_rows, dict) else [])

                        if sw_list:
                            tmpdir = tempfile.mkdtemp(prefix="infracmd-win-scan-")
                            try:
                                components = []
                                for sw in sw_list:
                                    if not isinstance(sw, dict): continue
                                    name = str(sw.get("name","")).strip()
                                    ver  = str(sw.get("version","0")).strip() or "0"
                                    if name:
                                        components.append({
                                            "type": "library",
                                            "name": name,
                                            "version": ver,
                                            "purl": f"pkg:generic/{name.replace(' ','+')}@{ver}"
                                        })
                                sbom = {
                                    "bomFormat": "CycloneDX",
                                    "specVersion": "1.4",
                                    "version": 1,
                                    "metadata": {"component": {"type":"application","name":target_name}},
                                    "components": components
                                }
                                sbom_path = _os.path.join(tmpdir, "bom.json")
                                with open(sbom_path, "w") as f:
                                    json.dump(sbom, f)

                                offline_flags = ["--skip-db-update","--skip-check-update"] if TRIVY_SKIP_DB_UPDATE else []
                                cmd = [
                                    LOCAL_TRIVY, "sbom",
                                    "--server",   TRIVY_SERVER_URL,
                                    "--format",   "json",
                                    "--scanners", "vuln",
                                    "--severity", "CRITICAL,HIGH,MEDIUM,LOW",
                                    "--timeout",  "120s",
                                    "--quiet",
                                ] + offline_flags + [sbom_path]

                                result = _sp2.run(cmd, capture_output=True, text=True, timeout=150)
                                if result.stdout.strip().startswith("{"):
                                    trivy_cves = _parse_trivy_output(result.stdout.strip())
                                    for v in trivy_cves:
                                        v["source"] = "Trivy/NVD"
                            finally:
                                shutil.rmtree(tmpdir, ignore_errors=True)
                    except Exception as e_trivy:
                        _log.warning(f"[vuln_scan] Windows Trivy CVE scan skipped: {e_trivy}")

                # Merge: Windows Update KBs + Trivy CVEs (deduplicate by id)
                seen_ids = set()
                for v in win_vulns:
                    if isinstance(v, dict):
                        v.setdefault("source", "Windows Update")
                        seen_ids.add(v.get("id",""))
                for v in trivy_cves:
                    if isinstance(v, dict) and v.get("id","") not in seen_ids:
                        win_vulns.append(v)
                vulns = win_vulns

            else:
                # ── LINUX PATH: SSH port 22 → Trivy CVE scan ─────────────────
                if _os_type not in ("linux", "unix", ""):
                    trivy_error = (
                        f"Port routing error: os_type='{_os_type}' should use WinRM, "
                        f"not SSH. Check host configuration or re-add the host."
                    )
                else:
                    LOCAL_TRIVY = _os.environ.get("TRIVY_BINARY_PATH", "/usr/local/bin/trivy")
                    if not _os.path.exists(LOCAL_TRIVY):
                        trivy_error = (
                            f"Trivy binary not found at {LOCAL_TRIVY}. "
                            f"Run setup.sh on the backend node to install Trivy, "
                            f"or set TRIVY_BINARY_PATH env var. "
                            f"(Linux scan uses SSH:{_ssh_port} to {_conn_ip})"
                        )
                    else:
                        vulns = _trivy_scan_via_server(host_ctx, open_ports=open_ports)
        except Exception as e:
            trivy_error = str(e)

    return {
        "target_id":   target_id,
        "target":      target_name,
        "target_type": target_type,
        "ip":          ip,
        "host":        host_name,
        "scanned_at":  datetime.now(timezone.utc).isoformat(),
        "scanner":     f"Trivy server — {TRIVY_SERVER_URL}",
        "scan_error":  trivy_error,
        "open_ports":  open_ports,
        "vulns":       vulns,
        "summary": {
            "total":        len(vulns),
            "open_ports":   len(open_ports),
            "risky_ports":  sum(1 for p in open_ports if p.get("risky")),
            "port_exposed": sum(1 for v in vulns if isinstance(v, dict) and v.get("port_exposed")),
            "critical":     sum(1 for v in vulns if isinstance(v, dict) and v.get("severity") == "CRITICAL"),
            "high":         sum(1 for v in vulns if isinstance(v, dict) and v.get("severity") == "HIGH"),
            "medium":       sum(1 for v in vulns if isinstance(v, dict) and v.get("severity") == "MEDIUM"),
            "low":          sum(1 for v in vulns if isinstance(v, dict) and v.get("severity") == "LOW"),
        },
    }
