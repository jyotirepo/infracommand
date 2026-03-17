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
                        collect_patch_cross, collect_windows_patch,
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
    return collect_patch_cross(host) if host["os_type"]=="linux" else collect_windows_patch(host)

def _collect_vms(host: dict) -> list:
    return collect_kvm_vms(host) if host["os_type"]=="linux" else collect_hyperv_vms(host)

# ── Event log helper ──────────────────────────────────────────────────────────
def _append_log(db, host_id: str, host_name: str, level: str, msg: str, source: str = "system"):
    """Append a single structured log entry for a host."""
    existing = db_get_logs(db, host_id) or []
    entry = {
        "ts":     datetime.now(timezone.utc).isoformat(),
        "level":  level,
        "host":   host_name,
        "host_id":host_id,
        "msg":    msg[:300],
        "source": source,
    }
    existing.insert(0, entry)          # newest first
    db_save_logs(db, host_id, existing[:500])  # keep last 500 per host


def _auto_log_metrics(db, host_id: str, host_name: str, m: dict):
    """Log metrics result and generate error logs for connection failures."""
    if m.get("source") == "live":
        os_n = m.get("os_info", {}).get("os_pretty", "")
        _append_log(db, host_id, host_name, "INFO",
                    f"Metrics collected — CPU:{m.get('cpu',0)}% RAM:{m.get('ram',0)}% Disk:{m.get('disk',0)}% OS:{os_n}", "metrics")
    else:
        _append_log(db, host_id, host_name, "ERROR",
                    f"Metrics collection failed: {m.get('reason','unknown error')}", "metrics")



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
            from collectors import ssh_connect, run, detect_os_cross
            c = ssh_connect(host)
            result["steps"].append({"step": "SSH Auth", "status": "ok", "msg": f"Logged in as {host['username']}"})
            os_info = detect_os_cross(c)
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

