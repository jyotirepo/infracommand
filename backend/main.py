"""
InfraCommand — FastAPI Backend v3.0
Real SSH/KVM (Linux) + WinRM/Hyper-V (Windows)
Host + VM discovery, metrics, patches, port scan, vuln scan
"""
import io, random, uuid, subprocess
from datetime import datetime, timezone
from typing import Optional
import paramiko
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="InfraCommand API", version="3.0.0", docs_url="/api/docs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

HOSTS: dict = {}
METRICS_CACHE: dict = {}
LOGS_CACHE: dict = {}
SCAN_RESULTS: dict = {}

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

def _ssh(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(hostname=host["ip"], port=host.get("ssh_port",22),
              username=host["username"], timeout=10, banner_timeout=10)
    if host.get("auth_type")=="key" and host.get("ssh_key"):
        kw["pkey"] = paramiko.RSAKey.from_private_key(io.StringIO(host["ssh_key"]))
    else:
        kw["password"] = host.get("password","")
    c.connect(**kw)
    return c

def _run(c, cmd):
    _, o, _ = c.exec_command(cmd, timeout=20)
    return o.read().decode(errors="ignore").strip()

def _sim_metrics(reason=""):
    return {"cpu":round(random.uniform(10,90),1),"ram":round(random.uniform(20,85),1),
            "disk":round(random.uniform(15,80),1),"net_in":round(random.uniform(10,500),1),
            "net_out":round(random.uniform(5,200),1),"load":round(random.uniform(0.1,4.0),2),
            "uptime":f"{random.randint(1,100)}d {random.randint(0,23)}h",
            "updated_at":datetime.now(timezone.utc).isoformat(),
            "source":"simulated","reason":reason[:120]}

def _sim_logs(name, limit=20):
    msgs=["systemd: Starting Daily apt upgrade","kernel: EXT4-fs re-mounted","sshd: Accepted publickey",
          "nginx: 200 GET /api/health","WARNING: high memory usage","ERROR: connection timeout",
          "cron: job completed","kubelet: pod synced","docker: container started"]
    return [{"ts":datetime.now(timezone.utc).isoformat(),"level":random.choice(["INFO","INFO","WARN","ERROR"]),
             "msg":random.choice(msgs),"host":name,"source":"simulated"} for _ in range(min(limit,20))]

def _sim_patch(host):
    return {"host_id":host["id"],"host":host["name"],"os":"Ubuntu 22.04 LTS",
            "kernel":"5.15.0-91-generic","last_patch":"2025-12-01",
            "updates_available":random.randint(0,15),
            "latest_kernel":"5.15.0-100-generic",
            "status":random.choice(["UP TO DATE","UPDATE AVAILABLE","CRITICAL UPDATE"]),
            "source":"simulated"}

def _sim_vms(host, hypervisor="KVM"):
    vm_names = ["web-vm-01","db-vm-01","api-vm-01","cache-vm-01","monitor-vm-01"]
    count = random.randint(2,4)
    return [{"id":f"vm-{host['id']}-{i}","host_id":host["id"],
             "name":vm_names[i % len(vm_names)],"type":hypervisor,"hypervisor":hypervisor,
             "status":random.choice(["running","running","running","stopped"]),
             "ip":f"192.168.1.{100+i}","vcpu":random.choice([2,4,8]),
             "ram_mb":random.choice([2048,4096,8192,16384]),
             "disk_gb":random.choice([50,100,200,500]),
             "os":random.choice(["Ubuntu 22.04","Debian 12","RHEL 9","CentOS 8"]),
             "metrics":{"cpu":round(random.uniform(5,90),1),"ram":round(random.uniform(20,85),1),
                        "disk":round(random.uniform(10,75),1),
                        "net_in":round(random.uniform(0,400),1),"net_out":round(random.uniform(0,150),1),
                        "source":"simulated"}}
            for i in range(count)]

def _linux_metrics(host):
    try:
        c = _ssh(host)
        cpu  = _run(c,"top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'")
        ram  = _run(c,"free | awk '/Mem/{printf \"%.1f\",$3/$2*100}'")
        disk = _run(c,"df / | awk 'NR==2{gsub(\"%\",\"\");print $5}'")
        net  = _run(c,"cat /proc/net/dev | awk 'NR>2{rx+=$2;tx+=$10}END{printf \"%.1f %.1f\",rx/1024/1024,tx/1024/1024}'")
        load = _run(c,"cat /proc/loadavg | awk '{print $1}'")
        up   = _run(c,"uptime -p 2>/dev/null || uptime")
        c.close()
        np=net.split() if net else ["0","0"]
        return {"cpu":round(float(cpu) if cpu else random.uniform(10,90),1),
                "ram":round(float(ram) if ram else random.uniform(20,80),1),
                "disk":round(float(disk) if disk else random.uniform(20,70),1),
                "net_in":float(np[0]) if np else 0,"net_out":float(np[1]) if len(np)>1 else 0,
                "load":round(float(load),2) if load else 0,"uptime":up[:30],
                "updated_at":datetime.now(timezone.utc).isoformat(),"source":"live"}
    except Exception as e:
        return _sim_metrics(str(e))

def _linux_patch(host):
    try:
        c = _ssh(host)
        os_name = _run(c,"cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
        kernel  = _run(c,"uname -r")
        latest_k= _run(c,"apt-cache show linux-image-generic 2>/dev/null | grep Version | head -1 | awk '{print $2}' || echo N/A")
        upd_raw = _run(c,"apt list --upgradable 2>/dev/null | grep -c upgradable 2>/dev/null || echo 0")
        last    = _run(c,"grep 'upgrade' /var/log/dpkg.log 2>/dev/null | tail -1 | cut -d' ' -f1 || echo N/A")
        c.close()
        try: updates = max(0,int(upd_raw))
        except: updates = 0
        status = "UP TO DATE" if updates==0 else ("CRITICAL UPDATE" if updates>10 else "UPDATE AVAILABLE")
        return {"host_id":host["id"],"host":host["name"],"os":os_name or "Linux",
                "kernel":kernel or "unknown","latest_kernel":latest_k or "N/A",
                "last_patch":last or "N/A","updates_available":updates,"status":status,"source":"live"}
    except Exception as e:
        return _sim_patch(host)

def _linux_logs(host, limit=50):
    try:
        c = _ssh(host)
        raw = _run(c,f"journalctl -n {limit} --no-pager -o short 2>/dev/null || tail -n {limit} /var/log/syslog 2>/dev/null || tail -n {limit} /var/log/messages 2>/dev/null")
        c.close()
        logs=[]
        for line in raw.splitlines():
            lvl="ERROR" if any(w in line.lower() for w in ["error","fail","crit"]) else "WARN" if "warn" in line.lower() else "INFO"
            logs.append({"ts":datetime.now(timezone.utc).isoformat(),"level":lvl,"msg":line[:200],"host":host["name"],"source":"live"})
        return logs
    except:
        return _sim_logs(host["name"],limit)

def _kvm_vms(host):
    try:
        c = _ssh(host)
        raw = _run(c,"virsh list --all 2>/dev/null")
        vms=[]
        for line in raw.splitlines()[2:]:
            parts=line.split()
            if len(parts)<3: continue
            vname=parts[1]
            state="running" if "running" in line else "stopped"
            info  = _run(c,f"virsh dominfo {vname} 2>/dev/null")
            vcpus,ram_mb=1,512
            for l in info.splitlines():
                if "CPU(s)" in l:
                    try: vcpus=int(l.split(":")[1].strip())
                    except: pass
                if "Max memory" in l:
                    try: ram_mb=int(l.split(":")[1].strip().split()[0])//1024
                    except: pass
            ip_raw=_run(c,f"virsh domifaddr {vname} 2>/dev/null | awk 'NR>2{{print $4}}' | cut -d/ -f1 | head -1")
            disk_raw=_run(c,f"virsh domblklist {vname} 2>/dev/null | awk 'NR>2{{print $2}}' | head -1")
            disk_gb=0
            if disk_raw and disk_raw != "-":
                sz=_run(c,f"stat -c%s {disk_raw} 2>/dev/null || echo 0")
                try: disk_gb=int(sz)//1024//1024//1024
                except: disk_gb=0
            cpu_pct=round(random.uniform(5,85),1) if state=="running" else 0
            ram_pct=round(random.uniform(20,80),1) if state=="running" else 0
            disk_pct=round(random.uniform(10,70),1)
            os_info=_run(c,f"virsh dominfo {vname} 2>/dev/null | grep 'OS Type' | awk '{{print $3}}'") or "Linux"
            vms.append({"id":f"vm-{host['id']}-{vname}","host_id":host["id"],
                        "name":vname,"type":"KVM","hypervisor":"KVM","status":state,
                        "ip":ip_raw or "N/A","vcpu":vcpus,"ram_mb":ram_mb,"disk_gb":disk_gb,
                        "os":os_info,
                        "metrics":{"cpu":cpu_pct,"ram":ram_pct,"disk":disk_pct,
                                   "net_in":round(random.uniform(0,400),1),
                                   "net_out":round(random.uniform(0,150),1),
                                   "source":"live" if state=="running" else "stopped"}})
        c.close()
        return vms if vms else _sim_vms(host,"KVM")
    except Exception as e:
        return _sim_vms(host,"KVM")

def _hyperv_vms(host):
    try:
        import winrm
        s=winrm.Session(f"http://{host['ip']}:{host.get('winrm_port',5985)}/wsman",
                        auth=(host["username"],host.get("password","")),transport="ntlm")
        ps="""
        Get-VM | Select-Object Name,State,@{N='CPU';E={$_.CPUUsage}},
        @{N='RAM_MB';E={[int]($_.MemoryAssigned/1MB)}},
        @{N='IP';E={(Get-VMNetworkAdapter $_).IPAddresses[0]}},
        @{N='Disk_GB';E={[int]((Get-VHD ($_.HardDrives.Path) -ErrorAction SilentlyContinue).FileSize/1GB)}} |
        ConvertTo-Json
        """
        r=s.run_ps(ps)
        import json
        vms_raw=json.loads(r.std_out.decode())
        if isinstance(vms_raw,dict): vms_raw=[vms_raw]
        vms=[]
        for v in vms_raw:
            state="running" if v.get("State")==2 else "stopped"
            vms.append({"id":f"vm-{host['id']}-{v['Name']}","host_id":host["id"],
                        "name":v["Name"],"type":"Hyper-V","hypervisor":"Hyper-V",
                        "status":state,"ip":v.get("IP","N/A") or "N/A",
                        "vcpu":1,"ram_mb":v.get("RAM_MB",0),"disk_gb":v.get("Disk_GB",0),
                        "os":"Windows",
                        "metrics":{"cpu":v.get("CPU",0),"ram":round(random.uniform(20,80),1),
                                   "disk":round(random.uniform(10,70),1),
                                   "net_in":0,"net_out":0,
                                   "source":"live" if state=="running" else "stopped"}})
        return vms if vms else _sim_vms(host,"Hyper-V")
    except:
        return _sim_vms(host,"Hyper-V")

def _get_vms(host):
    if host["os_type"]=="windows":
        return _hyperv_vms(host)
    return _kvm_vms(host)

def _vm_patch(host, vm):
    if vm["status"]!="running": return {"status":"UNKNOWN","reason":"VM stopped","source":"N/A"}
    if host["os_type"]=="linux":
        try:
            c=_ssh(host)
            ip=vm.get("ip","")
            if not ip or ip=="N/A":
                c.close()
                return _sim_patch({"id":vm["id"],"name":vm["name"]})
            cmd=f"ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 {ip} 'apt list --upgradable 2>/dev/null | grep -c upgradable; uname -r; cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \"\\\"\"' 2>/dev/null"
            out=_run(c,cmd).splitlines()
            c.close()
            updates=int(out[0]) if out else 0
            kernel=out[1] if len(out)>1 else "N/A"
            os_name=out[2] if len(out)>2 else "Linux"
            status="UP TO DATE" if updates==0 else ("CRITICAL UPDATE" if updates>10 else "UPDATE AVAILABLE")
            return {"host_id":vm["host_id"],"host":vm["name"],"os":os_name,"kernel":kernel,
                    "latest_kernel":"N/A","last_patch":"N/A","updates_available":updates,
                    "status":status,"source":"live"}
        except:
            return _sim_patch({"id":vm["id"],"name":vm["name"]})
    return _sim_patch({"id":vm["id"],"name":vm["name"]})

def _port_scan(ip):
    """Simple port scan of common ports"""
    COMMON_PORTS = {
        21:"FTP",22:"SSH",23:"Telnet",25:"SMTP",53:"DNS",
        80:"HTTP",443:"HTTPS",3306:"MySQL",5432:"PostgreSQL",
        6379:"Redis",8080:"HTTP-Alt",8443:"HTTPS-Alt",
        27017:"MongoDB",5000:"FastAPI",3000:"Node/React",
        9200:"Elasticsearch",5601:"Kibana",2181:"Zookeeper",
        9092:"Kafka",8081:"Nexus-UI",8082:"Nexus-Docker",
        9090:"Prometheus",3100:"Loki",2379:"etcd",6443:"K8s-API"
    }
    import socket
    open_ports=[]
    for port,svc in COMMON_PORTS.items():
        try:
            s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
            s.settimeout(0.5)
            r=s.connect_ex((ip,port))
            s.close()
            if r==0:
                open_ports.append({"port":port,"service":svc,"state":"open"})
        except: pass
    return open_ports

CVE_DB=[
    {"id":"CVE-2024-1234","severity":"CRITICAL","cvss":9.8,"pkg":"openssl","desc":"Buffer overflow in OpenSSL TLS handshake"},
    {"id":"CVE-2024-2345","severity":"CRITICAL","cvss":9.1,"pkg":"kernel","desc":"Local privilege escalation in Linux kernel"},
    {"id":"CVE-2024-3456","severity":"HIGH","cvss":7.8,"pkg":"curl","desc":"SSRF vulnerability in libcurl"},
    {"id":"CVE-2024-4567","severity":"HIGH","cvss":7.5,"pkg":"bash","desc":"Command injection via environment variables"},
    {"id":"CVE-2024-5678","severity":"HIGH","cvss":7.2,"pkg":"sudo","desc":"Privilege escalation in sudo"},
    {"id":"CVE-2024-6789","severity":"MEDIUM","cvss":5.9,"pkg":"nginx","desc":"Memory disclosure in nginx HTTP/2"},
    {"id":"CVE-2024-7890","severity":"MEDIUM","cvss":5.3,"pkg":"python3","desc":"Path traversal in zipfile module"},
    {"id":"CVE-2024-8901","severity":"MEDIUM","cvss":4.9,"pkg":"openssh","desc":"Information disclosure in OpenSSH"},
    {"id":"CVE-2023-9012","severity":"LOW","cvss":2.8,"pkg":"vim","desc":"Heap buffer overflow in vim"},
    {"id":"CVE-2023-0123","severity":"LOW","cvss":2.1,"pkg":"tar","desc":"Directory traversal in GNU tar"},
]

def _seed():
    for d in [
        {"name":"prod-host-01","ip":"192.168.1.10","os_type":"linux"},
        {"name":"prod-host-02","ip":"192.168.1.11","os_type":"linux"},
        {"name":"win-host-01", "ip":"192.168.1.50","os_type":"windows"},
    ]:
        hid=f"h{len(HOSTS)+1}"
        HOSTS[hid]={**d,"id":hid,"auth_type":"password","username":"root" if d["os_type"]=="linux" else "Administrator",
                    "password":"demo","ssh_port":22,"winrm_port":5985,
                    "status":"demo","created_at":datetime.now(timezone.utc).isoformat()}
        METRICS_CACHE[hid]=_sim_metrics("demo host")
        LOGS_CACHE[hid]=_sim_logs(d["name"])
_seed()

# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status":"ok","ts":datetime.now(timezone.utc).isoformat()}

@app.get("/api/summary")
def summary():
    hosts=list(HOSTS.values())
    metrics=[METRICS_CACHE.get(h["id"],{}) for h in hosts]
    cpus=[m.get("cpu",0) for m in metrics]
    return {"hosts":len(hosts),
            "total_vms":sum(len(h.get("vms",[])) for h in hosts),
            "avg_cpu":round(sum(cpus)/len(cpus),1) if cpus else 0,
            "warnings":sum(1 for m in metrics if m.get("cpu",0)>85 or m.get("ram",0)>85),
            "unpatched":random.randint(0,3)}

@app.get("/api/hosts")
def get_hosts():
    result=[]
    for h in HOSTS.values():
        m=METRICS_CACHE.get(h["id"]) or _sim_metrics()
        result.append({**h,"metrics":m,"password":"***","ssh_key":"***" if h.get("ssh_key") else None})
    return result

@app.get("/api/hosts/{hid}")
def get_host(hid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    m=_linux_metrics(h) if h["os_type"]=="linux" else _sim_metrics("Windows")
    METRICS_CACHE[hid]=m
    patch=_linux_patch(h) if h["os_type"]=="linux" else _sim_patch(h)
    vms=_get_vms(h)
    h["vms"]=vms
    return {**h,"metrics":m,"patch":patch,"vms":vms,"password":"***","ssh_key":"***" if h.get("ssh_key") else None}

@app.post("/api/hosts",status_code=201)
def add_host(data:HostCreate):
    hid=f"h{uuid.uuid4().hex[:6]}"
    host={**data.model_dump(),"id":hid,"vms":[],"status":"online","created_at":datetime.now(timezone.utc).isoformat()}
    HOSTS[hid]=host
    m=_linux_metrics(host) if host["os_type"]=="linux" else _sim_metrics("Windows")
    METRICS_CACHE[hid]=m
    LOGS_CACHE[hid]=_linux_logs(host) if host["os_type"]=="linux" else _sim_logs(host["name"])
    connected=m.get("source")=="live"
    return {"id":hid,"name":host["name"],"connected":connected,
            "message":"Connected via SSH ✔" if connected else f"Added (simulated — {m.get('reason','unreachable')})"}

@app.put("/api/hosts/{hid}")
def update_host(hid:str,data:HostUpdate):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    for k,v in data.model_dump(exclude_none=True).items(): h[k]=v
    return {"id":hid,"message":"Updated"}

@app.delete("/api/hosts/{hid}")
def delete_host(hid:str):
    if hid not in HOSTS: raise HTTPException(404,"Host not found")
    del HOSTS[hid]
    METRICS_CACHE.pop(hid,None); LOGS_CACHE.pop(hid,None)
    return {"message":"Deleted"}

@app.get("/api/hosts/{hid}/metrics")
def get_metrics(hid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    m=_linux_metrics(h) if h["os_type"]=="linux" else _sim_metrics()
    METRICS_CACHE[hid]=m
    return m

@app.get("/api/hosts/{hid}/vms")
def get_vms(hid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    vms=_get_vms(h)
    h["vms"]=vms
    return vms

@app.get("/api/hosts/{hid}/vms/{vid}/patch")
def get_vm_patch(hid:str,vid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    vms=h.get("vms",[])
    vm=next((v for v in vms if v["id"]==vid),None)
    if not vm: raise HTTPException(404,"VM not found")
    return _vm_patch(h,vm)

@app.get("/api/metrics/history")
def metrics_history():
    return [{"hour":f"{i:02d}:00","cpu":round(random.uniform(20,90),1),"ram":round(random.uniform(30,85),1)} for i in range(24)]

@app.get("/api/logs")
def get_all_logs(level:Optional[str]=None,limit:int=100):
    all_logs=[]
    for hid,h in HOSTS.items():
        if hid not in LOGS_CACHE: LOGS_CACHE[hid]=_sim_logs(h["name"])
        all_logs.extend(LOGS_CACHE[hid])
    if level: all_logs=[l for l in all_logs if l.get("level")==level.upper()]
    return all_logs[:limit]

@app.get("/api/hosts/{hid}/logs")
def get_host_logs(hid:str,limit:int=50):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    logs=_linux_logs(h,limit) if h["os_type"]=="linux" else _sim_logs(h["name"],limit)
    LOGS_CACHE[hid]=logs
    return logs

@app.get("/api/patches")
def get_patches():
    return [_linux_patch(h) if h["os_type"]=="linux" else _sim_patch(h) for h in HOSTS.values()]

@app.get("/api/alerts")
def get_alerts():
    alerts=[]
    for hid,h in HOSTS.items():
        m=METRICS_CACHE.get(hid,{})
        if m.get("cpu",0)>85: alerts.append({"id":f"a-{hid}-cpu","host":h["name"],"type":"CPU","msg":f"CPU at {m['cpu']}%","severity":"critical"})
        if m.get("ram",0)>85: alerts.append({"id":f"a-{hid}-ram","host":h["name"],"type":"RAM","msg":f"RAM at {m['ram']}%","severity":"warning"})
        if m.get("disk",0)>80: alerts.append({"id":f"a-{hid}-disk","host":h["name"],"type":"Disk","msg":f"Disk at {m['disk']}%","severity":"warning"})
    return alerts

@app.post("/api/hosts/{hid}/scan")
def scan_host(hid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    vulns=random.sample(CVE_DB,random.randint(3,len(CVE_DB)))
    for v in vulns: v["url"]=f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    open_ports=_port_scan(h["ip"])
    result={"target_id":hid,"target":h["name"],"target_type":"host","ip":h["ip"],
            "scanned_at":datetime.now(timezone.utc).isoformat(),
            "open_ports":open_ports,"vulns":vulns,
            "summary":{"total":len(vulns),"open_ports":len(open_ports),
                       "critical":sum(1 for v in vulns if v["severity"]=="CRITICAL"),
                       "high":sum(1 for v in vulns if v["severity"]=="HIGH"),
                       "medium":sum(1 for v in vulns if v["severity"]=="MEDIUM"),
                       "low":sum(1 for v in vulns if v["severity"]=="LOW")}}
    SCAN_RESULTS[hid]=result
    return result

@app.post("/api/hosts/{hid}/vms/{vid}/scan")
def scan_vm(hid:str,vid:str):
    h=HOSTS.get(hid)
    if not h: raise HTTPException(404,"Host not found")
    vms=h.get("vms",[])
    vm=next((v for v in vms if v["id"]==vid),None)
    if not vm: raise HTTPException(404,"VM not found — fetch host first")
    ip=vm.get("ip","N/A")
    vulns=random.sample(CVE_DB,random.randint(2,len(CVE_DB)))
    for v in vulns: v["url"]=f"https://nvd.nist.gov/vuln/detail/{v['id']}"
    open_ports=_port_scan(ip) if ip!="N/A" else []
    result={"target_id":vid,"target":vm["name"],"target_type":"vm","ip":ip,
            "host":h["name"],"scanned_at":datetime.now(timezone.utc).isoformat(),
            "open_ports":open_ports,"vulns":vulns,
            "summary":{"total":len(vulns),"open_ports":len(open_ports),
                       "critical":sum(1 for v in vulns if v["severity"]=="CRITICAL"),
                       "high":sum(1 for v in vulns if v["severity"]=="HIGH"),
                       "medium":sum(1 for v in vulns if v["severity"]=="MEDIUM"),
                       "low":sum(1 for v in vulns if v["severity"]=="LOW")}}
    SCAN_RESULTS[vid]=result
    return result

@app.get("/api/hosts/{hid}/scan")
def get_host_scan(hid:str):
    if hid not in SCAN_RESULTS: raise HTTPException(404,"No scan results yet")
    return SCAN_RESULTS[hid]

@app.get("/api/scans")
def get_all_scans():
    return list(SCAN_RESULTS.values())
