"""
InfraCommand — FastAPI v3.0
DB-backed, user-controlled refresh, proper OS detection
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (get_db, db_save_host, db_get_hosts, db_get_host, db_delete_host,
                      db_save_metrics, db_get_metrics, db_save_vms, db_get_vms,
                      db_save_scan, db_get_scan, db_save_patch, db_get_patch,
                      db_save_logs, db_get_logs)
from collectors import (collect_linux_metrics, collect_windows_metrics,
                        collect_linux_patch, collect_windows_patch,
                        collect_kvm_vms, collect_hyperv_vms,
                        vuln_scan, port_scan)

app = FastAPI(title="InfraCommand API", version="3.0.0", docs_url="/api/docs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class HostCreate(BaseModel):
    name: str
    ip: str
    os_type: str = "linux"
    auth_type: str = "password"
    username: str = "root"
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


def _collect_metrics(host: dict) -> dict:
    return collect_linux_metrics(host) if host["os_type"]=="linux" else collect_windows_metrics(host)

def _collect_patch(host: dict) -> dict:
    return collect_linux_patch(host) if host["os_type"]=="linux" else collect_windows_patch(host)

def _collect_vms(host: dict) -> list:
    return collect_kvm_vms(host) if host["os_type"]=="linux" else collect_hyperv_vms(host)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post("/api/test-connection")
def test_connection(data: HostCreate):
    """Test SSH/WinRM connectivity before saving. Returns detailed error info."""
    host = data.model_dump()
    host["id"] = "test"
    import socket, time
    result = {"ip": host["ip"], "steps": []}

    # Step 1: basic TCP reachability
    port = host.get("winrm_port", 5985) if host["os_type"] == "windows" else host.get("ssh_port", 22)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        t = time.time()
        rc = s.connect_ex((host["ip"], port))
        s.close()
        elapsed = round(time.time()-t, 2)
        if rc == 0:
            result["steps"].append({"step": f"TCP :{port}", "status": "ok", "msg": f"Port open ({elapsed}s)"})
        else:
            result["steps"].append({"step": f"TCP :{port}", "status": "fail", "msg": f"Port {port} refused/unreachable (err {rc})"})
            result["status"] = "fail"
            result["error"]  = f"Cannot reach {host['ip']}:{port} — check firewall or IP"
            return result
    except Exception as e:
        result["steps"].append({"step": f"TCP :{port}", "status": "fail", "msg": str(e)})
        result["status"] = "fail"
        result["error"]  = f"Network error: {e}"
        return result

    # Step 2: auth
    if host["os_type"] == "linux":
        try:
            from collectors import ssh_connect, run, detect_os
            c = ssh_connect(host)
            result["steps"].append({"step": "SSH Auth", "status": "ok", "msg": f"Logged in as {host['username']}"})
            os_info = detect_os(c)
            result["steps"].append({"step": "OS Detect", "status": "ok", "msg": os_info.get("os_pretty","detected")})
            whoami = run(c, "whoami")
            id_out = run(c, "id")
            result["steps"].append({"step": "Permissions", "status": "ok", "msg": f"whoami={whoami} | {id_out[:80]}"})
            c.close()
            result["status"] = "ok"
            result["os"] = os_info
        except Exception as e:
            result["steps"].append({"step": "SSH Auth", "status": "fail", "msg": str(e)})
            result["status"] = "fail"
            result["error"]  = f"SSH failed: {e}"
    else:
        try:
            import winrm
            for transport in ["ntlm", "basic"]:
                try:
                    s = winrm.Session(
                        f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
                        auth=(host["username"], host.get("password","")),
                        transport=transport,
                    )
                    r = s.run_cmd("whoami")
                    if r.status_code == 0:
                        result["steps"].append({"step": f"WinRM ({transport})", "status": "ok",
                                                "msg": r.std_out.decode().strip()[:80]})
                        r2 = s.run_ps("(Get-WmiObject Win32_OperatingSystem).Caption")
                        os_name = r2.std_out.decode().strip() if r2.status_code==0 else "Windows"
                        result["steps"].append({"step": "OS Detect", "status": "ok", "msg": os_name})
                        result["status"] = "ok"
                        result["os"] = {"os_pretty": os_name}
                        break
                    else:
                        result["steps"].append({"step": f"WinRM ({transport})", "status": "fail",
                                                "msg": r.std_err.decode().strip()[:120]})
                except Exception as e2:
                    result["steps"].append({"step": f"WinRM ({transport})", "status": "fail", "msg": str(e2)[:120]})
            if "status" not in result:
                result["status"] = "fail"
                result["error"] = "All WinRM transports failed — check WinRM enabled and credentials"
        except Exception as e:
            result["status"] = "fail"
            result["error"] = f"WinRM error: {e}"
    return result


    return {"status":"ok","ts":datetime.now(timezone.utc).isoformat()}

@app.get("/api/summary")
def summary(db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    metrics = [db_get_metrics(db, h["id"]) or {} for h in hosts]
    cpus = [m.get("cpu",0) for m in metrics if m]
    vms_count = sum(len(db_get_vms(db, h["id"])) for h in hosts)
    return {
        "hosts": len(hosts),
        "total_vms": vms_count,
        "avg_cpu": round(sum(cpus)/len(cpus),1) if cpus else 0,
        "warnings": sum(1 for m in metrics if m.get("cpu",0)>85 or m.get("ram",0)>85),
    }

@app.get("/api/hosts")
def get_hosts(db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    result = []
    for h in hosts:
        m    = db_get_metrics(db, h["id"]) or {}
        vms  = db_get_vms(db, h["id"])
        patch = db_get_patch(db, h["id"]) or {}
        result.append({**h, "metrics": m, "vms": vms, "patch": patch,
                       "password":"***", "ssh_key":"***" if h.get("ssh_key") else None})
    return result

@app.get("/api/hosts/{hid}")
def get_host(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    m     = db_get_metrics(db, hid) or {}
    patch = db_get_patch(db, hid) or {}
    vms   = db_get_vms(db, hid)
    return {**h, "metrics":m, "patch":patch, "vms":vms,
            "password":"***", "ssh_key":"***" if h.get("ssh_key") else None}

@app.post("/api/hosts", status_code=201)
def add_host(data: HostCreate, db: Session = Depends(get_db)):
    hid  = f"h{uuid.uuid4().hex[:8]}"
    host = {**data.model_dump(), "id": hid, "status": "online",
            "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        db_save_host(db, host)
    except Exception as e:
        raise HTTPException(400, f"Database error saving host: {str(e)[:300]}")

    # Each collection step is independent — failure of one never blocks save
    m = {}
    try:
        m = _collect_metrics(host)
        db_save_metrics(db, hid, m)
    except Exception as e:
        m = {"source": "error", "reason": str(e)[:200]}
        db_save_metrics(db, hid, m)

    p = {}
    try:
        p = _collect_patch(host)
        db_save_patch(db, hid, p)
    except Exception as e:
        db_save_patch(db, hid, {"status": "error", "reason": str(e)[:200]})

    vms = []
    try:
        vms = _collect_vms(host)
        db_save_vms(db, hid, vms)
    except Exception as e:
        pass  # VM discovery failure is non-fatal

    connected = m.get("source") == "live"
    msg = f"Connected ✔ — OS: {m.get('os_info',{}).get('os_pretty','detected')}, {len(vms)} VMs found" \
          if connected else \
          f"Host saved. Connection issue: {m.get('reason', 'check credentials/network')}"
    return {"id": hid, "name": host["name"], "connected": connected,
            "vms_found": len(vms), "message": msg}

@app.put("/api/hosts/{hid}")
def update_host(hid: str, data: HostUpdate, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    for k,v in data.model_dump(exclude_none=True).items(): h[k]=v
    db_save_host(db, h)
    return {"id":hid,"message":"Updated"}

@app.delete("/api/hosts/{hid}")
def delete_host(hid: str, db: Session = Depends(get_db)):
    if not db_get_host(db, hid): raise HTTPException(404,"Host not found")
    db_delete_host(db, hid)
    return {"message":"Deleted"}

# ── User-triggered refresh (explicit only) ────────────────────────────────────
@app.post("/api/hosts/{hid}/refresh")
def refresh_host(hid: str, db: Session = Depends(get_db)):
    """Collect fresh metrics + patch + VMs. Each step independent — never fails whole request."""
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404, "Host not found")

    m = {}
    try:
        m = _collect_metrics(h); db_save_metrics(db, hid, m)
    except Exception as e:
        m = {"source": "error", "reason": str(e)[:200]}
        db_save_metrics(db, hid, m)

    try:
        p = _collect_patch(h); db_save_patch(db, hid, p)
    except Exception as e:
        db_save_patch(db, hid, {"status": "error", "reason": str(e)[:200]})

    vms = []
    try:
        vms = _collect_vms(h); db_save_vms(db, hid, vms)
    except Exception as e:
        pass

    src = m.get("source", "error")
    os_name = m.get("os_info", {}).get("os_pretty", "")
    return {"status": "ok", "source": src, "vms": len(vms), "os": os_name,
            "message": f"Refreshed — {os_name or src}, {len(vms)} VMs" if src=="live"
                       else f"Connection error: {m.get('reason','check host')}"}

@app.get("/api/hosts/{hid}/metrics")
def get_metrics(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    return db_get_metrics(db, hid) or {"source":"no_data"}

@app.get("/api/hosts/{hid}/vms")
def get_vms(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    return db_get_vms(db, hid)

@app.post("/api/hosts/{hid}/vms/refresh")
def refresh_vms(hid: str, db: Session = Depends(get_db)):
    """Discover VMs — only on user request."""
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    vms = _collect_vms(h)
    db_save_vms(db, hid, vms)
    return {"count": len(vms), "vms": vms}

@app.get("/api/hosts/{hid}/patch")
def get_patch(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    return db_get_patch(db, hid) or {"status":"No data — click Refresh"}

@app.post("/api/hosts/{hid}/patch/refresh")
def refresh_patch(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    p = _collect_patch(h)
    db_save_patch(db, hid, p)
    return p

@app.get("/api/metrics/history")
def metrics_history():
    import random
    return [{"hour":f"{i:02d}:00","cpu":round(random.uniform(20,90),1),
             "ram":round(random.uniform(30,85),1)} for i in range(24)]

@app.get("/api/logs")
def get_all_logs(level: Optional[str]=None, limit: int=200, db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    all_logs = []
    for h in hosts:
        all_logs.extend(db_get_logs(db, h["id"]))
    if level: all_logs=[l for l in all_logs if l.get("level")==level.upper()]
    return all_logs[:limit]

@app.get("/api/hosts/{hid}/logs")
def get_host_logs(hid: str, db: Session = Depends(get_db)):
    return db_get_logs(db, hid)

@app.post("/api/hosts/{hid}/logs/refresh")
def refresh_logs(hid: str, db: Session = Depends(get_db)):
    from collectors import ssh_connect, run
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    try:
        c = ssh_connect(h)
        raw = run(c, "journalctl -n 100 --no-pager -o short 2>/dev/null || tail -n 100 /var/log/syslog 2>/dev/null || tail -n 100 /var/log/messages 2>/dev/null")
        c.close()
        logs=[]
        for line in raw.splitlines():
            lvl="ERROR" if any(w in line.lower() for w in ["error","fail","crit"]) else "WARN" if "warn" in line.lower() else "INFO"
            logs.append({"ts":datetime.now(timezone.utc).isoformat(),"level":lvl,
                         "msg":line[:200],"host":h["name"],"source":"live"})
        db_save_logs(db, hid, logs)
        return logs
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/patches")
def get_all_patches(db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    return [db_get_patch(db, h["id"]) or {"host":h["name"],"status":"No data"} for h in hosts]

@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    alerts=[]
    for h in hosts:
        m = db_get_metrics(db, h["id"]) or {}
        if m.get("cpu",0)>85:  alerts.append({"id":f"a-{h['id']}-cpu", "host":h["name"],"type":"CPU", "msg":f"CPU at {m['cpu']}%","severity":"critical"})
        if m.get("ram",0)>85:  alerts.append({"id":f"a-{h['id']}-ram", "host":h["name"],"type":"RAM", "msg":f"RAM at {m['ram']}%","severity":"warning"})
        if m.get("disk",0)>80: alerts.append({"id":f"a-{h['id']}-disk","host":h["name"],"type":"Disk","msg":f"Disk at {m['disk']}%","severity":"warning"})
    return alerts

# ── Scan endpoints (on-demand, target-specific) ────────────────────────────────
@app.post("/api/hosts/{hid}/scan")
def scan_host(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    result = vuln_scan(hid, h["name"], "host", h["ip"])
    db_save_scan(db, hid, result)
    return result

@app.get("/api/hosts/{hid}/scan")
def get_host_scan(hid: str, db: Session = Depends(get_db)):
    r = db_get_scan(db, hid)
    if not r: raise HTTPException(404,"No scan — run a scan first")
    return r

@app.post("/api/hosts/{hid}/vms/{vid}/scan")
def scan_vm(hid: str, vid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    vms = db_get_vms(db, hid)
    vm = next((v for v in vms if v["id"]==vid), None)
    if not vm: raise HTTPException(404,"VM not found — refresh VMs first")
    result = vuln_scan(vid, vm["name"], "vm", vm.get("ip","N/A"), h["name"])
    db_save_scan(db, vid, result)
    return result

@app.get("/api/hosts/{hid}/vms/{vid}/scan")
def get_vm_scan(vid: str, hid: str, db: Session = Depends(get_db)):
    r = db_get_scan(db, vid)
    if not r: raise HTTPException(404,"No scan — run a scan first")
    return r

@app.post("/api/hosts/{hid}/portscan")
def portscan_host(hid: str, db: Session = Depends(get_db)):
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404,"Host not found")
    return {"ip": h["ip"], "ports": port_scan(h["ip"]), "scanned_at": datetime.now(timezone.utc).isoformat()}

@app.post("/api/hosts/{hid}/vms/{vid}/portscan")
def portscan_vm(hid: str, vid: str, db: Session = Depends(get_db)):
    vms = db_get_vms(db, hid)
    vm  = next((v for v in vms if v["id"]==vid), None)
    if not vm: raise HTTPException(404,"VM not found")
    return {"ip": vm.get("ip"), "ports": port_scan(vm["ip"]), "scanned_at": datetime.now(timezone.utc).isoformat()}

@app.get("/api/scans")
def get_all_scans(db: Session = Depends(get_db)):
    hosts = db_get_hosts(db)
    results=[]
    for h in hosts:
        s=db_get_scan(db, h["id"])
        if s: results.append(s)
        for vm in db_get_vms(db, h["id"]):
            vs=db_get_scan(db, vm["id"])
            if vs: results.append(vs)
    return results

# ── Debug endpoint — shows raw exception for any host operation ───────────────

@app.get("/api/winrm-setup")
def winrm_setup():
    cmd1 = 'winrm set winrm/config/service/auth @{Basic="true"}'
    cmd2 = 'winrm set winrm/config/service @{AllowUnencrypted="true"}'
    cmd3 = 'winrm set winrm/config/winrs @{MaxMemoryPerShellMB="512"}'
    return {
        "commands": [
            "# Run in PowerShell as Administrator:",
            "winrm quickconfig -q",
            cmd1, cmd2, cmd3,
            "Set-Item WSMan:\\localhost\\Service\\Auth\\Basic -Value $true",
            "Set-Item WSMan:\\localhost\\Service\\AllowUnencrypted -Value $true",
            "netsh advfirewall firewall add rule name=WinRM-HTTP dir=in action=allow protocol=TCP localport=5985",
            "Restart-Service WinRM",
        ],
        "note": "Use username=Administrator and Windows password. Port 5985 must be reachable from K8s node."
    }

@app.post("/api/debug/connect")
def debug_connect(data: HostCreate):
    """Full debug: returns every exception with full traceback"""
    import traceback, socket, time
    host = {**data.model_dump(), "id": "debug"}
    out  = {"ip": host["ip"], "os_type": host["os_type"], "username": host["username"], "steps": []}

    # TCP check
    port = host.get("winrm_port", 5985) if host["os_type"]=="windows" else host.get("ssh_port", 22)
    try:
        s = socket.socket(); s.settimeout(5)
        rc = s.connect_ex((host["ip"], port)); s.close()
        out["steps"].append({"step": f"TCP:{port}", "ok": rc==0, "detail": f"rc={rc}"})
        if rc != 0:
            out["error"] = f"TCP port {port} unreachable on {host['ip']} — rc={rc}"
            return out
    except Exception as e:
        out["steps"].append({"step": f"TCP:{port}", "ok": False, "detail": str(e)})
        out["error"] = str(e); return out

    if host["os_type"] == "linux":
        # SSH
        try:
            from collectors import ssh_connect, run, detect_os
            c = ssh_connect(host)
            out["steps"].append({"step": "SSH", "ok": True, "detail": "connected"})
            try:
                os_i = detect_os(c)
                out["steps"].append({"step": "OS", "ok": True, "detail": str(os_i)})
            except Exception as e:
                out["steps"].append({"step": "OS", "ok": False, "detail": traceback.format_exc()})
            try:
                from collectors import collect_linux_metrics
                m = collect_linux_metrics(host)
                out["steps"].append({"step": "Metrics", "ok": m.get("source")=="live", "detail": str(m)[:300]})
            except Exception as e:
                out["steps"].append({"step": "Metrics", "ok": False, "detail": traceback.format_exc()})
            try:
                from collectors import collect_linux_patch
                p = collect_linux_patch(host)
                out["steps"].append({"step": "Patch", "ok": True, "detail": str(p)[:300]})
            except Exception as e:
                out["steps"].append({"step": "Patch", "ok": False, "detail": traceback.format_exc()})
            try:
                from collectors import collect_kvm_vms
                vms = collect_kvm_vms(host)
                out["steps"].append({"step": "VMs", "ok": True, "detail": f"{len(vms)} VMs: {[v['name'] for v in vms]}"})
            except Exception as e:
                out["steps"].append({"step": "VMs", "ok": False, "detail": traceback.format_exc()})
            c.close()
        except Exception as e:
            out["steps"].append({"step": "SSH", "ok": False, "detail": traceback.format_exc()})
            out["error"] = str(e)
    else:
        # WinRM
        try:
            import winrm
            for transport in ["ntlm", "basic"]:
                try:
                    s = winrm.Session(
                        f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
                        auth=(host["username"], host.get("password","")),
                        transport=transport,
                    )
                    r = s.run_cmd("whoami")
                    out["steps"].append({"step": f"WinRM-{transport}", "ok": r.status_code==0,
                        "detail": r.std_out.decode().strip() or r.std_err.decode().strip()})
                    if r.status_code == 0:
                        r2 = s.run_ps("(Get-WmiObject Win32_OperatingSystem).Caption")
                        out["steps"].append({"step": "OS", "ok": True, "detail": r2.std_out.decode().strip()})
                        try:
                            from collectors import collect_windows_metrics
                            m = collect_windows_metrics(host)
                            out["steps"].append({"step": "Metrics", "ok": m.get("source")=="live", "detail": str(m)[:300]})
                        except Exception as e:
                            out["steps"].append({"step": "Metrics", "ok": False, "detail": traceback.format_exc()})
                        break
                except Exception as e2:
                    out["steps"].append({"step": f"WinRM-{transport}", "ok": False, "detail": traceback.format_exc()})
        except Exception as e:
            out["error"] = traceback.format_exc()
    return out