@app.get("/api/capacity")
def get_capacity(db: Session = Depends(get_db)):
    """Capacity planning: host hardware totals vs VM allocations vs free."""
    hosts  = db_get_hosts(db)
    report = []
    for h in hosts:
        m    = db_get_metrics(db, h["id"]) or {}
        vms  = db_get_vms(db, h["id"])
        hw   = m.get("hardware", {}) or {}

        # Skip hosts that have never connected (no metrics at all)
        if not m or m.get("source") == "error":
            continue

        # Host capacity — prefer hardware{} block (populated after lscpu collection)
        # Fall back to metrics top-level fields for hosts not yet refreshed
        host_ram_gb    = hw.get("ram_total_gb")   or m.get("ram_total_gb", 0) or 0
        host_vcpus     = hw.get("cpu_vcpu_capacity") or hw.get("cpu_logical") or m.get("cpu_logical", 0) or 0
        host_pcores    = hw.get("cpu_physical_cores", 0) or 0
        host_disk_gb   = hw.get("local_storage_total_gb", 0) or 0
        host_disk_used = hw.get("local_storage_used_gb", 0) or 0
        cpu_model      = hw.get("cpu_model", "")
        cpu_sockets    = hw.get("cpu_sockets", 0)
        threads_per    = hw.get("cpu_threads_per_core", 1) or 1

        # Flag if hardware data is missing (host needs a Refresh)
        hw_missing = not hw or not host_vcpus

        # VM allocations (only running VMs consume resources)
        running_vms  = [v for v in vms if v.get("status") == "running"]
        all_vms_info = []
        vm_ram_alloc  = 0
        vm_vcpu_alloc = 0
        vm_disk_alloc = 0

        for vm in vms:
            ram_mb  = vm.get("ram_mb", 0) or 0
            vcpus   = vm.get("vcpu",   0) or 0
            disk_gb = vm.get("disk_gb",0) or 0
            for s in vm.get("storage", []):
                disk_gb = max(disk_gb, s.get("size_gb", 0) or 0)

            is_running = vm.get("status") == "running"
            if is_running:
                vm_ram_alloc  += ram_mb / 1024
                vm_vcpu_alloc += vcpus
                vm_disk_alloc += disk_gb

            all_vms_info.append({
                "name":    vm.get("name", ""),
                "status":  vm.get("status", ""),
                "ip":      vm.get("ip", "N/A"),
                "ram_gb":  round(ram_mb / 1024, 1),
                "vcpus":   vcpus,
                "disk_gb": round(disk_gb, 1),
            })

        vm_ram_alloc  = round(vm_ram_alloc,  1)
        vm_vcpu_alloc = int(vm_vcpu_alloc)
        vm_disk_alloc = round(vm_disk_alloc, 1)

        free_ram_gb  = round(max(0, host_ram_gb  - vm_ram_alloc),  1) if host_ram_gb  else None
        free_vcpus   = max(0, host_vcpus - vm_vcpu_alloc)            if host_vcpus   else None
        free_disk_gb = round(max(0, host_disk_gb - host_disk_used - vm_disk_alloc), 1) if host_disk_gb else None

        ram_commit_pct  = round(vm_ram_alloc  / host_ram_gb  * 100, 1) if host_ram_gb  else 0
        vcpu_commit_pct = round(vm_vcpu_alloc / host_vcpus   * 100, 1) if host_vcpus   else 0
        disk_commit_pct = round(vm_disk_alloc / host_disk_gb * 100, 1) if host_disk_gb else 0

        report.append({
            "host_id":    h["id"],
            "host_name":  h["name"],
            "host_ip":    h["ip"],
            "os_type":    h["os_type"],
            "hw_missing": hw_missing,         # True = needs Refresh to collect hardware
            "cpu_model":  cpu_model,
            "cpu_sockets":     cpu_sockets,
            "cpu_pcores":      host_pcores,
            "cpu_vcpus":       host_vcpus,
            "threads_per_core": threads_per,
            "ram_total_gb":    host_ram_gb,
            "disk_total_gb":   host_disk_gb,
            "disk_used_gb":    round(host_disk_used, 1),
            "vm_count":        len(vms),
            "vm_running":      len(running_vms),
            "vm_ram_alloc_gb":  vm_ram_alloc,
            "vm_vcpu_alloc":    vm_vcpu_alloc,
            "vm_disk_alloc_gb": vm_disk_alloc,
            "free_ram_gb":     free_ram_gb,
            "free_vcpus":      free_vcpus,
            "free_disk_gb":    free_disk_gb,
            "ram_commit_pct":  ram_commit_pct,
            "vcpu_commit_pct": vcpu_commit_pct,
            "disk_commit_pct": disk_commit_pct,
            "vms": all_vms_info,
        })

    return sorted(report, key=lambda x: x["host_name"])

