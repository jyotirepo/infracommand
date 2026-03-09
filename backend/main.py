"""
InfraCommand — FastAPI Backend
Centralized Server Monitoring & Vulnerability Management
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio, uuid, random
from datetime import datetime, timedelta

app = FastAPI(title="InfraCommand API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Models ───────────────────────────────────────────────────────────────────
class HostCreate(BaseModel):
    name: str
    ip: str
    user: str = "ubuntu"
    ssh_port: int = 22

# ─── Static seed data ─────────────────────────────────────────────────────────
CVE_DB = [
    {"cve":"CVE-2024-6387",  "sev":"CRITICAL","pkg":"openssh 8.7p1",   "cvss":"8.1", "desc":"Remote code execution in OpenSSH (regreSSHion)","fix":"Upgrade openssh >= 8.7p1-34","link":"https://nvd.nist.gov/vuln/detail/CVE-2024-6387"},
    {"cve":"CVE-2024-3094",  "sev":"CRITICAL","pkg":"xz-utils 5.6.0",  "cvss":"10.0","desc":"Supply-chain backdoor in XZ/liblzma",           "fix":"Downgrade to xz-utils 5.4.x","link":"https://nvd.nist.gov/vuln/detail/CVE-2024-3094"},
    {"cve":"CVE-2024-1086",  "sev":"CRITICAL","pkg":"linux-kernel 5.14","cvss":"7.8","desc":"Use-after-free in netfilter nf_tables",           "fix":"Upgrade kernel >= 5.14.0-362","link":"https://nvd.nist.gov/vuln/detail/CVE-2024-1086"},
    {"cve":"CVE-2024-21626", "sev":"HIGH",    "pkg":"runc 1.1.5",      "cvss":"8.6","desc":"Container escape via leaked file descriptors",     "fix":"Upgrade runc >= 1.1.11",     "link":"https://nvd.nist.gov/vuln/detail/CVE-2024-21626"},
    {"cve":"CVE-2023-44487", "sev":"HIGH",    "pkg":"nghttp2 1.57.0",  "cvss":"7.5","desc":"HTTP/2 Rapid Reset DDoS attack",                  "fix":"Upgrade nghttp2 >= 1.57.0-2","link":"https://nvd.nist.gov/vuln/detail/CVE-2023-44487"},
    {"cve":"CVE-2023-4911",  "sev":"HIGH",    "pkg":"glibc 2.34",      "cvss":"7.8","desc":"Buffer overflow in glibc dynamic linker",          "fix":"Update glibc >= 2.34-60",    "link":"https://nvd.nist.gov/vuln/detail/CVE-2023-4911"},
    {"cve":"CVE-2024-0646",  "sev":"CRITICAL","pkg":"linux-kernel 5.14","cvss":"7.8","desc":"Out-of-bounds write in kernel TLS subsystem",     "fix":"kernel >= 5.14.0-362.8.1",   "link":"https://nvd.nist.gov/vuln/detail/CVE-2024-0646"},
    {"cve":"CVE-2024-0727",  "sev":"MEDIUM",  "pkg":"openssl 3.0.7",   "cvss":"5.5","desc":"Denial of service in PKCS12 parsing",              "fix":"Update openssl >= 3.0.8",    "link":"https://nvd.nist.gov/vuln/detail/CVE-2024-0727"},
    {"cve":"CVE-2023-5678",  "sev":"MEDIUM",  "pkg":"openssl 3.0.7",   "cvss":"5.3","desc":"DoS via excessive DH key generation",              "fix":"Update openssl >= 3.0.8",    "link":"https://nvd.nist.gov/vuln/detail/CVE-2023-5678"},
    {"cve":"CVE-2023-40217", "sev":"LOW",     "pkg":"python3 3.11.2",  "cvss":"5.3","desc":"TLS handshake bypass before EOF",                  "fix":"Update python3 >= 3.11.4",   "link":"https://nvd.nist.gov/vuln/detail/CVE-2023-40217"},
]

LOG_POOL = [
    ("INFO",  "sshd[1234]: Accepted publickey for deploy from 10.0.0.5 port 44392"),
    ("INFO",  "systemd[1]: nginx.service: Reload successful"),
    ("WARN",  "kernel: nf_conntrack: table full, dropping packet"),
    ("INFO",  "CRON[4422]: (root) CMD (/usr/lib/apt/apt.systemd.daily)"),
    ("ERROR", "kernel: Out of memory: Kill process 28471 (python3) score 892"),
    ("WARN",  "sshd[9821]: Invalid user ubuntu from 196.49.1.22 port 51000"),
    ("INFO",  "dockerd: container started successfully"),
    ("OK",    "systemd[1]: Reached target Multi-User System"),
    ("INFO",  "postgres: database system is ready to accept connections"),
    ("ERROR", "kernel: EDAC MC0: 1 CE memory read error on CPU_SrcID#0"),
    ("WARN",  "sshd: Failed password for root from 45.33.32.156 (3 attempts)"),
    ("OK",    "systemd[1]: apt-daily.service: Succeeded"),
    ("INFO",  "docker: container ml-train-01 started"),
    ("ERROR", "nginx: upstream timed out (110) while reading response header"),
]

def gen_logs(host_name: str, n: int = 50) -> list:
    return [
        {"id": str(uuid.uuid4()),
         "ts": (datetime.utcnow() - timedelta(seconds=i*90)).isoformat(),
         "level": lvl, "host": host_name, "msg": msg}
        for i, (lvl, msg) in enumerate(random.choices(LOG_POOL, k=n))
    ]

def gen_metrics(hid: str) -> dict:
    base = {"h1":(68,72), "h2":(91,89), "h3":(35,42), "h4":(44,53)}.get(hid, (50,50))
    return {
        "cpu":      round(min(100, max(1, base[0] + random.uniform(-3,3))), 1),
        "ram":      round(min(100, max(1, base[1] + random.uniform(-2,2))), 1),
        "disk":     round(random.uniform(30, 75), 1),
        "net_in":   round(random.uniform(10, 900), 1),
        "net_out":  round(random.uniform(5, 400), 1),
        "load":     round(random.uniform(0.2, 6.0), 2),
        "uptime":   {"h1":"47d 14h","h2":"12d 3h","h3":"93d 7h","h4":"31d 19h"}.get(hid, "0d"),
        "updated_at": datetime.utcnow().isoformat(),
    }

# ─── In-memory store ──────────────────────────────────────────────────────────
HOSTS = [
    {"id":"h1","name":"prod-host-01","ip":"192.168.1.10","user":"ubuntu","ssh_port":22,"status":"online","vms":[
        {"id":"vm1","name":"web-prod-01", "type":"Web",     "status":"running","ip":"192.168.1.101","vcpu":4, "ram":"16GB","disk":"200GB","os":"Ubuntu 22.04"},
        {"id":"vm2","name":"api-prod-01", "type":"API",     "status":"running","ip":"192.168.1.102","vcpu":8, "ram":"32GB","disk":"200GB","os":"Ubuntu 22.04"},
        {"id":"vm3","name":"db-prod-01",  "type":"Database","status":"running","ip":"192.168.1.103","vcpu":16,"ram":"64GB","disk":"1TB",  "os":"RHEL 9"},
    ]},
    {"id":"h2","name":"prod-host-02","ip":"192.168.1.11","user":"ubuntu","ssh_port":22,"status":"warning","vms":[
        {"id":"vm4","name":"ml-train-01", "type":"ML",     "status":"running","ip":"192.168.1.111","vcpu":32,"ram":"128GB","disk":"500GB","os":"Ubuntu 22.04"},
        {"id":"vm5","name":"monitor-01",  "type":"Monitor","status":"stopped","ip":"192.168.1.112","vcpu":4, "ram":"8GB", "disk":"100GB","os":"Debian 12"},
    ]},
    {"id":"h3","name":"dev-host-01","ip":"192.168.1.20","user":"ubuntu","ssh_port":22,"status":"online","vms":[
        {"id":"vm6","name":"web-dev-01",  "type":"Web",     "status":"running","ip":"192.168.1.201","vcpu":2, "ram":"8GB", "disk":"100GB","os":"Ubuntu 20.04"},
        {"id":"vm7","name":"db-dev-01",   "type":"Database","status":"running","ip":"192.168.1.202","vcpu":4, "ram":"16GB","disk":"200GB","os":"Ubuntu 20.04"},
    ]},
    {"id":"h4","name":"staging-host-01","ip":"192.168.1.30","user":"ubuntu","ssh_port":22,"status":"online","vms":[
        {"id":"vm8","name":"web-stg-01",  "type":"Web","status":"running","ip":"192.168.1.301","vcpu":4,"ram":"16GB","disk":"200GB","os":"Debian 12"},
        {"id":"vm9","name":"api-stg-01",  "type":"API","status":"running","ip":"192.168.1.302","vcpu":4,"ram":"16GB","disk":"200GB","os":"Debian 12"},
    ]},
]
METRICS  = {h["id"]: gen_metrics(h["id"]) for h in HOSTS}
LOGS     = {h["id"]: gen_logs(h["name"])  for h in HOSTS}
PATCHES  = {
    "h1":{"os":"Ubuntu 22.04.3 LTS","kernel":"5.15.0-89-generic",        "last_patch":"2024-11-15","current_ver":"22.04.3","latest_ver":"22.04.4","status":"outdated"},
    "h2":{"os":"RHEL 9.2",           "kernel":"5.14.0-284.el9_2.x86_64", "last_patch":"2024-10-02","current_ver":"9.2",    "latest_ver":"9.3",    "status":"critical"},
    "h3":{"os":"Ubuntu 20.04.6 LTS", "kernel":"5.4.0-167-generic",       "last_patch":"2024-11-28","current_ver":"20.04.6","latest_ver":"20.04.6","status":"uptodate"},
    "h4":{"os":"Debian 12.2",        "kernel":"6.1.0-13-amd64",          "last_patch":"2024-12-01","current_ver":"12.2",   "latest_ver":"12.3",   "status":"outdated"},
}
SCANS = {}

def refresh_metrics():
    for h in HOSTS:
        hid = h["id"]
        m = METRICS[hid]
        m["cpu"]      = round(min(100, max(1, m["cpu"] + random.uniform(-5, 5))), 1)
        m["ram"]      = round(min(100, max(1, m["ram"] + random.uniform(-3, 3))), 1)
        m["net_in"]   = round(random.uniform(10, 900), 1)
        m["net_out"]  = round(random.uniform(5, 400), 1)
        m["updated_at"] = datetime.utcnow().isoformat()
        h["status"]   = "warning" if m["cpu"] > 85 or m["ram"] > 85 else "online"

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}

@app.get("/api/summary")
def summary():
    refresh_metrics()
    total_vms   = sum(len(h["vms"]) for h in HOSTS)
    running_vms = sum(1 for h in HOSTS for v in h["vms"] if v["status"] == "running")
    warnings    = sum(1 for h in HOSTS if h["status"] == "warning")
    cpus        = [METRICS[h["id"]]["cpu"] for h in HOSTS]
    avg_cpu     = round(sum(cpus)/len(cpus), 1) if cpus else 0
    unpatched   = sum(1 for p in PATCHES.values() if p["status"] != "uptodate")
    return {"hosts": len(HOSTS), "total_vms": total_vms, "running_vms": running_vms,
            "warnings": warnings, "avg_cpu": avg_cpu, "unpatched": unpatched}

@app.get("/api/hosts")
def get_hosts():
    refresh_metrics()
    return [{**h, "metrics": METRICS.get(h["id"], {})} for h in HOSTS]

@app.get("/api/hosts/{host_id}")
def get_host(host_id: str):
    h = next((x for x in HOSTS if x["id"] == host_id), None)
    if not h: raise HTTPException(404, "Host not found")
    return {**h, "metrics": METRICS.get(host_id, {}), "patch": PATCHES.get(host_id, {})}

@app.post("/api/hosts", status_code=201)
def add_host(body: HostCreate):
    hid  = f"h{str(uuid.uuid4())[:8]}"
    host = {"id": hid, "name": body.name, "ip": body.ip,
            "user": body.user, "ssh_port": body.ssh_port, "status": "unknown", "vms": []}
    HOSTS.append(host)
    METRICS[hid] = gen_metrics(hid)
    LOGS[hid]    = []
    return host

@app.delete("/api/hosts/{host_id}")
def delete_host(host_id: str):
    global HOSTS
    HOSTS = [h for h in HOSTS if h["id"] != host_id]
    METRICS.pop(host_id, None); LOGS.pop(host_id, None); SCANS.pop(host_id, None)
    return {"deleted": host_id}

@app.get("/api/metrics/history")
def metrics_history():
    now = datetime.utcnow()
    return [
        {"ts": (now - timedelta(hours=24-i)).strftime("%H:00"),
         "prod01_cpu": round(random.uniform(55,85),1),
         "prod02_cpu": round(random.uniform(75,95),1),
         "dev01_cpu":  round(random.uniform(20,55),1),
         "prod01_ram": round(random.uniform(60,80),1),
         "prod02_ram": round(random.uniform(75,92),1)}
        for i in range(24)
    ]

@app.get("/api/logs")
def all_logs(level: str = "all", limit: int = 100):
    for h in HOSTS:
        lvl, msg = random.choice(LOG_POOL)
        LOGS[h["id"]].insert(0, {"id": str(uuid.uuid4()),
            "ts": datetime.utcnow().isoformat(), "level": lvl, "host": h["name"], "msg": msg})
        if len(LOGS[h["id"]]) > 300: LOGS[h["id"]].pop()
    merged = sorted(
        [l for logs in LOGS.values() for l in logs],
        key=lambda x: x["ts"], reverse=True
    )
    if level != "all":
        merged = [l for l in merged if l["level"] == level.upper()]
    return merged[:limit]

@app.get("/api/hosts/{host_id}/logs")
def host_logs(host_id: str, level: str = "all", limit: int = 80):
    logs = LOGS.get(host_id, [])
    if level != "all":
        logs = [l for l in logs if l["level"] == level.upper()]
    return logs[:limit]

@app.get("/api/patches")
def patches():
    return [{"host_id": h["id"], "host_name": h["name"], "ip": h["ip"],
             **PATCHES.get(h["id"], {})} for h in HOSTS]

@app.get("/api/alerts")
def alerts():
    out = []
    for h in HOSTS:
        m = METRICS.get(h["id"], {})
        p = PATCHES.get(h["id"], {})
        ts = datetime.utcnow().isoformat()
        if m.get("cpu", 0) > 85:
            out.append({"id": str(uuid.uuid4()), "sev":"CRITICAL","host":h["name"],
                "title":f"High CPU — {h['name']}","msg":f"CPU at {m['cpu']}% for >15 min","ts":ts})
        if m.get("ram", 0) > 85:
            out.append({"id": str(uuid.uuid4()), "sev":"WARNING","host":h["name"],
                "title":f"High RAM — {h['name']}","msg":f"RAM at {m['ram']}%","ts":ts})
        if m.get("disk", 0) > 80:
            out.append({"id": str(uuid.uuid4()), "sev":"WARNING","host":h["name"],
                "title":f"Disk pressure — {h['name']}","msg":f"Disk at {m['disk']}%","ts":ts})
        if p.get("status") == "critical":
            out.append({"id": str(uuid.uuid4()), "sev":"CRITICAL","host":h["name"],
                "title":f"Critical patch — {h['name']}","msg":f"{p['os']} → {p['latest_ver']}","ts":ts})
        elif p.get("status") == "outdated":
            out.append({"id": str(uuid.uuid4()), "sev":"WARNING","host":h["name"],
                "title":f"Patch available — {h['name']}","msg":f"v{p.get('current_ver')} → v{p.get('latest_ver')}","ts":ts})
    return out

@app.post("/api/hosts/{host_id}/scan")
async def trigger_scan(host_id: str):
    h = next((x for x in HOSTS if x["id"] == host_id), None)
    if not h: raise HTTPException(404, "Host not found")
    await asyncio.sleep(1.5)   # simulate SSH + trivy runtime
    seed  = sum(ord(c) for c in host_id)
    vulns = [
        {**v, "id": str(uuid.uuid4()), "scanned_host": h["name"]}
        for i, v in enumerate(CVE_DB)
        if (i + seed) % 4 != 0
    ]
    result = {
        "host_id": h["id"], "host_name": h["name"], "host_ip": h["ip"],
        "scan_id": str(uuid.uuid4()), "ts": datetime.utcnow().isoformat(),
        "vulns": vulns,
        "summary": {
            "critical": sum(1 for v in vulns if v["sev"]=="CRITICAL"),
            "high":     sum(1 for v in vulns if v["sev"]=="HIGH"),
            "medium":   sum(1 for v in vulns if v["sev"]=="MEDIUM"),
            "low":      sum(1 for v in vulns if v["sev"]=="LOW"),
            "total":    len(vulns),
        }
    }
    SCANS[host_id] = result
    return result

@app.get("/api/hosts/{host_id}/scan")
def get_scan(host_id: str):
    r = SCANS.get(host_id)
    if not r: raise HTTPException(404, "No scan yet — POST to /api/hosts/{id}/scan first")
    return r

@app.get("/api/scans")
def all_scans():
    return list(SCANS.values())
