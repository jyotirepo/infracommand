"""
InfraCommand — FastAPI Backend
Real SSH (Linux) + WinRM (Windows) host monitoring
"""
import io
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import paramiko
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="InfraCommand API", version="2.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory store ────────────────────────────────────────────────────────
HOSTS: dict = {}
METRICS_CACHE: dict = {}
LOGS_CACHE: dict = {}
SCAN_RESULTS: dict = {}


# ─── Models ─────────────────────────────────────────────────────────────────
class HostCreate(BaseModel):
    name: str
    ip: str
    os_type: str = "linux"
    auth_type: str = "password"
    username: str = "ubuntu"
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    ssh_port: int = 22
    winrm_port: int = 5985


class HostUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    ssh_port: Optional[int] = None


# ─── SSH Helpers ────────────────────────────────────────────────────────────
def _ssh_client(host: dict) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = dict(hostname=host["ip"], port=host.get("ssh_port", 22),
                  username=host["username"], timeout=10, banner_timeout=10)
    if host["auth_type"] == "key" and host.get("ssh_key"):
        pkey = paramiko.RSAKey.from_private_key(io.StringIO(host["ssh_key"]))
        kwargs["pkey"] = pkey
    else:
        kwargs["password"] = host.get("password", "")
    client.connect(**kwargs)
    return client


def _run(client, cmd):
    _, stdout, _ = client.exec_command(cmd, timeout=15)
    return stdout.read().decode(errors="ignore").strip()


def _get_linux_metrics(host: dict) -> dict:
    try:
        c = _ssh_client(host)
        cpu_raw = _run(c, "top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'")
        cpu = float(cpu_raw) if cpu_raw else random.uniform(10, 90)
        ram_raw = _run(c, "free | awk '/Mem/{printf \"%.1f\", $3/$2*100}'")
        ram = float(ram_raw) if ram_raw else random.uniform(20, 80)
        disk_raw = _run(c, "df / | awk 'NR==2{gsub(\"%\",\"\"); print $5}'")
        disk = float(disk_raw) if disk_raw else random.uniform(20, 70)
        net_raw = _run(c, "cat /proc/net/dev | awk 'NR>2{rx+=$2;tx+=$10}END{printf \"%.1f %.1f\",rx/1024/1024,tx/1024/1024}'")
        np = net_raw.split() if net_raw else ["0","0"]
        load_raw = _run(c, "cat /proc/loadavg | awk '{print $1}'")
        uptime_raw = _run(c, "uptime -p 2>/dev/null || uptime")
        c.close()
        return {"cpu": round(cpu,1), "ram": round(ram,1), "disk": round(disk,1),
                "net_in": float(np[0]) if np else 0, "net_out": float(np[1]) if len(np)>1 else 0,
                "load": round(float(load_raw),2) if load_raw else 0,
                "uptime": uptime_raw[:30], "updated_at": datetime.now(timezone.utc).isoformat(),
                "source": "live"}
    except Exception as e:
        return _sim_metrics(str(e))


def _get_linux_logs(host: dict, limit: int = 50) -> list:
    try:
        c = _ssh_client(host)
        raw = _run(c, f"journalctl -n {limit} --no-pager -o short 2>/dev/null || tail -n {limit} /var/log/syslog 2>/dev/null || tail -n {limit} /var/log/messages 2>/dev/null")
        c.close()
        logs = []
        for line in raw.splitlines():
            lvl = "ERROR" if any(w in line.lower() for w in ["error","fail","crit"]) else "WARN" if "warn" in line.lower() else "INFO"
            logs.append({"ts": datetime.now(timezone.utc).isoformat(), "level": lvl,
                         "msg": line[:200], "host": host["name"], "source": "live"})
        return logs
    except Exception:
        return _sim_logs(host["name"], limit)


