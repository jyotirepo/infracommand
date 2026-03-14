import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import axios from "axios";

const API = window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api";
const api = axios.create({ baseURL: API });

const T = {
  bg:"#f1f5f9",card:"#ffffff",sidebar:"#0f1f2e",border:"#e2e8f0",
  blue:"#0369a1",cyan:"#0891b2",green:"#059669",amber:"#d97706",
  red:"#dc2626",purple:"#7c3aed",text:"#0f172a",sub:"#475569",muted:"#94a3b8",tblHead:"#f8fafc",
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
.btn:hover{filter:brightness(.93)}.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:${T.blue};color:#fff}.btn-danger{background:${T.red};color:#fff}
.btn-ghost{background:#f1f5f9;color:${T.sub};border:1px solid ${T.border}}
.btn-scan{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff}
.btn-port{background:linear-gradient(135deg,#0e7490,#0369a1);color:#fff}
.btn-refresh{background:#f0fdf4;color:${T.green};border:1px solid #bbf7d0}
.btn-sm{padding:4px 10px;font-size:11px}
.badge{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
.b-ok{background:#dcfce7;color:#166534}.b-warn{background:#fef3c7;color:#92400e}
.b-crit{background:#fee2e2;color:#991b1b}.b-info{background:#dbeafe;color:#1e40af}
.b-sim{background:#ede9fe;color:#5b21b6}.b-stop{background:#f1f5f9;color:#64748b}
.b-kvm{background:#d1fae5;color:#065f46}.b-hv{background:#dbeafe;color:#1e40af}
.b-error{background:#fee2e2;color:#991b1b}
input,select,textarea{background:#f8fafc;border:1.5px solid ${T.border};color:${T.text};
  padding:7px 11px;border-radius:7px;font-family:'IBM Plex Sans',sans-serif;font-size:13px;width:100%;transition:border-color .2s}
input:focus,select:focus,textarea:focus{outline:none;border-color:${T.cyan};background:#fff}
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;
  justify-content:center;z-index:999;backdrop-filter:blur(3px)}
.modal{background:#fff;border-radius:14px;padding:26px;max-height:92vh;overflow-y:auto;
  box-shadow:0 24px 64px rgba(0,0,0,.2)}
.tree-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;cursor:pointer;transition:background .12s}
.tree-row:hover{background:#f1f5f9}.tree-row.sel{background:#e0f2fe;border-left:3px solid ${T.cyan}}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:9px 13px;background:${T.tblHead};color:${T.muted};font-weight:600;font-size:11px;
   letter-spacing:.4px;text-transform:uppercase;border-bottom:1.5px solid ${T.border}}
td{padding:9px 13px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:last-child td{border-bottom:none}tr:hover td{background:#fafbff}
.bar-bg{background:#e2e8f0;border-radius:6px;height:6px;min-width:60px}
.bar-fill{height:6px;border-radius:6px;transition:width .4s}
.tab-row{display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:9px;flex-wrap:wrap}
.tab{padding:6px 14px;border-radius:7px;border:none;background:transparent;cursor:pointer;
     font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:500;color:${T.sub};transition:all .15s}
.tab.active{background:#fff;color:${T.blue};font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.port-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;
           font-size:11px;font-family:'IBM Plex Mono',monospace;margin:2px}
.port-open{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
.port-risky{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
.port-active{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af}
.kpi{background:#f8fafc;border:1px solid ${T.border};border-radius:9px;padding:13px;text-align:center}
.kpi-val{font-size:22px;font-weight:700;line-height:1.1}
.kpi-lbl{font-size:10px;color:${T.muted};margin-top:3px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.section-hd{font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.spinner{width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:${T.blue};border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.scan-bar{height:3px;background:linear-gradient(90deg,${T.cyan},${T.blue});border-radius:2px;animation:sp 1.8s ease-in-out infinite}
@keyframes sp{0%{width:0}60%{width:75%}100%{width:100%}}
.stor-bar{height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;margin-top:4px}
.stor-fill{height:10px;border-radius:5px;transition:width .4s}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const Bar = ({val,max=100}) => {
  const p=Math.min(100,(val||0)/max*100);
  return <div className="bar-bg"><div className="bar-fill" style={{width:`${p}%`,background:p>85?T.red:p>65?T.amber:T.green}}/></div>;
};
const StorBar = ({pct}) => {
  const col=pct>85?T.red:pct>65?T.amber:T.green;
  return <div className="stor-bar"><div className="stor-fill" style={{width:`${Math.min(100,pct||0)}%`,background:col}}/></div>;
};
const KPI = ({label,value,color,sub}) => (
  <div className="kpi">
    <div className="kpi-val" style={{color:color||T.blue}}>{value}</div>
    <div className="kpi-lbl">{label}</div>
    {sub&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div>}
  </div>
);
const SrcBadge = ({src}) =>
  src==="live"?<span className="badge b-ok">● LIVE</span>
  :src==="stopped"?<span className="badge b-stop">◼ STOPPED</span>
  :src==="error"?<span className="badge b-error">✕ ERROR</span>
  :<span className="badge b-sim">◌ CACHED</span>;
const SevBadge = ({sev}) => {
  const m={CRITICAL:"b-crit",HIGH:"b-warn",MEDIUM:"b-info",LOW:"b-stop"};
  return <span className={`badge ${m[sev]||"b-stop"}`}>{sev}</span>;
};
const StatusDot = ({s}) => (
  <span style={{width:7,height:7,borderRadius:"50%",display:"inline-block",marginRight:5,
    background:s==="running"?T.green:s==="stopped"?"#94a3b8":T.amber}}/>
);
const fmtRAM = mb => mb>=1024?`${(mb/1024).toFixed(1)} GB`:`${mb} MB`;

// ── Promote VM to Host Modal ──────────────────────────────────────────────────
function PromoteVMModal({vm, hostId, onClose, onAdded}) {
  const [form,setForm]=useState({
    username: "root", password: "", ssh_key: "", auth_type: "password",
    ssh_port: 22, os_type: vm?.hypervisor==="Hyper-V" ? "windows" : "linux"
  });
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const submit=async()=>{
    if(!form.username || (!form.password && !form.ssh_key))
      return setMsg({t:"e",text:"Username and password/key required"});
    setBusy(true); setMsg(null);
    try {
      const r=await api.post(`/hosts/${hostId}/vms/${vm.id}/promote`, {
        username: form.username, password: form.password,
        ssh_key: form.ssh_key, port: form.ssh_port,
      });
      setMsg({t:"ok", text:r.data.message});
      setTimeout(()=>{ onAdded(); onClose(); }, 1500);
    } catch(e) {
      setMsg({t:"e", text: e.response?.data?.detail||"Failed to add host"});
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:460}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Add VM as Standalone Host</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>
              {vm?.name} · {vm?.ip!=="N/A"?vm?.ip:"IP not detected"} · {vm?.os||"Linux"}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,
          padding:"10px 14px",marginBottom:14,fontSize:12,color:"#166534"}}>
          ℹ This will add <strong>{vm?.name}</strong> as an independently monitored host
          with its own metrics, logs, and patch data — separate from the parent hypervisor.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>
              IP Address (pre-filled from discovery)
            </label>
            <input value={vm?.ip||""} disabled style={{background:"#f8fafc",color:T.muted}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Auth Type</label>
            <select value={form.auth_type} onChange={e=>set("auth_type",e.target.value)}>
              <option value="password">Password</option>
              <option value="key">SSH Key (PEM)</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Username</label>
            <input value={form.username} onChange={e=>set("username",e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Port</label>
            <input type="number" value={form.ssh_port} onChange={e=>set("ssh_port",Number(e.target.value))}/>
          </div>
          {form.auth_type==="password"
            ?<div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Password</label>
               <input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
            :<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Private Key (PEM)</label>
               <textarea rows={4} value={form.ssh_key} onChange={e=>set("ssh_key",e.target.value)}
                 placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}/></div>}
        </div>
        {msg&&<div style={{marginTop:12,padding:"8px 12px",borderRadius:6,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-ok" onClick={submit} disabled={busy}>
            {busy?<><span className="spinner"/>Adding...</>:"➕ Add as Host"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Host Modal ─────────────────────────────────────────────────────────────
function AddHostModal({onClose,onAdded}) {
  const [form,setForm]=useState({name:"",ip:"",os_type:"linux",auth_type:"password",
    username:"root",password:"",ssh_key:"",ssh_port:22,winrm_port:5985});
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const [testResult,setTestResult]=useState(null);
  const [testing,setTesting]=useState(false);

  const testConn=async()=>{
    if(!form.ip) return setMsg({t:"e",text:"Enter IP address first"});
    setTesting(true);setTestResult(null);setMsg(null);
    try {
      const r=await api.post("/test-connection",{...form,ssh_port:Number(form.ssh_port),name:form.name||"test"});
      setTestResult(r.data);
    } catch(e){setTestResult({status:"fail",error:e.response?.data?.detail||"Request failed",steps:[]});}
    setTesting(false);
  };

  const submit=async()=>{
    if(!form.name||!form.ip) return setMsg({t:"e",text:"Name and IP required"});
    setBusy(true);setMsg(null);
    try {
      const r=await api.post("/hosts",{...form,ssh_port:Number(form.ssh_port),winrm_port:Number(form.winrm_port)});
      setMsg({t:"ok",text:r.data.message});
      setTimeout(()=>{onAdded();onClose();},2000);
    } catch(e){
      // Handle FastAPI 422 (validation), 500, and network errors
      const detail=e.response?.data?.detail;
      const errText=Array.isArray(detail)
        ? detail.map(d=>`${d.loc?.join(".")}: ${d.msg}`).join(", ")
        : (typeof detail==="string" ? detail : e.message || "Save failed — check browser console");
      setMsg({t:"e",text:errText});
    }
    setBusy(false);
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:500}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div><div style={{fontWeight:700,fontSize:16}}>Add Host</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>SSH (Linux/KVM) or WinRM (Windows/Hyper-V)</div></div>
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
            :<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Private Key</label>
               <textarea rows={5} value={form.ssh_key} onChange={e=>set("ssh_key",e.target.value)} placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}/></div>}
        </div>
        {testResult&&(
          <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:12,
            background:testResult.status==="ok"?"#f0fdf4":"#fff7ed",
            border:`1px solid ${testResult.status==="ok"?"#bbf7d0":"#fed7aa"}`}}>
            <div style={{fontWeight:700,marginBottom:8,color:testResult.status==="ok"?T.green:T.amber}}>
              {testResult.status==="ok"?"✅ Connection Successful":"⚠ Connection Diagnostics"}
            </div>
            {testResult.steps?.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:4,alignItems:"flex-start"}}>
                <span style={{color:s.status==="ok"?T.green:T.red,flexShrink:0}}>{s.status==="ok"?"✔":"✗"}</span>
                <span style={{color:T.sub,minWidth:120,flexShrink:0}}>{s.step}</span>
                <span style={{color:s.status==="ok"?T.text:T.red}}>{s.msg}</span>
              </div>
            ))}
            {testResult.error&&<div style={{marginTop:6,color:T.red,fontWeight:600}}>{testResult.error}</div>}
            {testResult.os&&<div style={{marginTop:6,color:T.green}}>OS: {testResult.os.os_pretty}</div>}
          </div>
        )}
        {msg&&<div style={{marginTop:12,padding:"9px 13px",borderRadius:7,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"space-between",alignItems:"center"}}>
          <button className="btn btn-ghost" onClick={testConn} disabled={testing}>
            {testing?<><span className="spinner"/>Testing...</>:"🔌 Test Connection"}</button>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy?<><span className="spinner"/>Connecting...</>:"Save & Connect"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Storage Table ─────────────────────────────────────────────────────────────
function StorageTable({storage}) {
  if(!storage?.length) return <div style={{color:T.muted,padding:"16px 0",textAlign:"center",fontSize:12}}>No storage data — click ↻ Refresh</div>;
  const typeColor=t=>{
    if(t?.includes("SAN")||t?.includes("iSCSI")||t?.includes("FC")) return {bg:"#fdf2f8",col:"#86198f"};
    if(t?.includes("NFS")||t?.includes("CIFS")) return {bg:"#eff6ff",col:"#1d4ed8"};
    if(t?.includes("LVM")) return {bg:"#fef9c3",col:"#854d0e"};
    if(t?.includes("Multipath")) return {bg:"#fdf4ff",col:"#7e22ce"};
    if(t?.includes("VHD")) return {bg:"#f0f9ff",col:"#0369a1"};
    return {bg:"#f0fdf4",col:"#166534"};
  };
  return (
    <div style={{overflowX:"auto"}}>
      <table>
        <thead><tr><th>Device</th><th>Mount</th><th>Type</th><th>FS</th><th>Size</th><th>Used</th><th>Free</th><th>Usage</th></tr></thead>
        <tbody>{storage.map((s,i)=>{
          const tc=typeColor(s.type);
          return (
            <tr key={i}>
              <td><code style={{fontSize:11}}>{s.device}</code></td>
              <td style={{fontSize:11,color:T.sub}}>{s.mountpoint}</td>
              <td><span className="badge" style={{background:tc.bg,color:tc.col,fontSize:10}}>{s.type}</span></td>
              <td><code style={{fontSize:11}}>{s.fstype}</code></td>
              <td style={{fontWeight:600}}>{s.size_gb} GB</td>
              <td style={{color:s.use_pct>85?T.red:s.use_pct>65?T.amber:T.text}}>{s.used_gb} GB</td>
              <td style={{color:T.green}}>{s.avail_gb} GB</td>
              <td style={{minWidth:100}}>
                <div style={{fontSize:11,marginBottom:3,fontWeight:600,color:s.use_pct>85?T.red:s.use_pct>65?T.amber:T.text}}>{s.use_pct}%</div>
                <StorBar pct={s.use_pct}/>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

// ── Active Ports Table ────────────────────────────────────────────────────────
function ActivePortsTable({ports, onExternalScan, scanBusy}) {
  if(!ports?.length) return (
    <div style={{padding:"16px 0"}}>
      <div style={{color:T.muted,textAlign:"center",fontSize:12,marginBottom:12}}>No active port data — click ↻ Refresh to collect from host</div>
      <div style={{textAlign:"center"}}>
        <button className="btn btn-port btn-sm" onClick={onExternalScan} disabled={scanBusy}>
          {scanBusy?<><span className="spinner"/>Scanning...</>:"🔌 External Port Scan"}
        </button>
      </div>
    </div>
  );
  const RISKY={21:"FTP",23:"Telnet",3389:"RDP",5900:"VNC",445:"SMB",1433:"MSSQL",1521:"Oracle"};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:T.muted}}>{ports.length} active listening ports</div>
        <button className="btn btn-port btn-sm" onClick={onExternalScan} disabled={scanBusy}>
          {scanBusy?<><span className="spinner"/>Scanning...</>:"🔌 External Scan"}
        </button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
        {ports.map(p=>(
          <span key={p.port} className={`port-chip ${RISKY[p.port]?"port-risky":"port-active"}`}>
            <strong>:{p.port}</strong> {p.process}{RISKY[p.port]?" ⚠":""}
          </span>
        ))}
      </div>
      {ports.some(p=>RISKY[p.port])&&(
        <div style={{padding:"8px 12px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:7,fontSize:12,color:"#9a3412"}}>
          ⚠ Risky ports active: {ports.filter(p=>RISKY[p.port]).map(p=>`${RISKY[p.port]}(:${p.port})`).join(", ")} — review firewall rules
        </div>
      )}
    </div>
  );
}

// ── External Port Scan Modal ──────────────────────────────────────────────────
function PortScanModal({target,hostId,vmId,ip,onClose}) {
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const scan=async()=>{
    if(!hostId || hostId==="undefined") {
      setResult({error:"Host ID not available — try closing and reopening."});
      return;
    }
    setBusy(true);setResult(null);
    try {
      const url=vmId?`/hosts/${hostId}/vms/${vmId}/portscan`:`/hosts/${hostId}/portscan`;
      const r=await api.post(url);
      setResult(r.data);
    } catch(e){setResult({error:e.response?.data?.detail||"Scan failed"});}
    setBusy(false);
  };
  // Only auto-start once hostId is confirmed valid
  useEffect(()=>{ if(hostId && hostId!=="undefined") scan(); },[hostId]); // eslint-disable-line
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:580}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontWeight:700,fontSize:15}}>External Port Scan — {target}</div>
            <div style={{color:T.muted,fontSize:12}}>Scanning {ip} from InfraCommand server</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-port btn-sm" onClick={scan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"↻ Rescan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        {busy&&<div className="scan-bar" style={{marginBottom:12}}/>}
        {result?.error&&<div style={{color:T.red,padding:10,background:"#fee2e2",borderRadius:7}}>{result.error}</div>}
        {result&&!result.error&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div className="kpi"><div className="kpi-val" style={{color:T.blue}}>{result.ports?.length||0}</div><div className="kpi-lbl">Open Ports</div></div>
              <div className="kpi"><div className="kpi-val" style={{color:T.red}}>{result.ports?.filter(p=>p.risky).length||0}</div><div className="kpi-lbl">Risky Ports</div></div>
            </div>
            <div className="section-hd">Open Ports Found</div>
            <div>
              {result.ports?.length>0
                ?result.ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}{p.risky?" ⚠":""}</span>)
                :<div style={{color:T.muted,fontSize:12}}>No open ports detected</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Vuln Scan Modal ───────────────────────────────────────────────────────────
function VulnScanModal({target,hostId,vmId,ip,onClose}) {
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const scan=async()=>{
    if(!hostId || hostId==="undefined") {
      setResult({error:"Host ID not available — try closing and reopening."});
      return;
    }
    setBusy(true);setResult(null);
    try {
      const r=await api.post(vmId?`/hosts/${hostId}/vms/${vmId}/scan`:`/hosts/${hostId}/scan`);
      setResult(r.data);
    } catch(e){setResult({error:e.response?.data?.detail||"Scan failed"});}
    setBusy(false);
  };
  useEffect(()=>{ if(hostId && hostId!=="undefined") scan(); },[hostId]); // eslint-disable-line
  const dl=()=>{
    if(!result||result.error) return;
    const txt=`InfraCommand Vulnerability Report\nTarget: ${result.target} (${result.ip})\nDate: ${result.scanned_at}\n\nSUMMARY: Critical:${result.summary?.critical} High:${result.summary?.high} Medium:${result.summary?.medium}\n\n${result.vulns?.map(v=>`${v.id} [${v.severity}] CVSS:${v.cvss} ${v.pkg}: ${v.desc}`).join("\n")}`;
    const a=document.createElement("a");a.href="data:text/plain,"+encodeURIComponent(txt);
    a.download=`vuln-${result.target}-${Date.now()}.txt`;a.click();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:700,maxWidth:"96vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontWeight:700,fontSize:15}}>Vulnerability Scan — {target}</div>
            <div style={{color:T.muted,fontSize:12}}>IP: {ip}</div></div>
          <div style={{display:"flex",gap:8}}>
            {result&&!result.error&&<button className="btn btn-ghost btn-sm" onClick={dl}>↓ Export</button>}
            <button className="btn btn-scan btn-sm" onClick={scan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"↻ Rescan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        {busy&&<div className="scan-bar" style={{marginBottom:12}}/>}
        {result?.error&&<div style={{color:T.red,padding:10,background:"#fee2e2",borderRadius:7}}>{result.error}</div>}
        {result&&!result.error&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
              {[["Total",result.summary?.total,T.blue],["Critical",result.summary?.critical,T.red],
                ["High",result.summary?.high,T.amber],["Medium",result.summary?.medium,T.purple],["Low",result.summary?.low,T.muted]].map(([l,v,c])=>(
                <KPI key={l} label={l} value={v} color={c}/>
              ))}
            </div>
            {result.open_ports?.length>0&&(
              <div style={{marginBottom:14}}>
                <div className="section-hd">Open Ports</div>
                {result.open_ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}</span>)}
              </div>
            )}
            <table>
              <thead><tr><th>CVE ID</th><th>Severity</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
              <tbody>{result.vulns?.map(v=>(
                <tr key={v.id}>
                  <td><a href={v.url} target="_blank" rel="noreferrer" style={{color:T.blue,fontFamily:"IBM Plex Mono",fontSize:11}}>{v.id}</a></td>
                  <td><SevBadge sev={v.severity}/></td>
                  <td><span style={{fontFamily:"IBM Plex Mono",fontWeight:700,color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</span></td>
                  <td><code style={{background:"#f1f5f9",padding:"2px 5px",borderRadius:4,fontSize:11}}>{v.pkg}</code></td>
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
function DetailPanel({sel,hostData,onDbReload}) {
  const [tab,setTab]=useState("metrics");
  const [portModal,setPortModal]=useState(false);
  const [vulnModal,setVulnModal]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [msg,setMsg]=useState(null);
  const [logs,setLogs]=useState(null);

  const isVM    = sel?.type==="vm";
  const target  = isVM ? sel.vm : hostData;
  const m       = target?.metrics||{};
  const patch   = isVM ? {} : (hostData?.patch||{});
  const storage = (isVM ? (target?.storage||m.storage) : m.storage)||[];
  const ports   = m.active_ports||[];
  const nics    = m.nics||target?.nics||[];
  const ip      = target?.ip||"N/A";
  // os_info: for hosts it's in m.os_info; for VMs it's built from target fields
  const osInfo  = m.os_info || (isVM ? {
    os_pretty: target?.os||"",
    os_name:   target?.os||"",
    arch:      "",
    kernel:    "",
    hostname:  target?.name||"",
  } : {});
  const hostId  = sel?.hostId;

  // Safe clamped display values — guard against stale DB values > 100
  const dispCpu  = Math.min(100, Math.max(0, Number(m.cpu)  || 0));
  const dispRam  = Math.min(100, Math.max(0, Number(m.ram)  || 0));
  // Disk: prefer the root-volume use_pct from storage array if available
  const rootVol  = storage.find(s => s.mountpoint==="/" ) ||
                   storage.find(s => s.device?.endsWith("1") || s.fstype==="xfs" || s.fstype==="ext4");
  const dispDisk = rootVol
    ? rootVol.use_pct
    : Math.min(100, Math.max(0, Number(m.disk) || 0));

  const loadLogs=async()=>{
    if(!hostId) return;
    try {
      // VMs have their own log store keyed by vmId
      const url = isVM && sel?.vmId
        ? `/hosts/${hostId}/vms/${sel.vmId}/logs`
        : `/hosts/${hostId}/logs`;
      const r = await api.get(url);
      setLogs(r.data);
    } catch(e) { setLogs([]); }
  };

  useEffect(()=>{
    setTab("metrics"); setLogs(null); setMsg(null);
    // If metrics haven't been collected yet (source not live), auto-refresh once
    if(!isVM && hostId && (!m.cpu && !m.ram && m.source!=="live")) {
      // Don't auto-refresh, just show the hint - user should click Refresh
    }
  },[sel?.hostId, sel?.vm?.id]);

  const doRefresh=async()=>{
    if(!sel) return;
    setRefreshing(true);setMsg(null);
    try {
      const r=await api.post(`/hosts/${hostId}/refresh`);
      setMsg({t:"ok",text:r.data.message});
      await onDbReload(hostId);
      if(tab==="logs") loadLogs();
    } catch(e){setMsg({t:"e",text:"Refresh failed"});}
    setRefreshing(false);
  };

  // Show spinner while host data is loading (sel set but hostData not yet fetched)
  if(sel && !isVM && !hostData) return (
    <div className="card shadow" style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:T.muted}}>
        <span className="spinner" style={{width:24,height:24,borderWidth:3}}/>
        <div style={{marginTop:12,fontSize:13,color:T.sub}}>Loading host data...</div>
      </div>
    </div>
  );

  if(!sel||!target) return (
    <div className="card shadow" style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:T.muted}}>
        <div style={{fontSize:48,marginBottom:12}}>🖧</div>
        <div style={{fontWeight:600,fontSize:15,color:T.sub}}>Select a host or VM</div>
        <div style={{fontSize:12,marginTop:6}}>Click any item in the tree to view details</div>
      </div>
    </div>
  );

  const patchColor=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;
  const tabs = isVM
    ? ["metrics","nics","storage","ports","logs"]
    : ["metrics","nics","storage","ports","patch","os","logs"];

  const tabLabel={metrics:"📊 Metrics",nics:"🌐 NICs",storage:"💾 Storage",
                  ports:"🔌 Ports",patch:"🔧 Patches",os:"💻 OS Info",logs:"📋 Logs"};

  // ── NIC sparkline mini-bar ───────────────────────────────────────────────
  const NicBar=({val,max,color})=>{
    const pct=max>0?Math.min(100,val/max*100):0;
    return <div style={{height:4,background:"#f1f5f9",borderRadius:2,marginTop:3}}>
      <div style={{height:4,width:`${pct}%`,background:color,borderRadius:2,transition:"width .3s"}}/>
    </div>;
  };

  // ── NIC table row ────────────────────────────────────────────────────────
  const NicRow=({n})=>{
    const maxMB=Math.max(...nics.map(x=>Math.max(x.rx_mb||0,x.tx_mb||0)),1);
    return (
      <div style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:700,fontFamily:"IBM Plex Mono",fontSize:13}}>{n.name}</span>
            <span className={`badge ${n.state==="up"?"b-ok":"b-stop"}`}>{n.state||"unknown"}</span>
            {n.speed_mbps&&<span className="badge b-info">{n.speed_mbps>=1000?`${n.speed_mbps/1000}Gbps`:`${n.speed_mbps}Mbps`}</span>}
          </div>
          <div style={{fontSize:11,color:T.muted,fontFamily:"IBM Plex Mono"}}>{n.mac||""}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
          <div>
            <div style={{color:T.muted}}>IPv4</div>
            <div style={{fontWeight:600,color:T.blue}}>{n.ipv4||"—"}</div>
            {n.ipv6&&<div style={{color:T.muted,fontSize:10}}>{n.ipv6.slice(0,30)}</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>RX</div>
            <div style={{fontWeight:600,color:T.green}}>{n.rx_mb?.toFixed?.(1)||0} MB</div>
            <NicBar val={n.rx_mb||0} max={maxMB} color={T.green}/>
            {(n.rx_err>0)&&<div style={{color:T.red,fontSize:10}}>⚠ {n.rx_err} errors</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>TX</div>
            <div style={{fontWeight:600,color:T.amber}}>{n.tx_mb?.toFixed?.(1)||0} MB</div>
            <NicBar val={n.tx_mb||0} max={maxMB} color={T.amber}/>
            {(n.tx_err>0)&&<div style={{color:T.red,fontSize:10}}>⚠ {n.tx_err} errors</div>}
          </div>
        </div>
        {(n.gateway||n.subnet)&&(
          <div style={{marginTop:6,fontSize:10,color:T.muted}}>
            {n.subnet&&<span>Subnet: {n.subnet}  </span>}
            {n.gateway&&<span>GW: {n.gateway}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Header */}
      <div className="card shadow" style={{padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
              background:target.hypervisor==="Hyper-V"||target.os_type==="windows"?"#dbeafe":"#d1fae5"}}>
              {isVM?(target.hypervisor==="Hyper-V"?"🪟":"🖥"):(target.os_type==="windows"?"🪟":"🐧")}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{target.name}</div>
              <div style={{color:T.muted,fontSize:11,marginTop:2,display:"flex",flexWrap:"wrap",gap:8}}>
                <span style={{fontFamily:"IBM Plex Mono",color:ip!=="N/A"?T.blue:T.muted}}>{ip}</span>
                {isVM&&<span>{fmtRAM(target.ram_mb)} · {target.vcpu} vCPU · {target.disk_gb}GB</span>}
                {osInfo.os_pretty&&<span style={{color:T.blue,fontWeight:500}}>{osInfo.os_pretty}</span>}
                {nics.length>0&&<span style={{color:T.muted}}>{nics.length} NIC{nics.length>1?"s":""}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {isVM&&<span className={`badge ${target.hypervisor==="KVM"?"b-kvm":"b-hv"}`}>{target.hypervisor}</span>}
            {isVM&&<StatusDot s={target.status}/>}
            {isVM&&(ip==="N/A"||!ip)&&(
              <button className="btn btn-ghost btn-sm" title="Set IP manually (macvtap direct mode)"
                onClick={async()=>{
                  const newIp=window.prompt(`Enter IP for ${target.name} (macvtap VMs can't be auto-discovered):`, ip==="N/A"?"":ip);
                  if(newIp&&newIp.trim()){
                    try{
                      await api.patch(`/hosts/${hostId}/vms/${sel.vmId}/ip`,{ip:newIp.trim()});
                      await onDbReload(hostId);
                    }catch(e){alert("Failed to set IP");}
                  }
                }} style={{fontSize:10,color:T.amber}}>✎ Set IP</button>
            )}
            <SrcBadge src={m.source}/>
            <button className="btn btn-refresh btn-sm" onClick={doRefresh} disabled={refreshing}>
              {refreshing?<><span className="spinner"/>...</>:"↻ Refresh"}</button>
            <button className="btn btn-port btn-sm" onClick={()=>setPortModal(true)}>🔌 Port Scan</button>
            <button className="btn btn-scan btn-sm" onClick={()=>setVulnModal(true)}>🔍 Vuln Scan</button>
          </div>
        </div>
        {msg&&<div style={{marginTop:8,padding:"7px 12px",borderRadius:6,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        {m.source==="error"&&<div style={{marginTop:8,padding:"7px 12px",borderRadius:6,fontSize:12,
          background:"#fff7ed",color:"#9a3412"}}>⚠ Connection error: {m.reason}</div>}
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {tabs.map(t=>(
          <button key={t} className={`tab ${tab===t?"active":""}`}
            onClick={()=>{setTab(t);if(t==="logs"&&!logs)loadLogs();}}>
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* Metrics Tab */}
      {tab==="metrics"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["CPU",dispCpu,"%",T.blue],["RAM",dispRam,"%",T.amber],
              ["Disk (root)",dispDisk,"%",T.red],
              [isVM?"vCPUs":"Load Avg",isVM?target.vcpu:m.load,"",T.green]].map(([l,v,u,c])=>(
              <div key={l} className="card" style={{padding:14}}>
                <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>{l}</div>
                <div style={{fontSize:24,fontWeight:700,color:Number(v)>85?T.red:Number(v)>65?T.amber:c}}>{Number.isFinite(Number(v))?Number(v).toFixed(1):v??0}{u}</div>
                {u==="%"&&<div style={{marginTop:8}}><Bar val={Number(v)||0}/></div>}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div className="card" style={{padding:14}}>
              <div className="section-hd">Network I/O (total)</div>
              <div style={{display:"flex",gap:24}}>
                <div><div style={{fontSize:10,color:T.muted}}>INBOUND</div><div style={{fontSize:20,fontWeight:700,color:T.green}}>{m.net_in||0} MB</div></div>
                <div><div style={{fontSize:10,color:T.muted}}>OUTBOUND</div><div style={{fontSize:20,fontWeight:700,color:T.amber}}>{m.net_out||0} MB</div></div>
              </div>
            </div>
            <div className="card" style={{padding:14}}>
              <div className="section-hd">System</div>
              {[
                ["Uptime",   m.uptime && m.uptime!=="N/A" ? m.uptime : (isVM ? "See host" : "—")],
                ["OS",       osInfo.os_pretty || osInfo.os_name || (isVM ? target?.os : "—") || "—"],
                ["Kernel",   osInfo.kernel || "—"],
                ["Arch",     osInfo.arch || "—"],
                ["Hostname", osInfo.hostname || "—"],
                ["Load Avg", !isVM && m.load ? String(m.load) : null],
              ].filter(([,v])=>v && v!=="—" && v!==null).slice(0,4).map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:T.muted,fontSize:11}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:600,fontFamily:l==="Kernel"?"IBM Plex Mono":"inherit",
                    maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{v}</span>
                </div>
              ))}
              {m.source==="error"&&<div style={{fontSize:10,color:T.red,marginTop:4}}>⚠ Last collection failed</div>}
              {(!m.cpu && !m.ram)&&<div style={{fontSize:10,color:T.amber,marginTop:4}}>Click ↻ Refresh to collect live data</div>}
            </div>
          </div>
        </div>
      )}

      {/* NICs Tab */}
      {tab==="nics"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Network Interfaces ({nics.length})</div>
            <div style={{fontSize:11,color:T.muted}}>RX/TX bars show relative utilization vs peak</div>
          </div>
          {nics.length===0
            ?<div style={{textAlign:"center",color:T.muted,padding:"30px 0"}}>
               No NIC data — click ↻ Refresh to collect
             </div>
            :nics.map(n=><NicRow key={n.name} n={n}/>)}
        </div>
      )}

      {/* Storage Tab */}
      {tab==="storage"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Storage — Local, SAN, NFS, LVM</div>
            <div style={{display:"flex",gap:6,fontSize:11,color:T.muted}}>
              {["local","LVM","NFS/CIFS","iSCSI/SAN","SAN (FC/SAS)","VHD"].map(t=>{
                const has=storage.some(s=>s.type===t||s.type?.includes(t.split(" ")[0]));
                return has?<span key={t} className="badge b-info" style={{fontSize:10}}>{t}</span>:null;
              })}
            </div>
          </div>
          <StorageTable storage={storage}/>
        </div>
      )}

      {/* Ports Tab */}
      {tab==="ports"&&(
        <div className="card shadow" style={{padding:18}}>
          <div className="section-hd">Active Listening Ports</div>
          <ActivePortsTable ports={ports} onExternalScan={()=>setPortModal(true)} scanBusy={false}/>
        </div>
      )}

      {/* Patch Tab */}
      {tab==="patch"&&!isVM&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Patch Status</div>
            <button className="btn btn-refresh btn-sm" onClick={async()=>{
              try{await api.post(`/hosts/${hostId}/patch/refresh`);await onDbReload(hostId);}catch(e){}
            }}>↻ Check Now</button>
          </div>
          {patch.status?(
            <>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16,
                padding:"8px 14px",borderRadius:8,background:patchColor(patch.status)+"18",
                border:`1px solid ${patchColor(patch.status)}44`}}>
                <span style={{fontSize:16}}>{patch.status==="UP TO DATE"?"✅":patch.status==="CRITICAL UPDATE"?"🚨":"⚠️"}</span>
                <span style={{fontWeight:700,color:patchColor(patch.status)}}>{patch.status}</span>
              </div>
              <table><tbody>
                {[["OS",patch.os],["Version",patch.os_version],["Current Kernel",patch.kernel],
                  ["Latest Kernel",patch.latest_kernel],["Package Manager",patch.pkg_manager],
                  ["Pending Updates",patch.updates_available!=null?`${patch.updates_available} packages`:"N/A"],
                  ["Security Updates",patch.security_updates!=null?`${patch.security_updates} critical`:"N/A"],
                  ["Last Patched",patch.last_patch]].map(([l,v])=>(
                  v!=null&&v!==""?<tr key={l}>
                    <td style={{color:T.muted,width:160,fontWeight:500}}>{l}</td>
                    <td style={{fontWeight:600,fontFamily:l.includes("Kernel")?"IBM Plex Mono":"inherit",
                      fontSize:l.includes("Kernel")?11:12,
                      color:l==="Pending Updates"&&patch.updates_available>0?T.red
                           :l==="Security Updates"&&patch.security_updates>0?T.red
                           :l==="Latest Kernel"&&patch.latest_kernel!==patch.kernel?T.amber:T.text}}>{v}</td>
                  </tr>:null
                ))}
              </tbody></table>
            </>
          ):<div style={{color:T.muted,textAlign:"center",padding:"20px 0"}}>Click "Check Now"</div>}
        </div>
      )}

      {/* OS Tab */}
      {tab==="os"&&!isVM&&(
        <div className="card shadow" style={{padding:18}}>
          <div className="section-hd">OS & System Information</div>
          {osInfo.os_pretty?(
            <table><tbody>
              {[["OS",osInfo.os_pretty],["Version",osInfo.os_version],
                ["Kernel",osInfo.kernel],["Architecture",osInfo.arch],["Hostname",osInfo.hostname]].map(([l,v])=>(
                v?<tr key={l}>
                  <td style={{color:T.muted,width:160,fontWeight:500}}>{l}</td>
                  <td style={{fontWeight:600,fontFamily:l==="Kernel"?"IBM Plex Mono":"inherit",fontSize:l==="Kernel"?11:12}}>{v}</td>
                </tr>:null
              ))}
            </tbody></table>
          ):<div style={{color:T.muted,textAlign:"center",padding:"20px 0"}}>Click ↻ Refresh to detect OS info</div>}
        </div>
      )}

      {/* Logs Tab */}
      {tab==="logs"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Event Logs — {target.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={loadLogs}>↻ Refresh</button>
          </div>
          <div style={{maxHeight:"55vh",overflowY:"auto"}}>
            {!logs&&<div style={{textAlign:"center",color:T.muted,padding:30}}>Loading...</div>}
            {logs&&logs.length===0&&<div style={{textAlign:"center",color:T.muted,padding:30}}>No logs yet. Add or refresh this host to generate events.</div>}
            {logs&&logs.map((l,i)=>{
              const lc=l.level==="ERROR"?T.red:l.level==="WARN"?T.amber:T.green;
              return (
                <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #f1f5f9",fontSize:11}}>
                  <span style={{color:T.muted,minWidth:60,fontFamily:"IBM Plex Mono"}}>{l.ts?.slice(11,19)}</span>
                  <span style={{minWidth:14,color:lc,fontWeight:700}}>
                    {l.level==="ERROR"?"✕":l.level==="WARN"?"⚠":"✓"}
                  </span>
                  <span className={`badge`} style={{background:lc+"22",color:lc,minWidth:42,textAlign:"center",height:16,lineHeight:"16px"}}>{l.level}</span>
                  <span style={{minWidth:60,color:T.muted}}>{l.source}</span>
                  <span style={{flex:1,color:T.sub}}>{l.msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {portModal&&<PortScanModal
        target={target?.name||""}
        hostId={hostId}
        vmId={isVM ? sel.vmId : null}
        ip={ip}
        onClose={()=>setPortModal(false)}/>}
      {vulnModal&&<VulnScanModal
        target={target?.name||""}
        hostId={hostId}
        vmId={isVM ? sel.vmId : null}
        ip={ip}
        onClose={()=>setVulnModal(false)}/>}
    </div>
  );
}

function InfraView({rawHosts,onGlobalReload}) {
  const [sel,setSel]       = useState(null);
  const [hostCache,setHostCache] = useState({});
  const [loading,setLoading]     = useState(null);
  const [showAdd,setShowAdd]     = useState(false);
  const [promoteVM,setPromoteVM] = useState(null);
  const [treeTab,setTreeTab]     = useState("physical"); // "physical" | "vms"
  const [expanded,setExpanded]   = useState({});

  // ── Data helpers ────────────────────────────────────────────────────────────
  const loadHost=async(hid,force=false)=>{
    if(hostCache[hid]&&!force) return hostCache[hid];
    setLoading(hid);
    try {
      const r=await api.get(`/hosts/${hid}`);
      setHostCache(c=>({...c,[hid]:r.data}));
      setLoading(null);
      return r.data;
    } catch(e){setLoading(null);return null;}
  };
  const onDbReload=async(hid)=>{onGlobalReload();await loadHost(hid,true);};
  const clickHost=async(hid)=>{
    await loadHost(hid,true);
    setSel({type:"host",hostId:hid});
    setExpanded(e=>({...e,[hid]:true}));
  };
  const refreshVMs=async(hid,e)=>{
    e.stopPropagation();
    setLoading(hid+"_vms");
    try{const r=await api.post(`/hosts/${hid}/vms/refresh`);setHostCache(c=>({...c,[hid]:{...c[hid],vms:r.data.vms||[]}}));}catch(e){}
    setLoading(null);
  };
  const deleteHost=async(hid,e)=>{
    e.stopPropagation();
    await api.delete(`/hosts/${hid}`).catch(()=>{});
    onGlobalReload();
    if(sel?.hostId===hid) setSel(null);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const currentHostData = sel ? (hostCache[sel.hostId]||null) : null;
  const enrichedSel = sel?.type==="vm"&&sel.vm
    ? {...sel, vm:{...sel.vm, metrics:{...(sel.vm.metrics||{})}, storage:sel.vm.storage||[]}}
    : sel;

  // Physical hosts = everything in rawHosts
  // All discovered VMs across all hosts
  const allVMs = rawHosts.flatMap(h=>{
    const det = hostCache[h.id];
    return (det?.vms||h.vms||[]).map(vm=>({...vm, _parentHost:h}));
  });
  // VMs that have been "promoted" (IP matches a rawHost)
  const promotedIPs = new Set(rawHosts.map(h=>h.ip).filter(Boolean));

  // ── Resource summary (total across all hosts with live metrics) ──────────
  const liveHosts = rawHosts.filter(h=>{
    const m=(hostCache[h.id]||h).metrics||{};
    return m.source==="live";
  });
  const summary = liveHosts.reduce((acc,h)=>{
    const m=(hostCache[h.id]||h).metrics||{};
    const det=hostCache[h.id]||h;
    // CPU cores — try to derive from vCPU count or default to 1
    const cpuCores = det.cpu_cores||1;
    acc.hosts++;
    acc.cpuPct  += Number(m.cpu)||0;
    acc.ramPct  += Number(m.ram)||0;
    acc.diskPct += Number(m.disk)||0;
    // Total RAM in GB from host data
    const ramGB = det.metrics?.ram_total_gb||0;
    acc.ramTotalGB += ramGB;
    acc.ramUsedGB  += ramGB * (Number(m.ram)||0) / 100;
    // Storage from storage array
    const storage = m.storage||[];
    storage.filter(s=>s.mountpoint==="/").forEach(s=>{
      acc.diskTotalGB += s.size_gb||0;
      acc.diskUsedGB  += s.used_gb||0;
    });
    return acc;
  },{hosts:0,cpuPct:0,ramPct:0,diskPct:0,ramTotalGB:0,ramUsedGB:0,diskTotalGB:0,diskUsedGB:0});
  if(summary.hosts>0){summary.cpuPct=Math.round(summary.cpuPct/summary.hosts);summary.ramPct=Math.round(summary.ramPct/summary.hosts);summary.diskPct=Math.round(summary.diskPct/summary.hosts);}

  // ── Resource summary from overview endpoint ──────────────────────────────
  const [resSummary,setResSummary]=useState(null);
  useEffect(()=>{
    api.get("/overview").then(r=>setResSummary(r.data)).catch(()=>{});
  },[rawHosts.length]);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const SummaryBar=({pct,color})=>(
    <div style={{height:6,background:"#f1f5f9",borderRadius:3,marginTop:4}}>
      <div style={{height:6,width:`${Math.min(100,pct||0)}%`,background:color,borderRadius:3,transition:"width .4s"}}/>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* ── Resource Summary Bar ─────────────────────────────────────────── */}
      {resSummary&&(
        <div className="card shadow" style={{padding:"12px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13}}>Cluster Resource Summary</div>
            <div style={{fontSize:11,color:T.muted}}>{resSummary.total_hosts} hosts · {allVMs.length} VMs</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {[
              ["CPU Usage",resSummary.avg_cpu,"%",T.blue,null,null],
              ["RAM Usage",resSummary.avg_ram,"%",T.amber,
               resSummary.ram_used_gb!=null?`${resSummary.ram_used_gb?.toFixed(1)} / ${resSummary.ram_total_gb?.toFixed(1)} GB`:null,null],
              ["Disk (root)",resSummary.avg_disk,"%",T.red,
               resSummary.disk_used_gb!=null?`${resSummary.disk_used_gb?.toFixed(1)} / ${resSummary.disk_total_gb?.toFixed(1)} GB`:null,null],
              ["Hosts Online",resSummary.hosts_online,`/ ${resSummary.total_hosts}`,T.green,null,null],
            ].map(([label,val,unit,color,sub])=>(
              <div key={label}>
                <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.4}}>{label}</div>
                <div style={{fontSize:20,fontWeight:700,color,marginTop:2}}>
                  {val??"-"}<span style={{fontSize:12,fontWeight:400,color:T.muted}}>{unit}</span>
                </div>
                {typeof val==="number"&&unit==="%"&&<SummaryBar pct={val} color={color}/>}
                {sub&&<div style={{fontSize:10,color:T.muted,marginTop:3}}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main layout: tree + detail ───────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"290px 1fr",gap:12,height:"calc(100vh - 180px)"}}>

        {/* Tree Panel */}
        <div className="card shadow" style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>

          {/* Header + Add */}
          <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${T.border}`,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:700,fontSize:13}}>Infrastructure</div>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add Host</button>
          </div>

          {/* Group tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:"#f8fafc"}}>
            {[["physical","🖧 Physical Hosts",rawHosts.length],
              ["vms","🖥 VM Groups",allVMs.length]].map(([id,label,count])=>(
              <button key={id} onClick={()=>setTreeTab(id)}
                style={{flex:1,padding:"7px 4px",fontSize:11,fontWeight:treeTab===id?700:400,
                  border:"none",borderBottom:treeTab===id?`2px solid ${T.blue}`:"2px solid transparent",
                  background:"transparent",cursor:"pointer",color:treeTab===id?T.blue:T.muted}}>
                {label} <span style={{fontSize:10,background:T.border,borderRadius:8,
                  padding:"1px 5px",marginLeft:2}}>{count}</span>
              </button>
            ))}
          </div>

          <div style={{overflowY:"auto",flex:1,padding:6}}>

            {/* ── PHYSICAL HOSTS TAB ─────────────────────────────────── */}
            {treeTab==="physical"&&(
              <>
                {rawHosts.map(h=>{
                  const det=hostCache[h.id];
                  const vms=det?.vms||h.vms||[];
                  const m=(det||h).metrics||{};
                  const isExp=expanded[h.id];
                  const isSel=sel?.type==="host"&&sel.hostId===h.id;
                  const isOnline=m.source==="live";
                  return (
                    <div key={h.id} style={{marginBottom:2}}>
                      <div className={`tree-row ${isSel?"sel":""}`} onClick={()=>clickHost(h.id)}>
                        <span style={{fontSize:15,flexShrink:0}}>{h.os_type==="linux"?"🐧":"🪟"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                          <div style={{fontSize:10,color:T.muted,display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{fontFamily:"IBM Plex Mono",fontSize:9}}>{h.ip}</span>
                            {isOnline&&<><span style={{color:T.blue}}>CPU:{m.cpu}%</span><span style={{color:T.amber}}>RAM:{m.ram}%</span></>}
                            <span className={`badge ${h.os_type==="linux"?"b-kvm":"b-hv"}`} style={{fontSize:8,padding:"0 4px"}}>{h.os_type==="linux"?"KVM":"Hyper-V"}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:3,flexShrink:0,alignItems:"center"}}>
                          {(loading===h.id||loading===h.id+"_vms")&&<span className="spinner" style={{width:10,height:10}}/>}
                          {isExp&&<button className="btn btn-ghost btn-sm" style={{padding:"2px 5px",fontSize:9}}
                            onClick={e=>refreshVMs(h.id,e)} title="Discover VMs">⟳</button>}
                          <span style={{fontSize:10,color:T.muted,cursor:"pointer",padding:"0 2px"}}
                            onClick={e=>{e.stopPropagation();setExpanded(ex=>({...ex,[h.id]:!ex[h.id]}));}}>{isExp?"▾":"▸"}</span>
                          <button className="btn btn-ghost btn-sm" style={{padding:"2px 4px",fontSize:9,color:T.red}}
                            onClick={e=>deleteHost(h.id,e)}>✕</button>
                        </div>
                      </div>

                      {/* Hosted VMs under physical host */}
                      {isExp&&(
                        <div style={{marginLeft:14,borderLeft:`2px solid ${T.border}`,paddingLeft:8,marginBottom:2}}>
                          {vms.length===0
                            ?<div style={{padding:"5px 8px",color:T.muted,fontSize:10}}>
                                {loading===h.id+"_vms"?"Discovering...":"No VMs — click ⟳ to discover"}
                              </div>
                            :vms.map(vm=>{
                                const isSelVM=sel?.type==="vm"&&sel.vmId===vm.id;
                                const alreadyAdded=promotedIPs.has(vm.ip)&&vm.ip&&vm.ip!=="N/A";
                                return (
                                  <div key={vm.id} className={`tree-row ${isSelVM?"sel":""}`}
                                    onClick={()=>setSel({type:"vm",hostId:h.id,vmId:vm.id,vm:{...vm,metrics:{...vm.metrics,storage:vm.storage||[],active_ports:[],nics:vm.nics||[]}}})}
                                    style={{padding:"4px 6px"}}>
                                    <span style={{fontSize:12}}>🖥</span>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontWeight:500,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{vm.name}</div>
                                      <div style={{fontSize:9,color:T.muted,display:"flex",gap:4,alignItems:"center"}}>
                                        <StatusDot s={vm.status}/>
                                        {vm.ip&&vm.ip!=="N/A"&&<span style={{fontFamily:"IBM Plex Mono"}}>{vm.ip}</span>}
                                      </div>
                                    </div>
                                    <div style={{display:"flex",gap:3,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                                      {alreadyAdded
                                        ?<span title="Already in Physical Hosts" style={{fontSize:9,color:T.green,
                                            padding:"1px 4px",border:`1px solid ${T.green}44`,borderRadius:3}}>✓ added</span>
                                        :vm.ip&&vm.ip!=="N/A"
                                          ?<button title="Add as standalone host" onClick={()=>setPromoteVM({vm,hostId:h.id})}
                                              style={{fontSize:9,padding:"1px 5px",border:`1px solid ${T.blue}55`,
                                                borderRadius:3,background:"#eff6ff",color:T.blue,cursor:"pointer",fontWeight:700}}>+</button>
                                          :null}
                                    </div>
                                  </div>
                                );
                              })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {rawHosts.length===0&&(
                  <div style={{padding:"30px 10px",textAlign:"center",color:T.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>🖧</div>
                    <div style={{fontSize:12}}>No hosts yet</div>
                    <button className="btn btn-primary btn-sm" style={{marginTop:10}} onClick={()=>setShowAdd(true)}>+ Add Host</button>
                  </div>
                )}
              </>
            )}

            {/* ── VM GROUPS TAB ──────────────────────────────────────── */}
            {treeTab==="vms"&&(
              <>
                {rawHosts.filter(h=>{
                  const det=hostCache[h.id];
                  return (det?.vms||h.vms||[]).length>0;
                }).map(h=>{
                  const det=hostCache[h.id];
                  const vms=det?.vms||h.vms||[];
                  const isExp=expanded["vg_"+h.id]!==false; // default expanded
                  return (
                    <div key={h.id} style={{marginBottom:6}}>
                      {/* Parent host header */}
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
                        background:"#f1f5f9",borderRadius:6,cursor:"pointer",
                        fontSize:11,fontWeight:700,color:T.sub}}
                        onClick={()=>setExpanded(e=>({...e,["vg_"+h.id]:!isExp}))}>
                        <span>{isExp?"▾":"▸"}</span>
                        <span>{h.os_type==="linux"?"🐧":"🪟"}</span>
                        <span style={{flex:1}}>{h.name}</span>
                        <span style={{fontSize:10,background:T.border,borderRadius:8,
                          padding:"1px 6px",fontWeight:400}}>{vms.length} VMs</span>
                      </div>
                      {isExp&&(
                        <div style={{marginLeft:10,borderLeft:`2px solid ${T.border}`,paddingLeft:8,marginTop:2}}>
                          {vms.map(vm=>{
                            const isSelVM=sel?.type==="vm"&&sel.vmId===vm.id;
                            const alreadyAdded=promotedIPs.has(vm.ip)&&vm.ip&&vm.ip!=="N/A";
                            const vmMetrics=vm.metrics||{};
                            return (
                              <div key={vm.id} className={`tree-row ${isSelVM?"sel":""}`}
                                onClick={()=>setSel({type:"vm",hostId:h.id,vmId:vm.id,vm:{...vm,metrics:{...vm.metrics,storage:vm.storage||[],active_ports:[],nics:vm.nics||[]}}})}
                                style={{padding:"5px 6px",marginBottom:1}}>
                                <span style={{fontSize:13}}>🖥</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{vm.name}</div>
                                  <div style={{fontSize:9,color:T.muted,display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                                    <StatusDot s={vm.status}/>
                                    <span>{vm.status}</span>
                                    {vm.ip&&vm.ip!=="N/A"&&<span style={{fontFamily:"IBM Plex Mono",color:T.blue}}>{vm.ip}</span>}
                                    {vmMetrics.cpu!=null&&<span style={{color:T.blue}}>CPU:{vmMetrics.cpu}%</span>}
                                    {vmMetrics.ram!=null&&<span style={{color:T.amber}}>RAM:{vmMetrics.ram}%</span>}
                                  </div>
                                </div>
                                <div style={{display:"flex",gap:3,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                                  {alreadyAdded
                                    ?<span title="Already in Physical Hosts" style={{fontSize:9,color:T.green,
                                        padding:"1px 4px",border:`1px solid ${T.green}44`,borderRadius:3}}>✓</span>
                                    :vm.ip&&vm.ip!=="N/A"
                                      ?<button title="Add as standalone monitored host"
                                          onClick={()=>setPromoteVM({vm,hostId:h.id})}
                                          style={{fontSize:9,padding:"1px 5px",border:`1px solid ${T.blue}55`,
                                            borderRadius:3,background:"#eff6ff",color:T.blue,cursor:"pointer",fontWeight:700}}>+</button>
                                      :null}
                                  <span className={`badge ${vm.hypervisor==="KVM"?"b-kvm":"b-hv"}`} style={{fontSize:8,padding:"1px 4px"}}>{vm.hypervisor}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {allVMs.length===0&&(
                  <div style={{padding:"30px 10px",textAlign:"center",color:T.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>🖥</div>
                    <div style={{fontSize:12}}>No VMs discovered yet</div>
                    <div style={{fontSize:11,marginTop:4}}>Click ⟳ on a physical host to discover</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{overflowY:"auto"}}>
          <DetailPanel sel={enrichedSel} hostData={currentHostData} onDbReload={onDbReload}/>
        </div>
      </div>

      {showAdd&&<AddHostModal onClose={()=>setShowAdd(false)} onAdded={()=>{onGlobalReload();setShowAdd(false);}}/>}
      {promoteVM&&<PromoteVMModal
        vm={promoteVM.vm} hostId={promoteVM.hostId}
        onClose={()=>setPromoteVM(null)}
        onAdded={()=>{onGlobalReload();setPromoteVM(null);}}/>}
    </div>
  );
}

function Overview({hosts,summary,history}) {
  const [selHost,setSelHost]=useState(null);
  const host=selHost?hosts.find(h=>h.id===selHost):null;
  const m=host?.metrics||{};
  const stor=m.storage||[];
  const ports=m.active_ports||[];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Global KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[["Hosts",summary.hosts,T.blue],["VMs",summary.total_vms,T.cyan],
          ["Avg CPU",`${summary.avg_cpu}%`,summary.avg_cpu>80?T.red:T.green],
          ["Warnings",summary.warnings,summary.warnings>0?T.amber:T.green],
          ["Live",hosts.filter(h=>h.metrics?.source==="live").length,T.green]].map(([l,v,c])=>(
          <div key={l} className="card shadow"><KPI label={l} value={v} color={c}/></div>
        ))}
      </div>

      {/* Host selector */}
      <div className="card shadow" style={{padding:14}}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:600,color:T.sub}}>Drill down:</span>
          <button className={`btn ${!selHost?"btn-primary":"btn-ghost"}`} onClick={()=>setSelHost(null)}>All Hosts</button>
          {hosts.map(h=>(
            <button key={h.id} className={`btn ${selHost===h.id?"btn-primary":"btn-ghost"}`}
              onClick={()=>setSelHost(h.id)}>{h.os_type==="linux"?"🐧":"🪟"} {h.name}</button>
          ))}
        </div>
      </div>

      {!selHost?(
        <>
          {/* Charts */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["CPU Usage 24h","cpu",T.blue],["RAM Usage 24h","ram",T.amber]].map(([title,key,col])=>(
              <div key={key} className="card shadow" style={{padding:16}}>
                <div className="section-hd">{title}</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={history}>
                    <defs><linearGradient id={`g${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={col} stopOpacity={0.12}/><stop offset="95%" stopColor={col} stopOpacity={0}/>
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
          {/* All hosts table */}
          <div className="card shadow" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}><div className="section-hd" style={{margin:0}}>All Hosts</div></div>
            <table>
              <thead><tr><th>Host</th><th>IP</th><th>OS</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Uptime</th><th>Source</th></tr></thead>
              <tbody>{hosts.map(h=>{
                const o=h.metrics?.os_info||{};
                return <tr key={h.id} style={{cursor:"pointer"}} onClick={()=>setSelHost(h.id)}>
                  <td style={{fontWeight:600}}>{h.os_type==="linux"?"🐧":"🪟"} {h.name}</td>
                  <td><code style={{fontSize:11}}>{h.ip}</code></td>
                  <td style={{fontSize:11}}>{o.os_pretty||"—"}</td>
                  <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:2}}>{h.metrics?.cpu}%</div><Bar val={h.metrics?.cpu}/></div></td>
                  <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:2}}>{h.metrics?.ram}%</div><Bar val={h.metrics?.ram}/></div></td>
                  <td><div style={{minWidth:80}}><div style={{fontSize:11,marginBottom:2}}>{h.metrics?.disk}%</div><Bar val={h.metrics?.disk}/></div></td>
                  <td style={{fontSize:11,color:T.muted}}>{h.metrics?.uptime}</td>
                  <td><SrcBadge src={h.metrics?.source}/></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </>
      ):(
        /* Per-host detail in overview */
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["CPU",m.cpu,"%",T.blue],["RAM",m.ram,"%",T.amber],["Disk",m.disk,"%",T.red],["Load",m.load,"",T.green]].map(([l,v,u,c])=>(
              <div key={l} className="card shadow" style={{padding:14}}>
                <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>{l}</div>
                <div style={{fontSize:26,fontWeight:700,color:v>85?T.red:v>65?T.amber:c}}>{v}{u}</div>
                {u==="%"&&<div style={{marginTop:8}}><Bar val={v}/></div>}
              </div>
            ))}
          </div>
          {/* Storage summary */}
          {stor.length>0&&(
            <div className="card shadow" style={{padding:16}}>
              <div className="section-hd">Storage</div>
              <StorageTable storage={stor}/>
            </div>
          )}
          {/* Active ports summary */}
          {ports.length>0&&(
            <div className="card shadow" style={{padding:16}}>
              <div className="section-hd">Active Listening Ports ({ports.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {ports.map(p=><span key={p.port} className="port-active port-chip">:{p.port} {p.process}</span>)}
              </div>
            </div>
          )}
          {/* Host's VMs */}
          {(host?.vms||[]).length>0&&(
            <div className="card shadow" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}><div className="section-hd" style={{margin:0}}>VMs on {host.name}</div></div>
              <table>
                <thead><tr><th>Name</th><th>Hypervisor</th><th>Status</th><th>OS</th><th>IP</th><th>vCPU</th><th>RAM</th><th>CPU%</th><th>RAM%</th></tr></thead>
                <tbody>{(host.vms||[]).map(vm=>(
                  <tr key={vm.id}>
                    <td style={{fontWeight:600}}>🖥 {vm.name}</td>
                    <td><span className={`badge ${vm.hypervisor==="KVM"?"b-kvm":"b-hv"}`}>{vm.hypervisor}</span></td>
                    <td><StatusDot s={vm.status}/>{vm.status}</td>
                    <td style={{fontSize:11,color:T.sub}}>{vm.os||"—"}</td>
                    <td><code style={{fontSize:11}}>{vm.ip}</code></td>
                    <td>{vm.vcpu}</td>
                    <td>{fmtRAM(vm.ram_mb)}</td>
                    <td><Bar val={vm.metrics?.cpu}/></td>
                    <td><Bar val={vm.metrics?.ram}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Patches ───────────────────────────────────────────────────────────────────
function Patches() {
  const [patches,setPatches]=useState([]);
  useEffect(()=>{api.get("/patches").then(r=>setPatches(r.data)).catch(()=>{});},[]);
  const pc=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;
  return (
    <div>
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Patch Status</div>
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
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function Alerts() {
  const [alerts,setAlerts]=useState([]);
  const [busy,setBusy]=useState(false);
  const load=async()=>{
    setBusy(true);
    try{const r=await api.get("/alerts");setAlerts(r.data);}catch(e){}
    setBusy(false);
  };
  useEffect(()=>{load();},[]);

  const crit = alerts.filter(a=>a.severity==="critical");
  const warn  = alerts.filter(a=>a.severity!=="critical");

  const typeIcon={Connection:"🔌","CPU":"🔥","RAM":"🧠","Disk":"💾","Storage":"💽",
                  NIC:"🌐","NIC Error":"🌐","Security Patch":"🔐","Patch":"🔧"};

  const AlertCard=({a})=>(
    <div className="card shadow" style={{padding:"12px 18px",borderLeft:`4px solid ${a.severity==="critical"?T.red:T.amber}`,
      background:a.severity==="critical"?"#fff8f8":"#fffdf0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <span style={{fontSize:18}}>{typeIcon[a.type]||"⚠️"}</span>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span className={`badge ${a.severity==="critical"?"b-crit":"b-warn"}`}>{a.type}</span>
              <span style={{fontWeight:600,fontSize:12}}>{a.host}</span>
            </div>
            <div style={{fontSize:12,color:T.sub}}>{a.msg}</div>
          </div>
        </div>
        {a.ts&&<span style={{color:T.muted,fontSize:10,whiteSpace:"nowrap"}}>{a.ts.slice(11,19)} UTC</span>}
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:15}}>
          Alerts
          {crit.length>0&&<span style={{marginLeft:8,background:T.red,color:"#fff",borderRadius:10,padding:"2px 8px",fontSize:11}}>{crit.length} critical</span>}
          {warn.length>0&&<span style={{marginLeft:6,background:T.amber,color:"#fff",borderRadius:10,padding:"2px 8px",fontSize:11}}>{warn.length} warning</span>}
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={busy}>{busy?<span className="spinner"/>:"↻"} Refresh</button>
      </div>
      {alerts.length===0&&<div className="card shadow" style={{padding:40,textAlign:"center",color:T.green,fontSize:15}}>✅ No active alerts — all systems healthy</div>}
      {crit.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.red,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>🚨 Critical ({crit.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{crit.map(a=><AlertCard key={a.id} a={a}/>)}</div>
        </div>
      )}
      {warn.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.amber,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>⚠️ Warnings ({warn.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{warn.map(a=><AlertCard key={a.id} a={a}/>)}</div>
        </div>
      )}
    </div>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────
function Logs({hosts}) {
  const [logs,setLogs]=useState([]);
  const [hf,setHf]=useState("all");
  const [lf,setLf]=useState("all");
  const [busy,setBusy]=useState(false);
  const fetch=useCallback(async()=>{
    setBusy(true);
    try {
      const r=hf!=="all"?await api.get(`/hosts/${hf}/logs`):await api.get("/logs",{params:{limit:300,...(lf!=="all"?{level:lf}:{})}});
      setLogs(r.data);
    } catch(e){}
    setBusy(false);
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
        <button className="btn btn-ghost" onClick={fetch}>{busy?<span className="spinner"/>:"↻"} Refresh</button>
        <span style={{color:T.muted,fontSize:11}}>{logs.length} entries</span>
      </div>
      <div className="card shadow" style={{padding:0,maxHeight:"68vh",overflowY:"auto"}}>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"7px 14px",borderBottom:`1px solid #f1f5f9`,fontSize:11,background:i%2===0?"#fff":"#fafbfc"}}>
            <span style={{color:T.muted,minWidth:70,fontFamily:"IBM Plex Mono"}}>{l.ts?.slice(11,19)}</span>
            <span style={{minWidth:44,fontWeight:700,color:lc(l.level)}}>{l.level}</span>
            <span style={{minWidth:110,color:T.blue,fontWeight:500}}>{l.host}</span>
            <span style={{flex:1,color:T.sub}}>{l.msg}</span>
          </div>
        ))}
        {logs.length===0&&<div style={{padding:40,textAlign:"center",color:T.muted}}>No logs</div>}
      </div>
    </div>
  );
}


// ── Debug Console ─────────────────────────────────────────────────────────────
// ── VM IP Debugger ────────────────────────────────────────────────────────────
function VMIPDebug({hosts}) {
  const [hid,setHid]=useState("");
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const run=async()=>{
    if(!hid) return;
    setBusy(true); setResult(null);
    try { const r=await api.get(`/hosts/${hid}/debug/vm-ips`); setResult(r.data); }
    catch(e){ setResult({error:String(e)}); }
    setBusy(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontWeight:700,fontSize:15}}>VM IP Debugger</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <select value={hid} onChange={e=>setHid(e.target.value)} style={{width:200}}>
          <option value="">— Select host —</option>
          {hosts.map(h=><option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={busy||!hid}>
          {busy?<><span className="spinner"/>Running...</>:"🔍 Run IP Debug"}
        </button>
      </div>
      {result&&(
        <div className="card shadow" style={{padding:16}}>
          {result.error&&<div style={{color:T.red}}>{result.error}</div>}
          {result.virsh_list&&(
            <div style={{marginBottom:12}}>
              <div style={{fontWeight:700,marginBottom:4}}>virsh list --all</div>
              <pre style={{background:"#f8fafc",padding:8,borderRadius:6,fontSize:11,overflowX:"auto"}}>{result.virsh_list}</pre>
            </div>
          )}
          {result.vms&&Object.entries(result.vms).map(([vname,d])=>(
            <div key={vname} style={{marginBottom:16,borderTop:"1px solid #f1f5f9",paddingTop:12}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>🖥 {vname} <span style={{fontSize:11,color:T.muted}}>({d.state})</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["virsh domifaddr",d.domifaddr],["virsh domiflist",d.domiflist],
                  ...d.macs?.flatMap(mac=>[
                    [`arp grep ${mac.slice(-5)}`,d[`arp_${mac}`]],
                    [`ip neigh grep ${mac.slice(-5)}`,d[`neigh_${mac}`]],
                  ])||[]
                ].map(([label,val])=>(
                  <div key={label}>
                    <div style={{fontSize:10,fontWeight:700,color:T.muted,marginBottom:2}}>{label}</div>
                    <pre style={{background:"#f8fafc",padding:6,borderRadius:4,fontSize:10,
                      margin:0,overflowX:"auto",minHeight:24,color:val?"#1e293b":T.muted}}>
                      {val||"(empty)"}</pre>
                  </div>
                ))}
              </div>
              {d.macs?.length>0&&(
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.muted,marginBottom:2}}>MACs found</div>
                  {d.macs.map(m=><code key={m} style={{fontSize:11,background:"#f1f5f9",padding:"2px 6px",borderRadius:4,marginRight:6}}>{m}</code>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DebugConsole() {
  const [form,setForm]=useState({ip:"",os_type:"linux",username:"root",password:"",
    ssh_port:22,winrm_port:5985,auth_type:"password",name:"debug",ssh_key:""});
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const run=async()=>{
    if(!form.ip) return;
    setBusy(true);setResult(null);
    try {
      const r=await api.post("/debug/connect",{...form,ssh_port:Number(form.ssh_port),winrm_port:Number(form.winrm_port)});
      setResult(r.data);
    } catch(e){
      setResult({error: e.response?.data?.detail||e.message, steps:[]});
    }
    setBusy(false);
  };

  const [winrmSetup,setWinrmSetup]=useState(null);
  const loadWinrmSetup=async()=>{
    try{const r=await api.get("/winrm-setup");setWinrmSetup(r.data);}catch(e){}
  };

  const stepColor=ok=>ok?T.green:T.red;
  const stepIcon=ok=>ok?"✔":"✗";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:900}}>
      <div style={{fontWeight:700,fontSize:15}}>Connection Debug Console</div>
      <div style={{fontSize:12,color:T.muted}}>
        Tests TCP → Auth → OS detect → Metrics → Patch → VMs step by step and shows exact error at each stage.
      </div>

      <div className="card shadow" style={{padding:18}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {[["IP Address","ip","text","192.168.1.100"],["Username","username","text","root"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>OS Type</label>
            <select value={form.os_type} onChange={e=>set("os_type",e.target.value)}>
              <option value="linux">🐧 Linux</option>
              <option value="windows">🪟 Windows</option>
            </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>
            {form.os_type==="linux"?"SSH Port":"WinRM Port"}</label>
            <input type="number" value={form.os_type==="linux"?form.ssh_port:form.winrm_port}
              onChange={e=>set(form.os_type==="linux"?"ssh_port":"winrm_port",e.target.value)}/></div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Password</label>
            <input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy||!form.ip}>
          {busy?<><span className="spinner"/>Running diagnostics...</>:"▶ Run Full Diagnostics"}</button>
      </div>

      {result&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>
            Diagnostic Results — {result.ip}
            {result.error&&!result.steps?.length&&(
              <span style={{color:T.red,fontWeight:400,fontSize:12,marginLeft:10}}>{result.error}</span>
            )}
          </div>

          {/* Steps */}
          {result.steps?.map((s,i)=>(
            <div key={i} style={{marginBottom:12,padding:"10px 14px",borderRadius:8,
              background:s.ok?"#f0fdf4":"#fff5f5",border:`1px solid ${s.ok?"#bbf7d0":"#fecaca"}`}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:s.detail?6:0}}>
                <span style={{color:stepColor(s.ok),fontSize:16,fontWeight:700}}>{stepIcon(s.ok)}</span>
                <span style={{fontWeight:700,minWidth:120}}>{s.step}</span>
                <span className="badge" style={{background:s.ok?"#dcfce7":"#fee2e2",color:s.ok?T.green:T.red}}>
                  {s.ok?"PASS":"FAIL"}</span>
              </div>
              {s.detail&&(
                <pre style={{fontSize:10,color:s.ok?T.sub:T.red,fontFamily:"IBM Plex Mono",
                  background:s.ok?"#f8fafc":"#fff0f0",padding:"6px 10px",borderRadius:6,
                  overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",margin:0}}>
                  {s.detail}
                </pre>
              )}
            </div>
          ))}

          {/* Top-level error */}
          {result.error&&result.steps?.length>0&&(
            <div style={{padding:"10px 14px",borderRadius:8,background:"#fff5f5",
              border:"1px solid #fecaca",color:T.red,fontSize:12}}>
              <strong>Final error:</strong> {result.error}
            </div>
          )}

          {/* WinRM setup for Windows */}
          {form.os_type==="windows" && result?.steps?.some(s=>!s.ok && s.step.startsWith("WinRM")) && (
            <div style={{marginTop:14,padding:"14px 16px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8}}>
              <div style={{fontWeight:700,marginBottom:10,color:T.blue}}>🪟 WinRM Setup Required</div>
              {!winrmSetup
                ?<button className="btn btn-ghost btn-sm" onClick={loadWinrmSetup}>Show setup commands</button>
                :<div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{winrmSetup.note}</div>
                  <pre style={{background:"#1e293b",color:"#e2e8f0",padding:"12px 14px",borderRadius:8,
                    fontSize:11,fontFamily:"IBM Plex Mono",overflowX:"auto",whiteSpace:"pre"}}>
{winrmSetup.commands?.join("\n")}
                  </pre>
                </div>}
            </div>
          )}

          {/* Remediation hints */}
          {result.steps?.some(s=>!s.ok)&&(
            <div style={{marginTop:14,padding:"12px 16px",background:"#fffbeb",
              border:"1px solid #fde68a",borderRadius:8,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:8,color:T.amber}}>💡 Remediation hints</div>
              {result.steps.filter(s=>!s.ok).map((s,i)=>{
                let hint="";
                if(s.step.startsWith("TCP")) hint=`Port unreachable — check firewall, confirm the IP is correct, and that SSH/WinRM is running. Run: nc -zv ${result.ip} ${form.os_type==="linux"?form.ssh_port:form.winrm_port}`;
                else if(s.step==="SSH") hint="Auth failed — verify username/password. If key auth, ensure the key is correct. Try: ssh "+form.username+"@"+result.ip;
                else if(s.step.startsWith("WinRM")) {
                  hint="WinRM failed. On the Windows host run (PowerShell as Admin):\n  winrm quickconfig\n  winrm set winrm/config/service/auth @{Basic=\"true\"}\n  winrm set winrm/config/service @{AllowUnencrypted=\"true\"}\n  netsh advfirewall firewall add rule name=WinRM dir=in action=allow protocol=TCP localport=5985";
                }
                else if(s.step==="Metrics") hint="SSH connected but metrics collection failed — likely a missing command. Check if top/free/df are available.";
                return hint?<div key={i} style={{marginBottom:8}}>
                  <span style={{fontWeight:600,color:T.amber}}>{s.step}: </span>
                  <pre style={{display:"inline",fontFamily:"inherit",whiteSpace:"pre-wrap"}}>{hint}</pre>
                </div>:null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const VIEWS=[{id:"overview",icon:"📊",label:"Overview"},{id:"infra",icon:"🖧",label:"Infrastructure"},
             {id:"logs",icon:"📋",label:"Logs"},{id:"alerts",icon:"🔔",label:"Alerts"},
             {id:"patches",icon:"🔧",label:"Patches"},{id:"vmip",icon:"🔬",label:"VM IP Debug"},{id:"debug",icon:"🛠",label:"Debug"}];

export default function App() {
  const [view,setView]=useState("overview");
  const [hosts,setHosts]=useState([]);
  const [summary,setSummary]=useState({});
  const [history,setHistory]=useState([]);
  const [lastUpd,setLastUpd]=useState(null);

  const loadData=useCallback(async()=>{
    try {
      const [h,s,hist]=await Promise.all([api.get("/hosts"),api.get("/summary"),api.get("/metrics/history")]);
      setHosts(h.data);setSummary(s.data);setHistory(hist.data);
      setLastUpd(new Date().toLocaleTimeString());
    } catch(e){}
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <div style={{width:210,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"20px 18px 16px"}}>
            <div style={{color:"#f0f9ff",fontWeight:800,fontSize:15}}>InfraCommand</div>
            <div style={{color:"#5b8fad",fontSize:11,marginTop:2}}>Infrastructure Monitor</div>
          </div>
          <div style={{padding:"0 8px",flex:1}}>
            {VIEWS.map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 12px",
                borderRadius:7,border:"none",cursor:"pointer",fontFamily:"IBM Plex Sans",
                fontSize:12,fontWeight:view===v.id?700:400,
                background:view===v.id?"rgba(14,165,233,.18)":"transparent",
                color:view===v.id?"#7dd3fc":"#7a9db5",marginBottom:2,
                borderLeft:view===v.id?"3px solid #0ea5e9":"3px solid transparent",transition:"all .15s",
              }}><span>{v.icon}</span>{v.label}</button>
            ))}
          </div>
          <div style={{padding:"12px 18px",borderTop:"1px solid #1e3347",fontSize:10,color:"#3d6177"}}>
            <div>{hosts.length} hosts · {summary.total_vms||0} VMs</div>
            <div style={{color:"#2d7a4f"}}>{hosts.filter(h=>h.metrics?.source==="live").length} live</div>
            {lastUpd&&<div style={{marginTop:2}}>Loaded: {lastUpd}</div>}
          </div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"11px 22px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{VIEWS.find(v=>v.id===view)?.label}</div>
              <div style={{color:T.muted,fontSize:11}}>Data persisted in DB · use ↻ Refresh per host to update</div>
            </div>
            <button className="btn btn-refresh" onClick={loadData}>↻ Reload DB</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:view==="infra"?"14px":"22px"}}>
            {view==="overview" && <Overview hosts={hosts} summary={summary} history={history}/>}
            {view==="infra"    && <InfraView rawHosts={hosts} onGlobalReload={loadData}/>}
            {view==="logs"     && <Logs hosts={hosts}/>}
            {view==="alerts"   && <Alerts/>}
            {view==="patches"  && <Patches/>}
            {view==="vmip"     && <VMIPDebug hosts={hosts}/>}
            {view==="debug"    && <DebugConsole/>}
          </div>
        </div>
      </div>
    </>
  );
}
