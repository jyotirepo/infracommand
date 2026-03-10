import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const API = window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api";
const api = axios.create({ baseURL: API });

const T = {
  bg:"#f1f5f9", card:"#ffffff", sidebar:"#0f1f2e", sideAct:"rgba(0,180,216,.15)",
  border:"#e2e8f0", blue:"#0369a1", cyan:"#0891b2", green:"#059669",
  amber:"#d97706", red:"#dc2626", purple:"#7c3aed",
  text:"#0f172a", sub:"#475569", muted:"#94a3b8", tblHead:"#f8fafc",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.text};font-family:'IBM Plex Sans',sans-serif;font-size:13px}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
.mono{font-family:'IBM Plex Mono',monospace}
.card{background:${T.card};border:1px solid ${T.border};border-radius:10px}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)}
.btn{padding:6px 14px;border-radius:7px;border:none;cursor:pointer;font-family:'IBM Plex Sans',sans-serif;
     font-size:12px;font-weight:600;transition:all .15s;display:inline-flex;align-items:center;gap:5px}
.btn:hover{filter:brightness(.93)}
.btn-primary{background:${T.blue};color:#fff}
.btn-danger{background:${T.red};color:#fff}
.btn-ghost{background:#f1f5f9;color:${T.sub};border:1px solid ${T.border}}
.btn-scan{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff}
.btn-port{background:linear-gradient(135deg,#0e7490,#0369a1);color:#fff}
.btn-refresh{background:#f0fdf4;color:${T.green};border:1px solid #bbf7d0}
.btn-sm{padding:4px 10px;font-size:11px}
.badge{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.2px;display:inline-flex;align-items:center;gap:4px}
.b-ok{background:#dcfce7;color:#166534}.b-warn{background:#fef3c7;color:#92400e}
.b-crit{background:#fee2e2;color:#991b1b}.b-info{background:#dbeafe;color:#1e40af}
.b-sim{background:#ede9fe;color:#5b21b6}.b-stop{background:#f1f5f9;color:#64748b}
.b-kvm{background:#d1fae5;color:#065f46}.b-hv{background:#dbeafe;color:#1e40af}
input,select,textarea{background:#f8fafc;border:1.5px solid ${T.border};color:${T.text};
  padding:7px 11px;border-radius:7px;font-family:'IBM Plex Sans',sans-serif;font-size:13px;width:100%;transition:border-color .2s}
input:focus,select:focus,textarea:focus{outline:none;border-color:${T.cyan};background:#fff}
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;
  justify-content:center;z-index:999;backdrop-filter:blur(3px)}
.modal{background:#fff;border-radius:14px;padding:26px;width:500px;max-height:92vh;overflow-y:auto;
  box-shadow:0 24px 64px rgba(0,0,0,.2)}
.tree-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;cursor:pointer;transition:background .12s}
.tree-row:hover{background:#f1f5f9}.tree-row.sel{background:#e0f2fe}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:9px 13px;background:${T.tblHead};color:${T.muted};font-weight:600;font-size:11px;
   letter-spacing:.4px;text-transform:uppercase;border-bottom:1.5px solid ${T.border}}
td{padding:9px 13px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:last-child td{border-bottom:none}tr:hover td{background:#fafbff}
.bar-bg{background:#e2e8f0;border-radius:6px;height:6px;min-width:70px}
.bar-fill{height:6px;border-radius:6px;transition:width .4s}
.tab-row{display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:9px;width:fit-content}
.tab{padding:6px 16px;border-radius:7px;border:none;background:transparent;cursor:pointer;
     font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:500;color:${T.sub};transition:all .15s}
.tab.active{background:#fff;color:${T.blue};font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.port-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;
           font-size:11px;font-family:'IBM Plex Mono',monospace;margin:2px}
.port-open{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
.port-risky{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.kpi{background:#f8fafc;border:1px solid ${T.border};border-radius:9px;padding:13px;text-align:center}
.kpi-val{font-size:22px;font-weight:700;line-height:1.1}
.kpi-lbl{font-size:10px;color:${T.muted};margin-top:3px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.section-hd{font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.spinner{width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:${T.blue};border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.scan-bar{height:3px;background:linear-gradient(90deg,${T.cyan},${T.blue});border-radius:2px;animation:scanprog 1.8s ease-in-out infinite}
@keyframes scanprog{0%{width:0}60%{width:75%}100%{width:100%}}
.alert-card{border-left:4px solid;padding:12px 18px;border-radius:0 8px 8px 0}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;
             padding:60px 20px;color:${T.muted};gap:10px;text-align:center}
`;

// ── Reusable ──────────────────────────────────────────────────────────────────
const Bar = ({val,max=100}) => {
  const p=Math.min(100,(val||0)/max*100);
  return <div className="bar-bg"><div className="bar-fill" style={{width:`${p}%`,background:p>85?T.red:p>65?T.amber:T.green}}/></div>;
};
const KPI = ({label,value,color,sub}) => (
  <div className="kpi">
    <div className="kpi-val" style={{color:color||T.blue}}>{value}</div>
    <div className="kpi-lbl">{label}</div>
    {sub&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div>}
  </div>
);
const SrcBadge = ({src}) => src==="live"?<span className="badge b-ok">● LIVE</span>
  :src==="stopped"?<span className="badge b-stop">◼ STOPPED</span>
  :src==="error"?<span className="badge b-crit">✕ ERROR</span>
  :<span className="badge b-sim">◌ CACHED</span>;
const SevBadge = ({sev}) => {
  const m={CRITICAL:"b-crit",HIGH:"b-warn",MEDIUM:"b-info",LOW:"b-stop"};
  return <span className={`badge ${m[sev]||"b-stop"}`}>{sev}</span>;
};
const StatusDot = ({s}) => {
  const col=s==="running"?T.green:s==="stopped"?"#94a3b8":T.amber;
  return <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block",marginRight:5}}/>;
};
const fmtRAM = mb => mb>=1024?`${(mb/1024).toFixed(1)} GB`:`${mb} MB`;

// ── Add Host Modal ─────────────────────────────────────────────────────────────
function AddHostModal({onClose,onAdded}) {
  const [form,setForm]=useState({name:"",ip:"",os_type:"linux",auth_type:"password",
    username:"root",password:"",ssh_key:"",ssh_port:22,winrm_port:5985});
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.ip) return setMsg({t:"e",text:"Name and IP required"});
    setBusy(true);setMsg(null);
    try {
      const r=await api.post("/hosts",{...form,ssh_port:Number(form.ssh_port)});
      setMsg({t:"ok",text:r.data.message});
      setTimeout(()=>{onAdded();onClose();},1600);
    } catch(e){setMsg({t:"e",text:e.response?.data?.detail||"Failed"});}
    setBusy(false);
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div><div style={{fontWeight:700,fontSize:16}}>Add Host</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>Connect via SSH (Linux) or WinRM (Windows)</div></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Host Name *","name","text","prod-server-01"],["IP Address *","ip","text","192.168.1.100"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>OS / Hypervisor</label>
            <select value={form.os_type} onChange={e=>{set("os_type",e.target.value);set("username",e.target.value==="windows"?"Administrator":"root");}}>
              <option value="linux">🐧 Linux — KVM</option>
              <option value="windows">🪟 Windows — Hyper-V</option>
            </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Auth Type</label>
            <select value={form.auth_type} onChange={e=>set("auth_type",e.target.value)}>
              <option value="password">Password</option><option value="key">SSH Key (PEM)</option>
            </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Username</label>
            <input value={form.username} onChange={e=>set("username",e.target.value)}/></div>
          {form.os_type==="linux"
            ?<div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Port</label>
               <input type="number" value={form.ssh_port} onChange={e=>set("ssh_port",e.target.value)}/></div>
            :<div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>WinRM Port</label>
               <input type="number" value={form.winrm_port} onChange={e=>set("winrm_port",e.target.value)}/></div>}
          {form.auth_type==="password"
            ?<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Password</label>
               <input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
            :<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Private Key (PEM)</label>
               <textarea rows={5} value={form.ssh_key} onChange={e=>set("ssh_key",e.target.value)}
                 placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}/></div>}
        </div>
        {msg&&<div style={{marginTop:12,padding:"9px 13px",borderRadius:7,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy?<><span className="spinner"/>Connecting...</>:"Connect Host"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Port Scan Panel ───────────────────────────────────────────────────────────
function PortScanPanel({target,hostId,vmId,ip,onClose}) {
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const runScan=async()=>{
    setBusy(true);setResult(null);
    try {
      const url=vmId?`/hosts/${hostId}/vms/${vmId}/portscan`:`/hosts/${hostId}/portscan`;
      const r=await api.post(url);
      setResult(r.data);
    } catch(e){setResult({error:e.response?.data?.detail||"Scan failed"});}
    setBusy(false);
  };

  useEffect(()=>{runScan();},[]);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:600}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Port Scan — {target}</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>IP: {ip}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-port btn-sm" onClick={runScan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"↻ Re-scan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        {busy&&<div className="scan-bar" style={{marginBottom:14}}/>}
        {result?.error&&<div style={{color:T.red,padding:12,background:"#fee2e2",borderRadius:7}}>{result.error}</div>}
        {result&&!result.error&&(
          <>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              <div className="kpi"><div className="kpi-val" style={{color:T.blue}}>{result.ports?.length||0}</div><div className="kpi-lbl">Open Ports</div></div>
              <div className="kpi"><div className="kpi-val" style={{color:T.red}}>{result.ports?.filter(p=>p.risky).length||0}</div><div className="kpi-lbl">Risky</div></div>
            </div>
            <div className="section-hd">Open Ports</div>
            <div style={{marginBottom:8}}>
              {result.ports?.length>0
                ?result.ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}{p.risky?" ⚠":""}</span>)
                :<div style={{color:T.muted,fontSize:12,padding:"8px 0"}}>No open ports found in scanned range</div>}
            </div>
            {result.ports?.filter(p=>p.risky).length>0&&(
              <div style={{marginTop:10,padding:"10px 14px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,fontSize:12,color:"#9a3412"}}>
                ⚠ Risky ports detected (FTP/Telnet/RDP/VNC/SMB). Review firewall rules.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Vuln Scan Panel ───────────────────────────────────────────────────────────
function VulnScanPanel({target,hostId,vmId,ip,onClose}) {
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const runScan=async()=>{
    setBusy(true);setResult(null);
    try {
      const url=vmId?`/hosts/${hostId}/vms/${vmId}/scan`:`/hosts/${hostId}/scan`;
      const r=await api.post(url);
      setResult(r.data);
    } catch(e){setResult({error:e.response?.data?.detail||"Scan failed"});}
    setBusy(false);
  };

  useEffect(()=>{runScan();},[]);

  const download=()=>{
    if(!result||result.error) return;
    const txt=`InfraCommand Vulnerability Report\nTarget: ${result.target} (${result.ip})\nDate: ${result.scanned_at}\n\nSUMMARY\nCritical:${result.summary?.critical} High:${result.summary?.high} Medium:${result.summary?.medium} Low:${result.summary?.low}\n\nVULNERABILITIES\n${result.vulns?.map(v=>`${v.id} [${v.severity}] CVSS:${v.cvss} | ${v.pkg}: ${v.desc}`).join("\n")}`;
    const a=document.createElement("a");a.href="data:text/plain,"+encodeURIComponent(txt);
    a.download=`vuln-${result.target}-${Date.now()}.txt`;a.click();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:680,maxWidth:"96vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Vulnerability Scan — {target}</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>IP: {ip}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {result&&!result.error&&<button className="btn btn-ghost btn-sm" onClick={download}>↓ Export</button>}
            <button className="btn btn-scan btn-sm" onClick={runScan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"↻ Re-scan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        {busy&&<div className="scan-bar" style={{marginBottom:14}}/>}
        {result?.error&&<div style={{color:T.red,padding:12,background:"#fee2e2",borderRadius:7}}>{result.error}</div>}
        {result&&!result.error&&(
          <>
            <div className="kpi-grid" style={{marginBottom:18}}>
              {[["Total",result.summary?.total,T.blue],["Critical",result.summary?.critical,T.red],
                ["High",result.summary?.high,T.amber],["Medium",result.summary?.medium,T.purple],["Low",result.summary?.low,T.muted]].map(([l,v,c])=>(
                <KPI key={l} label={l} value={v} color={c}/>
              ))}
            </div>
            <table>
              <thead><tr><th>CVE ID</th><th>Severity</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
              <tbody>{result.vulns?.map(v=>(
                <tr key={v.id}>
                  <td><a href={v.url} target="_blank" rel="noreferrer" style={{color:T.blue,fontFamily:"IBM Plex Mono",fontSize:11}}>{v.id}</a></td>
                  <td><SevBadge sev={v.severity}/></td>
                  <td><span style={{fontFamily:"IBM Plex Mono",fontWeight:700,color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</span></td>
                  <td><code style={{background:"#f1f5f9",padding:"2px 6px",borderRadius:4,fontSize:11}}>{v.pkg}</code></td>
                  <td style={{color:T.sub}}>{v.desc}</td>
                </tr>
              ))}</tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ── Detail Panel (Host or VM) ─────────────────────────────────────────────────
function DetailPanel({sel,hostData,db}) {
  const [tab,setTab]=useState("metrics");
  const [portScan,setPortScan]=useState(null);
  const [vulnScan,setVulnScan]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const [msg,setMsg]=useState(null);

  const isVM   = sel?.type==="vm";
  const target = isVM ? sel.vm : hostData;
  const m      = target?.metrics || {};
  const patch  = isVM ? (sel.vm?.patch||{}) : (hostData?.patch||{});
  const ip     = target?.ip || "N/A";

  const doRefresh=async()=>{
    if(!sel) return;
    setRefreshing(true);setMsg(null);
    try {
      const r=await api.post(`/hosts/${sel.hostId}/refresh`);
      setMsg({t:"ok",text:r.data.message});
      db.reload();
    } catch(e){setMsg({t:"e",text:"Refresh failed"});}
    setRefreshing(false);
  };

  if(!sel||!target) return (
    <div className="card shadow" style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="empty-state">
        <div style={{fontSize:48}}>🖧</div>
        <div style={{fontWeight:600,fontSize:15,color:T.sub}}>Select a host or VM from the tree</div>
        <div style={{fontSize:12}}>Click any item to view metrics, patch status, and run security scans</div>
      </div>
    </div>
  );

  const osInfo = m.os_info || {};
  const patchColor=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12,height:"100%",overflowY:"auto"}}>
      {/* Header */}
      <div className="card shadow" style={{padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
              background:target.hypervisor==="Hyper-V"?"#dbeafe":target.os_type==="windows"?"#dbeafe":"#d1fae5"}}>
              {isVM?(target.hypervisor==="Hyper-V"?"🪟":"🖥"):(target.os_type==="windows"?"🪟":"🐧")}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{target.name}</div>
              <div style={{color:T.muted,fontSize:11,marginTop:2}}>
                {ip} · {isVM?`${target.hypervisor} VM · ${fmtRAM(target.ram_mb)} · ${target.vcpu} vCPU`
                           :`${target.os_type==="linux"?"Linux/KVM":"Windows/Hyper-V"} · ${target.username||""}`}
                {osInfo.os_pretty&&<span style={{color:T.blue}}> · {osInfo.os_pretty}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {isVM&&<span className={`badge ${target.hypervisor==="KVM"?"b-kvm":"b-hv"}`}>{target.hypervisor}</span>}
            <SrcBadge src={m.source}/>
            <button className="btn btn-refresh btn-sm" onClick={doRefresh} disabled={refreshing}>
              {refreshing?<><span className="spinner"/>...</>:"↻ Refresh"}
            </button>
            <button className="btn btn-port btn-sm" onClick={()=>setPortScan(true)}>🔌 Port Scan</button>
            <button className="btn btn-scan btn-sm" onClick={()=>setVulnScan(true)}>🔍 Vuln Scan</button>
          </div>
        </div>
        {msg&&<div style={{marginTop:10,padding:"7px 12px",borderRadius:6,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {["metrics","patch","os"].map(t=>(
          <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t==="metrics"?"📊 Metrics":t==="patch"?"🔧 Patch Status":"💻 OS Info"}
          </button>
        ))}
      </div>

      {/* Metrics Tab */}
      {tab==="metrics"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["CPU",m.cpu,"%",T.blue],["RAM",m.ram,"%",T.amber],["Disk",m.disk,"%",T.red],
              [isVM?"vCPUs":"Load",isVM?target.vcpu:m.load,"",T.green]].map(([l,v,u,c])=>(
              <div key={l} className="card" style={{padding:14}}>
                <div style={{color:T.muted,fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>{l}</div>
                <div style={{fontSize:24,fontWeight:700,color:v>85?T.red:v>65?T.amber:c}}>{v}{u}</div>
                {u==="%"&&<div style={{marginTop:8}}><Bar val={v}/></div>}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div className="card" style={{padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:10}}>Network I/O</div>
              <div style={{display:"flex",gap:24}}>
                <div><div style={{fontSize:10,color:T.muted}}>INBOUND</div><div style={{fontSize:20,fontWeight:700,color:T.green}}>{m.net_in} MB</div></div>
                <div><div style={{fontSize:10,color:T.muted}}>OUTBOUND</div><div style={{fontSize:20,fontWeight:700,color:T.amber}}>{m.net_out} MB</div></div>
              </div>
            </div>
            <div className="card" style={{padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:10}}>System</div>
              {[["Uptime",m.uptime||"N/A"],isVM?["Disk",""+target.disk_gb+" GB"]:["Arch",osInfo.arch||"N/A"]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:T.muted,fontSize:12}}>{l}</span>
                  <span style={{fontSize:12,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patch Tab */}
      {tab==="patch"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase"}}>Patch Status</div>
            <button className="btn btn-refresh btn-sm" onClick={async()=>{
              try{const r=await api.post(`/hosts/${sel.hostId}/patch/refresh`);db.reload();}catch(e){}
            }}>↻ Check Now</button>
          </div>
          {patch.status?(
            <>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16,padding:"8px 14px",
                borderRadius:8,background:patchColor(patch.status)+"18",border:`1px solid ${patchColor(patch.status)}44`}}>
                <span style={{fontSize:16}}>{patch.status==="UP TO DATE"?"✅":patch.status==="CRITICAL UPDATE"?"🚨":"⚠️"}</span>
                <span style={{fontWeight:700,color:patchColor(patch.status)}}>{patch.status}</span>
              </div>
              <table>
                <tbody>
                  {[
                    ["Operating System", patch.os||patch.os_name||"N/A"],
                    ["OS Version",       patch.os_version||"N/A"],
                    ["Current Kernel",   patch.kernel||"N/A"],
                    ["Latest Kernel",    patch.latest_kernel||"N/A"],
                    ["Package Manager",  patch.pkg_manager||"N/A"],
                    ["Pending Updates",  patch.updates_available!=null?`${patch.updates_available} packages`:"N/A"],
                    ["Security Updates", patch.security_updates!=null?`${patch.security_updates} critical`:"N/A"],
                    ["Last Patched",     patch.last_patch||"N/A"],
                    ["Source",           patch.source||"N/A"],
                  ].map(([l,v])=>(
                    <tr key={l}>
                      <td style={{color:T.muted,width:160,fontWeight:500}}>{l}</td>
                      <td style={{fontWeight:600,fontFamily:["Current Kernel","Latest Kernel"].includes(l)?"IBM Plex Mono":"inherit",
                        fontSize:["Current Kernel","Latest Kernel"].includes(l)?11:12,
                        color:l==="Pending Updates"&&patch.updates_available>0?T.red
                             :l==="Security Updates"&&patch.security_updates>0?T.red
                             :l==="Latest Kernel"&&patch.latest_kernel!==patch.kernel?T.amber:T.text}}>
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ):<div style={{color:T.muted,padding:"20px 0",textAlign:"center"}}>
              No patch data — click "Check Now" to fetch
            </div>}
        </div>
      )}

      {/* OS Info Tab */}
      {tab==="os"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>OS & System Information</div>
          {osInfo.os_pretty?(
            <table><tbody>
              {[["OS","os_pretty"],["OS Name","os_name"],["Version","os_version"],
                ["Kernel","kernel"],["Architecture","arch"]].map(([l,k])=>(
                osInfo[k]?<tr key={k}>
                  <td style={{color:T.muted,width:160,fontWeight:500}}>{l}</td>
                  <td style={{fontWeight:600,fontFamily:k==="kernel"?"IBM Plex Mono":"inherit",fontSize:k==="kernel"?11:12}}>{osInfo[k]}</td>
                </tr>:null
              ))}
            </tbody></table>
          ):<div style={{color:T.muted,padding:"20px 0",textAlign:"center"}}>Click ↻ Refresh to fetch OS info</div>}
        </div>
      )}

      {portScan&&<PortScanPanel target={target.name} hostId={sel.hostId} vmId={isVM?sel.vmId:null} ip={ip} onClose={()=>setPortScan(null)}/>}
      {vulnScan&&<VulnScanPanel target={target.name} hostId={sel.hostId} vmId={isVM?sel.vmId:null} ip={ip} onClose={()=>setVulnScan(null)}/>}
    </div>
  );
}

// ── Infrastructure View ───────────────────────────────────────────────────────
function InfraView({rawHosts,dbReload}) {
  const [hosts,setHosts]=useState(rawHosts);
  const [expanded,setExpanded]=useState({});
  const [sel,setSel]=useState(null);
  const [hostCache,setHostCache]=useState({});
  const [loading,setLoading]=useState(null);
  const [showAdd,setShowAdd]=useState(false);

  useEffect(()=>setHosts(rawHosts),[rawHosts]);

  const loadHost=async(hid)=>{
    if(hostCache[hid]) return hostCache[hid];
    setLoading(hid);
    try {
      const r=await api.get(`/hosts/${hid}`);
      setHostCache(c=>({...c,[hid]:r.data}));
      setLoading(null);
      return r.data;
    } catch(e){setLoading(null);return null;}
  };

  const clickHost=async(hid)=>{
    setSel({type:"host",hostId:hid});
    const h=await loadHost(hid);
    setExpanded(e=>({...e,[hid]:true}));
  };

  const clickVM=(hid,vm)=>{
    setSel({type:"vm",hostId:hid,vmId:vm.id,vm});
  };

  const refreshVMs=async(hid,e)=>{
    e.stopPropagation();
    setLoading(hid);
    try {
      const r=await api.post(`/hosts/${hid}/vms/refresh`);
      setHostCache(c=>({...c,[hid]:{...c[hid],vms:r.data.vms}}));
    } catch(e){}
    setLoading(null);
  };

  const deleteHost=async(hid,e)=>{
    e.stopPropagation();
    await api.delete(`/hosts/${hid}`).catch(()=>{});
    dbReload();
    if(sel?.hostId===hid) setSel(null);
  };

  const dbObj={reload:async()=>{
    dbReload();
    if(sel?.hostId){
      const r=await api.get(`/hosts/${sel.hostId}`).catch(()=>null);
      if(r) setHostCache(c=>({...c,[sel.hostId]:r.data}));
    }
  }};

  const currentHostData=sel?hostCache[sel.hostId]:null;

  return (
    <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:12,height:"calc(100vh - 100px)"}}>
      {/* Tree */}
      <div className="card shadow" style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:700,fontSize:13}}>Infrastructure</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"6px"}}>
          {hosts.map(h=>{
            const det=hostCache[h.id];
            const vms=det?.vms||[];
            const isExp=expanded[h.id];
            const isSel=sel?.type==="host"&&sel.hostId===h.id;
            return (
              <div key={h.id}>
                <div className={`tree-row ${isSel?"sel":""}`} onClick={()=>clickHost(h.id)}>
                  <span style={{fontSize:15}}>{h.os_type==="linux"?"🐧":"🪟"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                    <div style={{fontSize:10,color:T.muted}}>{h.ip}</div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                    {loading===h.id&&<span className="spinner"/>}
                    {isExp&&<button className="btn btn-ghost btn-sm" style={{padding:"2px 6px",fontSize:9}}
                      title="Refresh VMs" onClick={(e)=>refreshVMs(h.id,e)}>⟳</button>}
                    <span style={{fontSize:10,color:T.muted}}>{isExp?"▾":"▸"}</span>
                    <button className="btn btn-ghost btn-sm" style={{padding:"2px 6px",fontSize:9,color:T.red}}
                      onClick={(e)=>deleteHost(h.id,e)}>✕</button>
                  </div>
                </div>
                {isExp&&(
                  <div style={{marginLeft:12,borderLeft:`2px solid ${T.border}`,paddingLeft:8,marginBottom:4}}>
                    {vms.length===0&&<div style={{padding:"5px 8px",color:T.muted,fontSize:11}}>
                      {loading===h.id?"Discovering VMs...":"No VMs found — click ⟳ to discover"}
                    </div>}
                    {vms.map(vm=>{
                      const isSelVM=sel?.type==="vm"&&sel.vmId===vm.id;
                      return (
                        <div key={vm.id} className={`tree-row ${isSelVM?"sel":""}`}
                          onClick={()=>clickVM(h.id,vm)} style={{padding:"5px 8px"}}>
                          <span style={{fontSize:13}}>🖥</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:500,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{vm.name}</div>
                            <div style={{fontSize:10,color:T.muted,display:"flex",alignItems:"center"}}>
                              <StatusDot s={vm.status}/>{vm.status}
                            </div>
                          </div>
                          <span className={`badge ${vm.hypervisor==="KVM"?"b-kvm":"b-hv"}`} style={{fontSize:9,padding:"1px 6px"}}>{vm.hypervisor}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {hosts.length===0&&<div className="empty-state" style={{padding:"30px 10px"}}>
            <div style={{fontSize:30}}>🖧</div>
            <div style={{fontSize:12}}>No hosts yet.<br/>Click + Add to connect.</div>
          </div>}
        </div>
      </div>

      {/* Detail */}
      <div style={{overflowY:"auto"}}>
        <DetailPanel sel={sel} hostData={currentHostData} db={dbObj}/>
      </div>

      {showAdd&&<AddHostModal onClose={()=>setShowAdd(false)} onAdded={()=>{dbReload();setShowAdd(false);}}/>}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({hosts,summary,history}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[["Hosts",summary.hosts,T.blue],["VMs",summary.total_vms,T.cyan],
          ["Avg CPU",`${summary.avg_cpu}%`,summary.avg_cpu>80?T.red:T.green],
          ["Warnings",summary.warnings,summary.warnings>0?T.amber:T.green],
          ["Live",hosts.filter(h=>h.metrics?.source==="live").length,T.green]].map(([l,v,c])=>(
          <div key={l} className="card shadow"><KPI label={l} value={v} color={c}/></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[["CPU Usage 24h","cpu",T.blue],["RAM Usage 24h","ram",T.amber]].map(([title,key,col])=>(
          <div key={key} className="card shadow" style={{padding:16}}>
            <div className="section-hd">{title}</div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={history}>
                <defs><linearGradient id={`g${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={col} stopOpacity={0.12}/>
                  <stop offset="95%" stopColor={col} stopOpacity={0}/>
                </linearGradient></defs>
                <XAxis dataKey="hour" tick={{fontSize:9,fill:T.muted}}/>
                <YAxis tick={{fontSize:9,fill:T.muted}}/>
                <Tooltip contentStyle={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:7,fontSize:11}}/>
                <Area type="monotone" dataKey={key} stroke={col} fill={`url(#g${key})`} strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      <div className="card shadow" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}><div className="section-hd" style={{margin:0}}>All Hosts</div></div>
        <table>
          <thead><tr><th>Host</th><th>IP</th><th>Hypervisor</th><th>OS</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Source</th></tr></thead>
          <tbody>{hosts.map(h=>{
            const o=h.metrics?.os_info||{};
            return (
              <tr key={h.id}>
                <td style={{fontWeight:600}}>{h.os_type==="linux"?"🐧":"🪟"} {h.name}</td>
                <td><code style={{fontSize:11}}>{h.ip}</code></td>
                <td><span className={`badge ${h.os_type==="linux"?"b-kvm":"b-hv"}`}>{h.os_type==="linux"?"KVM":"Hyper-V"}</span></td>
                <td style={{fontSize:11,color:T.sub}}>{o.os_pretty||"—"}</td>
                <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:3}}>{h.metrics?.cpu}%</div><Bar val={h.metrics?.cpu}/></div></td>
                <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:3}}>{h.metrics?.ram}%</div><Bar val={h.metrics?.ram}/></div></td>
                <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:3}}>{h.metrics?.disk}%</div><Bar val={h.metrics?.disk}/></div></td>
                <td><SrcBadge src={h.metrics?.source}/></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── Patches ───────────────────────────────────────────────────────────────────
function Patches() {
  const [patches,setPatches]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{api.get("/patches").then(r=>{setPatches(r.data);setLoading(false);}).catch(()=>setLoading(false));},[]);
  const pc=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontWeight:700,fontSize:15}}>Patch Status</div>
      {loading?<div style={{color:T.muted}}>Loading...</div>:(
        <div className="card shadow" style={{padding:0,overflow:"hidden"}}>
          <table>
            <thead><tr><th>Host</th><th>OS</th><th>Current Kernel</th><th>Latest Kernel</th><th>Pkg Mgr</th><th>Pending</th><th>Security</th><th>Last Patch</th><th>Status</th></tr></thead>
            <tbody>{patches.map((p,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600}}>{p.host||p.host_id}</td>
                <td style={{fontSize:11}}>{p.os||"—"}</td>
                <td><code style={{fontSize:10}}>{p.kernel||"—"}</code></td>
                <td><code style={{fontSize:10,color:p.latest_kernel&&p.latest_kernel!==p.kernel?T.amber:T.green}}>{p.latest_kernel||"N/A"}</code></td>
                <td><code style={{fontSize:11}}>{p.pkg_manager||"—"}</code></td>
                <td><span style={{fontWeight:700,color:p.updates_available>0?T.red:T.green}}>{p.updates_available??0}</span></td>
                <td><span style={{fontWeight:700,color:p.security_updates>0?T.red:T.green}}>{p.security_updates??0}</span></td>
                <td style={{fontSize:11,color:T.muted}}>{p.last_patch||"—"}</td>
                <td><span className="badge" style={{background:pc(p.status)+"22",color:pc(p.status)}}>{p.status||"—"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function Alerts() {
  const [alerts,setAlerts]=useState([]);
  const load=()=>api.get("/alerts").then(r=>setAlerts(r.data)).catch(()=>{});
  useEffect(()=>{load();},[]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:15}}>Alerts <span style={{color:T.muted,fontWeight:400,fontSize:13}}>({alerts.length})</span></div>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>
      {alerts.length===0&&<div className="card shadow"><div style={{color:T.green,textAlign:"center",padding:40,fontSize:14}}>✅ No active alerts — all systems nominal</div></div>}
      {alerts.map(a=>(
        <div key={a.id} className="card shadow alert-card" style={{borderColor:a.severity==="critical"?T.red:T.amber}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>{a.severity==="critical"?"🚨":"⚠️"}</span>
              <div>
                <span className={`badge ${a.severity==="critical"?"b-crit":"b-warn"}`}>{a.type}</span>
                <span style={{marginLeft:10,fontWeight:500}}>{a.msg}</span>
              </div>
            </div>
            <span style={{color:T.muted,fontSize:11}}>{a.host}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────
function Logs({hosts}) {
  const [logs,setLogs]=useState([]);
  const [hf,setHf]=useState("all");
  const [lf,setLf]=useState("all");
  const [loading,setLoading]=useState(false);
  const fetch=useCallback(async()=>{
    setLoading(true);
    try {
      const r=hf!=="all"
        ?await api.get(`/hosts/${hf}/logs`)
        :await api.get("/logs",{params:{limit:300,...(lf!=="all"?{level:lf}:{})}});
      setLogs(r.data);
    } catch(e){}
    setLoading(false);
  },[hf,lf]);
  useEffect(()=>{fetch();},[fetch]);
  const lc=l=>l==="ERROR"?T.red:l==="WARN"?T.amber:T.muted;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <select value={hf} onChange={e=>setHf(e.target.value)} style={{width:170}}>
          <option value="all">All Hosts</option>
          {hosts.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={lf} onChange={e=>setLf(e.target.value)} style={{width:120}}>
          <option value="all">All Levels</option>
          <option value="ERROR">ERROR</option><option value="WARN">WARN</option><option value="INFO">INFO</option>
        </select>
        <button className="btn btn-ghost" onClick={fetch}>{loading?<span className="spinner"/>:"↻"} Refresh</button>
        <span style={{color:T.muted,fontSize:11}}>{logs.length} entries</span>
      </div>
      <div className="card shadow" style={{padding:0,maxHeight:"68vh",overflowY:"auto"}}>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"7px 14px",borderBottom:`1px solid #f1f5f9`,fontSize:11,background:i%2===0?"#fff":"#fafbfc"}}>
            <span style={{color:T.muted,minWidth:70,fontFamily:"IBM Plex Mono"}}>{l.ts?.slice(11,19)}</span>
            <span style={{minWidth:44,fontWeight:700,color:lc(l.level)}}>{l.level}</span>
            <span style={{minWidth:110,color:T.blue,fontWeight:500}}>{l.host}</span>
            <span style={{flex:1,color:T.sub}}>{l.msg}</span>
            <SrcBadge src={l.source}/>
          </div>
        ))}
        {logs.length===0&&<div className="empty-state"><div>No logs</div></div>}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const VIEWS=[{id:"overview",icon:"📊",label:"Overview"},{id:"infra",icon:"🖧",label:"Infrastructure"},
             {id:"logs",icon:"📋",label:"Logs"},{id:"alerts",icon:"🔔",label:"Alerts"},
             {id:"patches",icon:"🔧",label:"Patches"}];

export default function App() {
  const [view,setView]=useState("overview");
  const [hosts,setHosts]=useState([]);
  const [summary,setSummary]=useState({});
  const [history,setHistory]=useState([]);
  const [lastUpd,setLastUpd]=useState(null);

  // Load from DB — never auto-poll, only on explicit user action
  const loadData=useCallback(async()=>{
    try {
      const [h,s,hist]=await Promise.all([api.get("/hosts"),api.get("/summary"),api.get("/metrics/history")]);
      setHosts(h.data);setSummary(s.data);setHistory(hist.data);
      setLastUpd(new Date().toLocaleTimeString());
    } catch(e){}
  },[]);

  // Load once on mount — never auto-refresh
  useEffect(()=>{loadData();},[loadData]);

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:210,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"20px 18px 16px"}}>
            <div style={{color:"#f0f9ff",fontWeight:800,fontSize:15,letterSpacing:.3}}>InfraCommand</div>
            <div style={{color:"#5b8fad",fontSize:11,marginTop:2}}>Infrastructure Monitor</div>
          </div>
          <div style={{padding:"0 8px",flex:1}}>
            {VIEWS.map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:9,
                padding:"9px 12px",borderRadius:7,border:"none",cursor:"pointer",
                fontFamily:"IBM Plex Sans",fontSize:12,fontWeight:view===v.id?700:400,
                background:view===v.id?"rgba(14,165,233,.18)":"transparent",
                color:view===v.id?"#7dd3fc":"#7a9db5",marginBottom:2,
                borderLeft:view===v.id?"3px solid #0ea5e9":"3px solid transparent",
                transition:"all .15s",
              }}><span>{v.icon}</span>{v.label}</button>
            ))}
          </div>
          <div style={{padding:"12px 18px",borderTop:"1px solid #1e3347",fontSize:10,color:"#3d6177"}}>
            <div>{hosts.length} hosts · {summary.total_vms||0} VMs</div>
            <div style={{marginTop:3,color:"#2d7a4f"}}>{hosts.filter(h=>h.metrics?.source==="live").length} live connections</div>
            {lastUpd&&<div style={{marginTop:3,color:"#2c5f7a"}}>DB loaded: {lastUpd}</div>}
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"11px 22px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{VIEWS.find(v=>v.id===view)?.label}</div>
              <div style={{color:T.muted,fontSize:11}}>Data from local DB · refresh per host using ↻ button</div>
            </div>
            <button className="btn btn-refresh" onClick={loadData}>↻ Reload from DB</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:view==="infra"?"14px":"22px"}}>
            {view==="overview"  && <Overview hosts={hosts} summary={summary} history={history}/>}
            {view==="infra"     && <InfraView rawHosts={hosts} dbReload={loadData}/>}
            {view==="logs"      && <Logs hosts={hosts}/>}
            {view==="alerts"    && <Alerts/>}
            {view==="patches"   && <Patches/>}
          </div>
        </div>
      </div>
    </>
  );
}