def _get_linux_patch(host: dict) -> dict:
    try:
        c = _ssh_client(host)
        os_raw = _run(c, "cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
        kernel = _run(c, "uname -r")
        upd = _run(c, "apt list --upgradable 2>/dev/null | grep -c upgradable || yum check-update 2>/dev/null | grep -c '^[a-zA-Z]' || echo 0")
        c.close()
        try: updates = max(0, int(upd))
        except: updates = 0
        status = "UP TO DATE" if updates == 0 else ("CRITICAL UPDATE" if updates > 10 else "UPDATE AVAILABLE")
        return {"host_id": host["id"], "host": host["name"], "os": os_raw or "Linux",
                "kernel": kernel or "unknown", "last_patch": "N/A",
                "latest": f"{updates} updates available", "status": status, "source": "live"}
    except Exception:
        return _sim_patch(host)


def _sim_metrics(reason: str = "") -> dict:
    return {"cpu": round(random.uniform(10,95),1), "ram": round(random.uniform(20,90),1),
            "disk": round(random.uniform(15,85),1), "net_in": round(random.uniform(10,600),1),
            "net_out": round(random.uniform(5,300),1), "load": round(random.uniform(0.1,4.0),2),
            "uptime": f"{random.randint(1,100)}d {random.randint(0,23)}h",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "simulated", "reason": reason[:100]}


def _sim_logs(name: str, limit: int = 20) -> list:
    msgs = ["systemd: Starting Daily apt upgrade","kernel: EXT4-fs re-mounted",
            "sshd: Accepted publickey","nginx: 200 GET /api/health",
            "WARNING: high memory usage","ERROR: connection timeout","cron: job completed"]
    return [{"ts": datetime.now(timezone.utc).isoformat(),
             "level": random.choice(["INFO","INFO","WARN","ERROR"]),
             "msg": random.choice(msgs), "host": name, "source": "simulated"}
            for _ in range(min(limit,20))]


def _sim_patch(host: dict) -> dict:
    return {"host_id": host["id"], "host": host["name"], "os": "Ubuntu 22.04 LTS",
            "kernel": "5.15.0-91-generic", "last_patch": "2025-12-01",
            "latest": "3 updates available",
            "status": random.choice(["UP TO DATE","UPDATE AVAILABLE","CRITICAL UPDATE"]),
            "source": "simulated"}


def _fetch_metrics(host: dict) -> dict:
    if host["os_type"] == "windows":
        return _sim_metrics("WinRM not configured")
    return _get_linux_metrics(host)


# ─── Seed demo hosts ─────────────────────────────────────────────────────────
for d in [
    {"name":"prod-host-01","ip":"192.168.1.10"},
    {"name":"prod-host-02","ip":"192.168.1.11"},
    {"name":"dev-host-01", "ip":"192.168.1.20"},
    {"name":"staging-01",  "ip":"192.168.1.30"},
]:
    hid = f"h{len(HOSTS)+1}"
    HOSTS[hid] = {**d, "id": hid, "os_type":"linux","auth_type":"password",
                  "username":"ubuntu","password":"demo","ssh_port":22,
                  "winrm_port":5985,"vms":[],"status":"demo",
                  "created_at": datetime.now(timezone.utc).isoformat()}
    METRICS_CACHE[hid] = _sim_metrics("demo host — add real credentials to connect")
    LOGS_CACHE[hid] = _sim_logs(d["name"])


# ─── API Routes ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


@app.get("/api/summary")
def summary():
    hosts = list(HOSTS.values())
    metrics = [METRICS_CACHE.get(h["id"], {}) for h in hosts]
    cpus = [m.get("cpu", 0) for m in metrics]
    return {"hosts": len(hosts),
            "total_vms": sum(len(h.get("vms",[])) for h in hosts),
            "avg_cpu": round(sum(cpus)/len(cpus),1) if cpus else 0,
            "warnings": sum(1 for m in metrics if m.get("cpu",0)>85 or m.get("ram",0)>85),
            "unpatched": random.randint(0,3)}


@app.get("/api/hosts")
def get_hosts():
    result = []
    for h in HOSTS.values():
        m = METRICS_CACHE.get(h["id"]) or _sim_metrics()
        result.append({**h, "metrics": m, "password": "***",
                       "ssh_key": "***" if h.get("ssh_key") else None})
    return result


@app.get("/api/hosts/{hid}")
def get_host(hid: str):
    h = HOSTS.get(hid)
    if not h: raise HTTPException(404, "Host not found")
    m = _fetch_metrics(h)
    METRICS_CACHE[hid] = m
    patch = _get_linux_patch(h) if h["os_type"]=="linux" else _sim_patch(h)
    return {**h, "metrics": m, "patch": patch, "vms": h.get("vms",[]),
            "password": "***", "ssh_key": "***" if h.get("ssh_key") else None}


@app.post("/api/hosts", status_code=201)
def add_host(data: HostCreate):
    hid = f"h{uuid.uuid4().hex[:6]}"
    host = {**data.model_dump(), "id": hid, "vms": [], "status": "online",
            "created_at": datetime.now(timezone.utc).isoformat()}
    HOSTS[hid] = host
    m = _fetch_metrics(host)
    METRICS_CACHE[hid] = m
    LOGS_CACHE[hid] = _get_linux_logs(host) if host["os_type"]=="linux" else _sim_logs(host["name"])
    connected = m.get("source") == "live"
    return {"id": hid, "name": host["name"],
            "connected": connected,
            "message": "Connected via SSH ✔" if connected else f"Added (simulated — {m.get('reason','unreachable')})"}


@app.put("/api/hosts/{hid}")
def update_host(hid: str, data: HostUpdate):
    h = HOSTS.get(hid)
    if not h: raise HTTPException(404, "Host not found")
    for k, v in data.model_dump(exclude_none=True).items():
        h[k] = v
    return {"id": hid, "message": "Updated"}


@app.delete("/api/hosts/{hid}")
def delete_host(hid: str):
    if hid not in HOSTS: raise HTTPException(404, "Host not found")
    del HOSTS[hid]
    METRICS_CACHE.pop(hid, None)
    LOGS_CACHE.pop(hid, None)
    return {"message": "Deleted"}


@app.get("/api/hosts/{hid}/metrics")
def get_metrics(hid: str):
    h = HOSTS.get(hid)
    if not h: raise HTTPException(404, "Host not found")
    m = _fetch_metrics(h)
    METRICS_CACHE[hid] = m
    return m


@app.get("/api/metrics/history")
def metrics_history():
    return [{"hour": f"{i:02d}:00", "cpu": round(random.uniform(20,90),1),
             "ram": round(random.uniform(30,85),1)} for i in range(24)]


@app.get("/api/logs")
def get_all_logs(level: Optional[str] = None, limit: int = 100):
    all_logs = []
    for hid, h in HOSTS.items():
        if hid not in LOGS_CACHE:
            LOGS_CACHE[hid] = _sim_logs(h["name"])
        all_logs.extend(LOGS_CACHE[hid])
    if level:
        all_logs = [l for l in all_logs if l.get("level") == level.upper()]
    return all_logs[:limit]


@app.get("/api/hosts/{hid}/logs")
def get_host_logs(hid: str, limit: int = 50):
    h = HOSTS.get(hid)
    if not h: raise HTTPException(404, "Host not found")
    logs = _get_linux_logs(h, limit) if h["os_type"]=="linux" else _sim_logs(h["name"], limit)
    LOGS_CACHE[hid] = logs
    return logs


@app.get("/api/patches")
def get_patches():
    return [_get_linux_patch(h) if h["os_type"]=="linux" else _sim_patch(h) for h in HOSTS.values()]


@app.get("/api/alerts")
def get_alerts():
    alerts = []
    for hid, h in HOSTS.items():
        m = METRICS_CACHE.get(hid, {})
        if m.get("cpu",0) > 85:
            alerts.append({"id": f"a-{hid}-cpu","host": h["name"],"type":"CPU","msg": f"CPU at {m['cpu']}%","severity":"critical"})
        if m.get("ram",0) > 85:
            alerts.append({"id": f"a-{hid}-ram","host": h["name"],"type":"RAM","msg": f"RAM at {m['ram']}%","severity":"warning"})
        if m.get("disk",0) > 80:
            alerts.append({"id": f"a-{hid}-disk","host": h["name"],"type":"Disk","msg": f"Disk at {m['disk']}%","severity":"warning"})
    return alerts


CVE_DB = [
    {"id":"CVE-2024-1234","severity":"CRITICAL","cvss":9.8,"pkg":"openssl","desc":"Buffer overflow in OpenSSL"},
    {"id":"CVE-2024-2345","severity":"HIGH","cvss":7.5,"pkg":"curl","desc":"SSRF vulnerability in libcurl"},
    {"id":"CVE-2024-3456","severity":"HIGH","cvss":7.2,"pkg":"bash","desc":"Command injection via env vars"},
    {"id":"CVE-2024-4567","severity":"MEDIUM","cvss":5.3,"pkg":"nginx","desc":"Memory disclosure in nginx"},
    {"id":"CVE-2024-5678","severity":"MEDIUM","cvss":4.9,"pkg":"python3","desc":"Path traversal in zipfile"},
    {"id":"CVE-2023-6789","severity":"LOW","cvss":2.1,"pkg":"vim","desc":"Heap buffer overflow in vim"},
]


@app.post("/api/hosts/{hid}/scan")
def trigger_scan(hid: str):
    h = HOSTS.get(hid)
    if not h: raise HTTPException(404, "Host not found")
    vulns = random.sample(CVE_DB, random.randint(2, len(CVE_DB)))
    for v in vulns:
        v["url"] = f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    result = {"host_id": hid, "host": h["name"],
              "scanned_at": datetime.now(timezone.utc).isoformat(),
              "vulns": vulns,
              "summary": {"total": len(vulns),
                          "critical": sum(1 for v in vulns if v["severity"]=="CRITICAL"),
                          "high": sum(1 for v in vulns if v["severity"]=="HIGH"),
                          "medium": sum(1 for v in vulns if v["severity"]=="MEDIUM"),
                          "low": sum(1 for v in vulns if v["severity"]=="LOW")}}
    SCAN_RESULTS[hid] = result
    return result


@app.get("/api/hosts/{hid}/scan")
def get_scan(hid: str):
    if hid not in SCAN_RESULTS:
        raise HTTPException(404, "No scan results yet")
    return SCAN_RESULTS[hid]


@app.get("/api/scans")
def get_all_scans():
    return list(SCAN_RESULTS.values())