@app.get("/api/overview")
def get_overview(db: Session = Depends(get_db)):
    """Aggregate resource summary across all live hosts."""
    hosts = db_get_hosts(db)
    total  = len(hosts)
    online = 0
    cpu_sum = ram_sum = disk_sum = 0.0
    ram_total_gb = ram_used_gb = 0.0
    disk_total_gb = disk_used_gb = 0.0
    live_count = 0

    for h in hosts:
        m = db_get_metrics(db, h["id"]) or {}
        if m.get("source") == "live":
            online += 1
            live_count += 1
            cpu_sum  += float(m.get("cpu",  0) or 0)
            ram_sum  += float(m.get("ram",  0) or 0)
            disk_sum += float(m.get("disk", 0) or 0)
            # RAM totals from storage — use free output stored in metrics
            ram_total = float(m.get("ram_total_gb") or 0)
            ram_total_gb += ram_total
            ram_used_gb  += ram_total * float(m.get("ram", 0) or 0) / 100
            # Disk totals from root volume
            for s in m.get("storage", []):
                if s.get("mountpoint") == "/":
                    disk_total_gb += float(s.get("size_gb") or 0)
                    disk_used_gb  += float(s.get("used_gb") or 0)
        else:
            # Still count connection errors in online check
            pass

    n = live_count or 1
    return {
        "total_hosts":   total,
        "hosts_online":  online,
        "avg_cpu":       round(cpu_sum  / n, 1),
        "avg_ram":       round(ram_sum  / n, 1),
        "avg_disk":      round(disk_sum / n, 1),
        "ram_total_gb":  round(ram_total_gb,  1) if ram_total_gb  else None,
        "ram_used_gb":   round(ram_used_gb,   1) if ram_used_gb   else None,
        "disk_total_gb": round(disk_total_gb, 1) if disk_total_gb else None,
        "disk_used_gb":  round(disk_used_gb,  1) if disk_used_gb  else None,
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
    _append_log(db, hid, host["name"], "INFO", f"Host added — IP:{host['ip']} OS:{host['os_type']}", "system")
    _auto_log_metrics(db, hid, host["name"], m)

    p = {}
    try:
        p = _collect_patch(host)
        db_save_patch(db, hid, p)
        _append_log(db, hid, host["name"], "INFO", f"Patch info collected — status:{p.get('status','?')} pending:{p.get('updates_available',0)}", "patch")
    except Exception as e:
        db_save_patch(db, hid, {"status": "error", "reason": str(e)[:200]})
        _append_log(db, hid, host["name"], "WARN", f"Patch collection failed: {str(e)[:200]}", "patch")

    vms = []
    try:
        vms = _collect_vms(host)
        db_save_vms(db, hid, vms)
        _append_log(db, hid, host["name"], "INFO", f"VM discovery complete — {len(vms)} VMs found", "vms")
        for vm in vms:
            try:
                _append_log(db, vm["id"], vm["name"], "INFO",
                            f"VM discovered on {host['name']} — status:{vm.get('status','?')} IP:{vm.get('ip','N/A')}", "vm-discovery")
            except Exception:
                pass
    except Exception as e:
        _append_log(db, hid, host["name"], "WARN", f"VM discovery failed: {str(e)[:150]}", "vms")

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
        try: db_save_metrics(db, hid, m)
        except Exception: pass
    try: _append_log(db, hid, h["name"], "INFO", "Manual refresh triggered", "system")
    except Exception: pass
    try: _auto_log_metrics(db, hid, h["name"], m)
    except Exception: pass

    try:
        p = _collect_patch(h); db_save_patch(db, hid, p)
        try: _append_log(db, hid, h["name"], "INFO", f"Patch refreshed — {p.get('status','?')}", "patch")
        except Exception: pass
    except Exception as e:
        try: db_save_patch(db, hid, {"status": "error", "reason": str(e)[:200]})
        except Exception: pass
        try: _append_log(db, hid, h["name"], "WARN", f"Patch refresh failed: {str(e)[:150]}", "patch")
        except Exception: pass

    vms = []
    try:
        vms = _collect_vms(h); db_save_vms(db, hid, vms)
        try: _append_log(db, hid, h["name"], "INFO", f"VMs refreshed — {len(vms)} found", "vms")
        except Exception: pass
        # Log per-VM status into VM-specific log store
        for vm in vms:
            try:
                vm_state = vm.get("status","unknown")
                vm_cpu   = vm.get("metrics",{}).get("cpu",0)
                vm_ram   = vm.get("metrics",{}).get("ram",0)
                vm_ip    = vm.get("ip","N/A")
                _append_log(db, vm["id"], vm["name"],
                            "INFO" if vm_state=="running" else "WARN",
                            f"VM {vm_state} — CPU:{vm_cpu}% RAM:{vm_ram}% IP:{vm_ip}", "vm-metrics")
            except Exception:
                pass
    except Exception as e:
        try: _append_log(db, hid, h["name"], "WARN", f"VM refresh failed: {str(e)[:150]}", "vms")
        except Exception: pass

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

@app.get("/api/hosts/{hid}/vms/{vid}/logs")
def get_vm_logs(hid: str, vid: str, db: Session = Depends(get_db)):
    """Return logs from the VM's own log store (vid-based),
    falling back to host logs filtered by VM name."""
    # Try VM-specific log store first
    vm_logs = db_get_logs(db, vid)
    if vm_logs:
        return vm_logs
    # Fallback: filter host logs for entries mentioning this VM
    vms = db_get_vms(db, hid)
    vm = next((v for v in vms if v["id"] == vid), None)
    vm_name = (vm.get("name") or "").lower() if vm else ""
    host_logs = db_get_logs(db, hid) or []
    if vm_name:
        filtered = [l for l in host_logs if vm_name in (l.get("msg","") or "").lower()
                    or l.get("source") in ("vms",)]
        return filtered if filtered else []
    return []

@app.post("/api/hosts/{hid}/vms/{vid}/promote")
def promote_vm_to_host(hid: str, vid: str, data: dict, db: Session = Depends(get_db)):
    """Add a discovered VM as a standalone monitored host."""
    vms = db_get_vms(db, hid)
    vm = next((v for v in vms if v["id"] == vid), None)
    if not vm: raise HTTPException(404, "VM not found")
    if not data.get("username") or not data.get("password"):
        raise HTTPException(400, "username and password required")
    # Build host entry from VM data
    new_hid = f"h{uuid.uuid4().hex[:8]}"
    host = {
        "id": new_hid, "name": vm["name"],
        "ip": vm.get("ip",""), "os_type": "linux" if vm.get("hypervisor")=="KVM" else "windows",
        "username": data["username"], "password": data.get("password",""),
        "ssh_key": data.get("ssh_key",""), "port": int(data.get("port", 22)),
        "created_at": datetime.now(timezone.utc),
        "tags": f"promoted-from:{vm.get('name','')}",
    }
    db_save_host(db, host)
    _append_log(db, new_hid, host["name"], "INFO",
                f"Host promoted from VM on {db_get_host(db,hid)['name']}", "system")
    # Kick off initial metrics collection async-style (best effort)
    m = {}
    try:
        m = _collect_metrics(host); db_save_metrics(db, new_hid, m)
    except Exception as e:
        db_save_metrics(db, new_hid, {"source":"error","reason":str(e)[:200]})
    _auto_log_metrics(db, new_hid, host["name"], m)
    return {"status": "ok", "host_id": new_hid, "message": f"{vm['name']} added as standalone host"}

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
    hosts  = db_get_hosts(db)
    alerts = []
    for h in hosts:
        m = db_get_metrics(db, h["id"]) or {}
        p = db_get_patch(db, h["id"])   or {}
        hname = h["name"]
        hid   = h["id"]
        ts    = m.get("updated_at", "")

        # ── Connection error ──────────────────────────────────────
        if m.get("source") == "error":
            alerts.append({"id": f"a-{hid}-conn", "host": hname, "type": "Connection",
                "severity": "critical", "ts": ts,
                "msg": f"Cannot connect: {m.get('reason','check credentials/network')[:150]}"})
        else:
            # ── Resource alerts ───────────────────────────────────
            if m.get("cpu", 0) > 85:
                alerts.append({"id": f"a-{hid}-cpu", "host": hname, "type": "CPU", "severity": "critical", "ts": ts,
                    "msg": f"CPU at {m['cpu']}%"})
            if m.get("ram", 0) > 85:
                alerts.append({"id": f"a-{hid}-ram", "host": hname, "type": "RAM", "severity": "warning", "ts": ts,
                    "msg": f"RAM at {m['ram']}%"})
            if m.get("disk", 0) > 80:
                alerts.append({"id": f"a-{hid}-disk", "host": hname, "type": "Disk", "severity": "warning", "ts": ts,
                    "msg": f"Root disk at {m['disk']}%"})
            # ── Per-volume storage alerts ─────────────────────────
            for s in m.get("storage", []):
                if s.get("use_pct", 0) > 90:
                    alerts.append({"id": f"a-{hid}-vol-{s.get('device','?')}", "host": hname,
                        "type": "Storage", "severity": "critical", "ts": ts,
                        "msg": f"Volume {s.get('mountpoint','?')} at {s['use_pct']}% ({s.get('avail_gb',0):.1f}GB free)"})
            # ── NIC error alerts ──────────────────────────────────
            for nic in m.get("nics", []):
                rx_err = nic.get("rx_err", 0) or 0
                tx_err = nic.get("tx_err", 0) or 0
                if rx_err > 100 or tx_err > 100:
                    alerts.append({"id": f"a-{hid}-nic-{nic['name']}", "host": hname,
                        "type": "NIC Error", "severity": "warning", "ts": ts,
                        "msg": f"NIC {nic['name']} errors — RX:{rx_err} TX:{tx_err}"})

        # ── Patch alerts (all hosts) ───────────────────────────────
        if p.get("source") == "error":
            alerts.append({"id": f"a-{hid}-patch-err", "host": hname, "type": "Patch", "severity": "warning", "ts": "",
                "msg": f"Patch collection failed: {p.get('reason','unknown')[:120]}"})
        elif p.get("security_updates", 0) > 0:
            alerts.append({"id": f"a-{hid}-patch-sec", "host": hname, "type": "Security Patch", "severity": "critical", "ts": "",
                "msg": f"{p['security_updates']} critical security updates pending"})
        elif p.get("updates_available", 0) > 0:
            alerts.append({"id": f"a-{hid}-patch", "host": hname, "type": "Patch", "severity": "warning", "ts": "",
                "msg": f"{p['updates_available']} updates available"})

    # Sort: critical first, then by host name
    alerts.sort(key=lambda a: (0 if a["severity"] == "critical" else 1, a["host"]))
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

@app.patch("/api/hosts/{hid}/vms/{vid}/ip")
def set_vm_ip(hid: str, vid: str, data: dict, db: Session = Depends(get_db)):
    """Manually set IP for a VM (needed for macvtap direct-mode VMs)."""
    new_ip = data.get("ip","").strip()
    if not new_ip: raise HTTPException(400,"ip required")
    vms = db_get_vms(db, hid)
    vm  = next((v for v in vms if v["id"]==vid), None)
    if not vm: raise HTTPException(404,"VM not found")
    vm["ip"] = new_ip
    # Update in the VMs list and re-save
    updated = [vm if v["id"]==vid else v for v in vms]
    db_save_vms(db, hid, updated)
    _append_log(db, hid, vm.get("name","?"), "INFO", f"VM IP manually set to {new_ip}", "manual")
    return {"status":"ok","ip":new_ip}

@app.get("/api/hosts/{hid}/debug/vm-ips")
def debug_vm_ips(hid: str, db: Session = Depends(get_db)):
    """Debug endpoint: run VM IP detection commands and return raw output."""
    from collectors import ssh_connect, run
    h = db_get_host(db, hid)
    if not h: raise HTTPException(404, "Host not found")
    results = {}
    try:
        c = ssh_connect(h)
        # List all VMs
        vm_list = run(c, "virsh list --all 2>/dev/null")
        results["virsh_list"] = vm_list

        # For each running VM, run all IP detection commands
        vm_details = {}
        for line in vm_list.splitlines()[2:]:
            parts = line.split()
            if len(parts) < 2: continue
            vname = parts[1]
            state = parts[2] if len(parts) > 2 else "unknown"
            d = {"state": state}
            d["domifaddr"]  = run(c, f"virsh domifaddr {vname} 2>/dev/null")
            d["domiflist"]  = run(c, f"virsh domiflist {vname} 2>/dev/null")
            # Extract MACs and do ARP lookup
            macs = []
            for il in d["domiflist"].splitlines()[2:]:
                ilp = il.split()
                if len(ilp) >= 5 and ilp[4] not in ("-",""):
                    macs.append(ilp[4])
            d["macs"] = macs
            d["arp_table"] = run(c, "arp -n 2>/dev/null")
            d["ip_neigh"]  = run(c, "ip neigh 2>/dev/null")
            for mac in macs:
                d[f"arp_{mac}"]   = run(c, f"arp -n 2>/dev/null | grep -i '{mac}'")
                d[f"neigh_{mac}"] = run(c, f"ip neigh 2>/dev/null | grep -i '{mac}'")
            vm_details[vname] = d
        results["vms"] = vm_details
        c.close()
    except Exception as e:
        results["error"] = str(e)
    return results

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
            from collectors import ssh_connect, run, detect_os_cross
            c = ssh_connect(host)
            out["steps"].append({"step": "SSH", "ok": True, "detail": "connected"})
            try:
                os_i = detect_os_cross(c)
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
                from collectors import collect_patch_cross
                p = collect_patch_cross(host)
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
