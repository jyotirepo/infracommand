import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const API = (window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api");
const api = axios.create({ baseURL: API });

// ── Light professional theme ─────────────────────────────────────────────────
const T = {
  bg:       "#f0f4f8",
  card:     "#ffffff",
  sidebar:  "#1e2d3d",
  sideHov:  "#2a3f54",
  sideAct:  "#00b4d8",
  border:   "#dde3ea",
  blue:     "#0077b6",
  cyan:     "#00b4d8",
  green:    "#0a9e6e",
  amber:    "#d97706",
  red:      "#dc2626",
  text:     "#1a202c",
  sub:      "#4a5568",
  muted:    "#94a3b8",
  tblHead:  "#f7fafc",
  tblRow:   "#fafbfc",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; font-family: 'DM Sans', sans-serif; font-size: 14px; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: ${T.border}; }
  ::-webkit-scrollbar-thumb { background: ${T.muted}; border-radius: 4px; }
  code, .mono { font-family: 'DM Mono', monospace; }

  .btn { padding: 7px 16px; border-radius: 7px; border: none; cursor: pointer;
         font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600;
         transition: all .18s; display: inline-flex; align-items: center; gap: 6px; }
  .btn:hover { filter: brightness(0.93); transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn-primary { background: ${T.blue}; color: #fff; }
  .btn-danger  { background: ${T.red}; color: #fff; }
  .btn-ghost   { background: ${T.border}; color: ${T.sub}; }
  .btn-scan    { background: linear-gradient(135deg,#7c3aed,#4f46e5); color:#fff; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }

  .badge { padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing:.3px; display:inline-block; }
  .b-ok   { background:#d1fae5; color:#065f46; }
  .b-warn { background:#fef3c7; color:#92400e; }
  .b-crit { background:#fee2e2; color:#991b1b; }
  .b-info { background:#dbeafe; color:#1e40af; }
  .b-sim  { background:#ede9fe; color:#5b21b6; }
  .b-stop { background:#f1f5f9; color:#64748b; }
  .b-kvm  { background:#d1fae5; color:#065f46; }
  .b-hv   { background:#dbeafe; color:#1e40af; }

  .card { background:${T.card}; border:1px solid ${T.border}; border-radius:12px; padding:20px; }
  .shadow { box-shadow: 0 1px 4px rgba(0,0,0,.07), 0 4px 16px rgba(0,0,0,.05); }

  input, select, textarea {
    background: #f8fafc; border: 1.5px solid ${T.border}; color: ${T.text};
    padding: 8px 12px; border-radius: 8px; font-family: 'DM Sans',sans-serif;
    font-size: 13px; width: 100%; transition: border-color .2s; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${T.cyan}; background:#fff; }

  .modal-overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;
                   align-items:center;justify-content:center;z-index:999;backdrop-filter:blur(2px); }
  .modal { background:#fff;border-radius:16px;padding:28px;width:520px;
           max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2); }

  .tree-row { display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;
              cursor:pointer;transition:background .15s;user-select:none; }
  .tree-row:hover { background:#f0f4f8; }
  .tree-row.active { background:#e0f2fe; }

  table { width:100%;border-collapse:collapse;font-size:13px; }
  th { text-align:left;padding:10px 14px;background:${T.tblHead};color:${T.sub};
       font-weight:600;font-size:12px;letter-spacing:.3px;border-bottom:1.5px solid ${T.border}; }
  td { padding:10px 14px;border-bottom:1px solid #f0f4f8;vertical-align:middle; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#f8fbff; }

  .bar-bg { background:#e8edf2;border-radius:6px;height:7px;min-width:80px; }
  .bar-fill { height:7px;border-radius:6px;transition:width .5s; }

  .tab { padding:8px 18px;border-radius:8px;border:none;background:transparent;
         cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
         color:${T.sub};transition:all .15s; }
  .tab.active { background:${T.blue};color:#fff;font-weight:600; }
  .tab:hover:not(.active) { background:${T.border}; }

  .port-chip { display:inline-flex;align-items:center;gap:5px;padding:4px 10px;
               background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;
               font-size:12px;color:#166534;font-family:'DM Mono',monospace;margin:3px; }
  .port-chip.risky { background:#fef9c3;border-color:#fde68a;color:#854d0e; }

  .stat-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px; }
  .stat-box { background:${T.bg};border:1px solid ${T.border};border-radius:10px;padding:14px;text-align:center; }
  .stat-val { font-size:24px;font-weight:700;line-height:1.1; }
  .stat-lbl { font-size:11px;color:${T.muted};margin-top:4px;font-weight:500;letter-spacing:.3px; }

  .section-title { font-size:12px;font-weight:700;color:${T.muted};letter-spacing:.8px;
                   text-transform:uppercase;margin-bottom:12px; }
  .divider { border:none;border-top:1px solid ${T.border};margin:16px 0; }

  .status-dot { width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px; }
  .dot-green { background:#0a9e6e; }
  .dot-red   { background:#dc2626; }
  .dot-gray  { background:#94a3b8; }
  .dot-amber { background:#d97706; }

  .spinner { width:18px;height:18px;border:2px solid ${T.border};border-top-color:${T.blue};
             border-radius:50%;animation:spin .7s linear infinite;display:inline-block; }
  @keyframes spin { to { transform:rotate(360deg); } }

  .scan-progress { background:linear-gradient(90deg,${T.cyan},${T.blue});
                   height:3px;border-radius:2px;animation:progress 2s ease-in-out infinite; }
  @keyframes progress { 0%{width:0%} 50%{width:70%} 100%{width:100%} }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const Bar = ({ val, max=100 }) => {
  const pct = Math.min(100,(val||0)/max*100);
  const col = pct>85 ? T.red : pct>65 ? T.amber : T.green;
  return <div className="bar-bg"><div className="bar-fill" style={{width:`${pct}%`,background:col}}/></div>;
};

const Stat = ({ label, value, color, sub }) => (
  <div className="stat-box">
    <div className="stat-val" style={{color:color||T.blue}}>{value}</div>
    <div className="stat-lbl">{label}</div>
    {sub && <div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div>}
  </div>
);

const SrcBadge = ({ src }) =>
  src==="live" ? <span className="badge b-ok">● LIVE</span>
               : src==="stopped" ? <span className="badge b-stop">◼ STOPPED</span>
               : <span className="badge b-sim">◌ SIM</span>;

const StatusBadge = ({ status }) => {
  const s=(status||"").toLowerCase();
  const cls = s==="running"?"b-ok":s==="stopped"?"b-stop":s==="demo"?"b-sim":"b-info";
  const dot = s==="running"?"dot-green":s==="stopped"?"dot-gray":"dot-amber";
  return <span className={`badge ${cls}`}><span className={`status-dot ${dot}`}/>{status}</span>;
};

const SevBadge = ({ sev }) => {
  const cls={CRITICAL:"b-crit",HIGH:"b-warn",MEDIUM:"b-info",LOW:"b-stop"}[sev]||"b-stop";
  return <span className={`badge ${cls}`}>{sev}</span>;
};

const Card = ({ children, style, className="" }) => (
  <div className={`card shadow ${className}`} style={style}>{children}</div>
);

const formatBytes = (mb) => mb>=1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb} MB`;

// ── Add Host Modal ────────────────────────────────────────────────────────────
function AddHostModal({ onClose, onAdded }) {
  const [form,setForm] = useState({name:"",ip:"",os_type:"linux",auth_type:"password",
    username:"root",password:"",ssh_key:"",ssh_port:22,winrm_port:5985});
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const submit=async()=>{
    if(!form.name||!form.ip) return setMsg({type:"err",text:"Name and IP are required"});
    setLoading(true); setMsg(null);
    try {
      const res=await api.post("/hosts",{...form,ssh_port:Number(form.ssh_port)});
      setMsg({type:"ok",text:res.data.message});
      setTimeout(()=>{onAdded();onClose();},1500);
    } catch(e){ setMsg({type:"err",text:e.response?.data?.detail||"Failed to add host"}); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <h3 style={{fontSize:18,fontWeight:700}}>Add Host</h3>
            <p style={{color:T.muted,fontSize:13,marginTop:2}}>Connect a physical or virtual host</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[["Host Name *","name","text","prod-server-01"],["IP Address *","ip","text","192.168.1.100"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>OS Type</label>
            <select value={form.os_type} onChange={e=>set("os_type",e.target.value)}>
              <option value="linux">🐧 Linux (KVM)</option>
              <option value="windows">🪟 Windows (Hyper-V)</option>
            </select></div>
          <div><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>Auth Type</label>
            <select value={form.auth_type} onChange={e=>set("auth_type",e.target.value)}>
              <option value="password">Password</option><option value="key">SSH Key (PEM)</option>
            </select></div>
          <div><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>Username</label>
            <input value={form.username} onChange={e=>set("username",e.target.value)} placeholder="root"/></div>
          {form.os_type==="linux"
            ? <div><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>SSH Port</label>
                <input type="number" value={form.ssh_port} onChange={e=>set("ssh_port",e.target.value)}/></div>
            : <div><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>WinRM Port</label>
                <input type="number" value={form.winrm_port} onChange={e=>set("winrm_port",e.target.value)}/></div>}
          {form.auth_type==="password"
            ? <div style={{gridColumn:"1/-1"}}><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>Password</label>
                <input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
            : <div style={{gridColumn:"1/-1"}}><label style={{fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:5}}>SSH Private Key (PEM)</label>
                <textarea rows={5} value={form.ssh_key} onChange={e=>set("ssh_key",e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"/></div>}
        </div>

        {msg&&<div style={{marginTop:14,padding:"10px 14px",borderRadius:8,fontSize:13,
          background:msg.type==="ok"?"#d1fae5":"#fee2e2",color:msg.type==="ok"?"#065f46":"#991b1b"}}>{msg.text}</div>}

        <div style={{display:"flex",gap:10,marginTop:22,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading?<><span className="spinner"/>Connecting...</>:"Connect Host"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scan Result Panel ─────────────────────────────────────────────────────────
function ScanPanel({ result, onClose }) {
  if(!result) return null;
  const RISKY=[21,23,3389,5900,8080];
  const download=()=>{
    const txt=`InfraCommand Security Scan\nTarget: ${result.target} (${result.ip})\nScanned: ${result.scanned_at}\n\nOPEN PORTS (${result.summary?.open_ports||0})\n${result.open_ports?.map(p=>`  ${p.port}/tcp  ${p.service}  [${p.state}]`).join("\n")||"None found"}\n\nVULNERABILITIES\nTotal: ${result.summary?.total} | CRITICAL: ${result.summary?.critical} | HIGH: ${result.summary?.high}\n\n${result.vulns?.map(v=>`${v.id} [${v.severity}] CVSS:${v.cvss} | ${v.pkg}: ${v.desc}\n  ${v.url}`).join("\n\n")||""}`;
    const a=document.createElement("a");
    a.href="data:text/plain,"+encodeURIComponent(txt);
    a.download=`scan-${result.target}-${Date.now()}.txt`;a.click();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:680,maxWidth:"95vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <h3 style={{fontSize:17,fontWeight:700}}>Scan Results — {result.target}</h3>
            <div style={{color:T.muted,fontSize:12,marginTop:3}}>
              {result.ip} · {result.target_type?.toUpperCase()} · {new Date(result.scanned_at).toLocaleString()}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={download}>↓ Export</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>
          {[["Ports Open",result.summary?.open_ports,T.blue],
            ["Critical",result.summary?.critical,T.red],
            ["High",result.summary?.high,T.amber],
            ["Medium",result.summary?.medium,"#7c3aed"],
            ["Low",result.summary?.low,T.muted]].map(([l,v,c])=>(
            <Stat key={l} label={l} value={v} color={c}/>
          ))}
        </div>

        {/* Open Ports */}
        <div className="section-title">Open Ports</div>
        <div style={{marginBottom:18,minHeight:36}}>
          {result.open_ports?.length>0
            ? result.open_ports.map(p=>(
                <span key={p.port} className={`port-chip ${RISKY.includes(p.port)?"risky":""}`}>
                  :{p.port} {p.service}{RISKY.includes(p.port)?" ⚠":""}
                </span>))
            : <span style={{color:T.muted,fontSize:13}}>No open ports detected in scanned range</span>}
        </div>

        <hr className="divider"/>

        {/* CVEs */}
        <div className="section-title">Vulnerabilities ({result.vulns?.length})</div>
        <div style={{maxHeight:300,overflowY:"auto"}}>
          <table>
            <thead><tr><th>CVE ID</th><th>Severity</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
            <tbody>
              {result.vulns?.map(v=>(
                <tr key={v.id}>
                  <td><a href={v.url} target="_blank" rel="noreferrer" style={{color:T.blue,fontFamily:"DM Mono",fontSize:12}}>{v.id}</a></td>
                  <td><SevBadge sev={v.severity}/></td>
                  <td style={{fontFamily:"DM Mono",fontSize:13,fontWeight:600,
                    color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</td>
                  <td><code style={{background:T.bg,padding:"2px 6px",borderRadius:4,fontSize:12}}>{v.pkg}</code></td>
                  <td style={{color:T.sub,fontSize:12}}>{v.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── VM Detail Panel ───────────────────────────────────────────────────────────
function VMDetail({ vm, host, onScan, scanResult, scanning }) {
  const [patch,setPatch]=useState(null);
  const [loadingPatch,setLoadingPatch]=useState(false);
  const m=vm.metrics||{};

  useEffect(()=>{
    setLoadingPatch(true);
    api.get(`/hosts/${host.id}/vms/${vm.id}/patch`)
      .then(r=>setPatch(r.data)).catch(()=>setPatch(null))
      .finally(()=>setLoadingPatch(false));
  },[vm.id,host.id]);

  const patchColor=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,borderRadius:10,background:vm.hypervisor==="KVM"?"#d1fae5":"#dbeafe",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
              {vm.hypervisor==="KVM"?"🖥":"🪟"}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:17}}>{vm.name}</div>
              <div style={{color:T.muted,fontSize:12,marginTop:2}}>
                {vm.hypervisor} · {vm.ip} · {vm.vcpu} vCPU · {formatBytes(vm.ram_mb)} RAM
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <StatusBadge status={vm.status}/>
            <SrcBadge src={m.source}/>
            <button className="btn btn-scan btn-sm" onClick={onScan} disabled={scanning}>
              {scanning?<><span className="spinner"/>Scanning...</>:"🔍 Scan"}
            </button>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[["CPU Usage",m.cpu,"%",T.blue],["RAM Usage",m.ram,"%",T.amber],["Disk Usage",m.disk,"%",T.red]].map(([l,v,u,c])=>(
          <Card key={l}>
            <div style={{color:T.muted,fontSize:11,fontWeight:600,marginBottom:10,letterSpacing:.5}}>{l}</div>
            <div style={{fontSize:28,fontWeight:700,color:v>85?T.red:v>65?T.amber:c}}>{v}{u}</div>
            <div style={{marginTop:8}}><Bar val={v}/></div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Network */}
        <Card>
          <div className="section-title">Network I/O</div>
          <div style={{display:"flex",gap:24}}>
            <div><div style={{color:T.muted,fontSize:11}}>INBOUND</div>
              <div style={{fontSize:20,fontWeight:700,color:T.green}}>{m.net_in} MB</div></div>
            <div><div style={{color:T.muted,fontSize:11}}>OUTBOUND</div>
              <div style={{fontSize:20,fontWeight:700,color:T.amber}}>{m.net_out} MB</div></div>
          </div>
        </Card>

        {/* Patch status */}
        <Card>
          <div className="section-title">Patch Status</div>
          {loadingPatch
            ? <div style={{color:T.muted,fontSize:13}}>Loading patch info...</div>
            : patch
              ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:T.sub,fontSize:13}}>Status</span>
                    <span className="badge" style={{background:patchColor(patch.status)+"22",color:patchColor(patch.status)}}>{patch.status}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:T.sub,fontSize:13}}>OS</span>
                    <span style={{fontSize:13,fontWeight:600}}>{patch.os}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:T.sub,fontSize:13}}>Kernel</span>
                    <code style={{fontSize:12}}>{patch.kernel}</code>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:T.sub,fontSize:13}}>Updates</span>
                    <span style={{fontSize:13,fontWeight:700,color:patch.updates_available>0?T.red:T.green}}>
                      {patch.updates_available} pending</span>
                  </div>
                </div>
              : <div style={{color:T.muted,fontSize:13}}>VM unreachable for patch check</div>}
        </Card>
      </div>

      {/* Scan result inline */}
      {scanResult && (
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-title" style={{margin:0}}>Last Scan Results</div>
            <div style={{display:"flex",gap:8}}>
              {[["Ports",scanResult.summary?.open_ports,T.blue],
                ["Critical",scanResult.summary?.critical,T.red],
                ["High",scanResult.summary?.high,T.amber]].map(([l,v,c])=>(
                <span key={l} style={{fontSize:12,color:T.muted}}>{l}: <strong style={{color:c}}>{v}</strong></span>
              ))}
            </div>
          </div>
          {scanResult.open_ports?.map(p=>(
            <span key={p.port} className="port-chip">{p.service}:{p.port}</span>
          ))}
          <hr className="divider"/>
          <table>
            <thead><tr><th>CVE</th><th>Sev</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
            <tbody>{scanResult.vulns?.slice(0,5).map(v=>(
              <tr key={v.id}>
                <td><a href={v.url} target="_blank" rel="noreferrer" style={{color:T.blue,fontSize:12,fontFamily:"DM Mono"}}>{v.id}</a></td>
                <td><SevBadge sev={v.severity}/></td>
                <td style={{fontFamily:"DM Mono",fontWeight:600,color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</td>
                <td><code style={{fontSize:12}}>{v.pkg}</code></td>
                <td style={{color:T.sub,fontSize:12}}>{v.desc}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Host Detail Panel ─────────────────────────────────────────────────────────
function HostDetail({ host, onScan, scanResult, scanning }) {
  const m = host.metrics||{};
  const patch = host.patch||{};
  const patchColor=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,borderRadius:10,
              background:host.os_type==="linux"?"#d1fae5":"#dbeafe",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
              {host.os_type==="linux"?"🐧":"🪟"}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:17}}>{host.name}</div>
              <div style={{color:T.muted,fontSize:12,marginTop:2}}>
                {host.ip} · {host.os_type==="linux"?"Linux / KVM":"Windows / Hyper-V"} · {host.username}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <SrcBadge src={m.source}/>
            <button className="btn btn-scan" onClick={onScan} disabled={scanning}>
              {scanning?<><span className="spinner"/>Scanning...</>:"🔍 Vuln Scan"}
            </button>
          </div>
        </div>
      </Card>

      {scanning&&<div className="scan-progress"/>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {[["CPU",m.cpu,"%",T.blue],["RAM",m.ram,"%",T.amber],["Disk",m.disk,"%",T.red],["Load Avg",m.load,"",T.green]].map(([l,v,u,c])=>(
          <Card key={l}>
            <div style={{color:T.muted,fontSize:11,fontWeight:600,marginBottom:8,letterSpacing:.5}}>{l}</div>
            <div style={{fontSize:26,fontWeight:700,color:v>85?T.red:v>65?T.amber:c}}>{v}{u}</div>
            {u==="%"&&<div style={{marginTop:8}}><Bar val={v}/></div>}
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Patch */}
        <Card>
          <div className="section-title">Patch Status</div>
          {patch.status
            ? <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:T.sub}}>Status</span>
                  <span className="badge" style={{background:patchColor(patch.status)+"22",color:patchColor(patch.status)}}>{patch.status}</span>
                </div>
                {[["OS",patch.os],["Current Kernel",patch.kernel],["Latest Kernel",patch.latest_kernel],["Last Patched",patch.last_patch],["Updates Pending",patch.updates_available+" packages"]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:T.muted,fontSize:13}}>{l}</span>
                    <span style={{fontSize:13,fontWeight:500}}>{v}</span>
                  </div>
                ))}
              </div>
            : <div style={{color:T.muted}}>Patch info unavailable</div>}
        </Card>

        {/* Network + Uptime */}
        <Card>
          <div className="section-title">Network & System</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["Net Inbound",m.net_in+" MB",T.green],["Net Outbound",m.net_out+" MB",T.amber],["Uptime",m.uptime,T.blue]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:T.muted,fontSize:13}}>{l}</span>
                <span style={{fontSize:13,fontWeight:600,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Scan Results */}
      {scanResult&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-title" style={{margin:0}}>Security Scan — {new Date(scanResult.scanned_at).toLocaleString()}</div>
            <div style={{display:"flex",gap:12}}>
              {[["Ports Open",scanResult.summary?.open_ports,T.blue],
                ["Critical",scanResult.summary?.critical,T.red],
                ["High",scanResult.summary?.high,T.amber],
                ["Medium",scanResult.summary?.medium,"#7c3aed"]].map(([l,v,c])=>(
                <span key={l} style={{fontSize:12,color:T.muted}}>{l}: <strong style={{color:c,fontSize:14}}>{v}</strong></span>
              ))}
            </div>
          </div>

          <div className="section-title" style={{fontSize:11}}>Open Ports</div>
          <div style={{marginBottom:14}}>
            {scanResult.open_ports?.length>0
              ? scanResult.open_ports.map(p=>(
                  <span key={p.port} className={`port-chip ${[21,23,3389,5900].includes(p.port)?"risky":""}`}>
                    :{p.port} {p.service}
                  </span>))
              : <span style={{color:T.muted,fontSize:13}}>No open ports found</span>}
          </div>
          <hr className="divider"/>
          <div className="section-title" style={{fontSize:11}}>Vulnerabilities</div>
          <table>
            <thead><tr><th>CVE ID</th><th>Severity</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
            <tbody>{scanResult.vulns?.map(v=>(
              <tr key={v.id}>
                <td><a href={v.url} target="_blank" rel="noreferrer" style={{color:T.blue,fontFamily:"DM Mono",fontSize:12}}>{v.id}</a></td>
                <td><SevBadge sev={v.severity}/></td>
                <td style={{fontFamily:"DM Mono",fontWeight:700,color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</td>
                <td><code style={{background:T.bg,padding:"2px 6px",borderRadius:4,fontSize:12}}>{v.pkg}</code></td>
                <td style={{color:T.sub,fontSize:12}}>{v.desc}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Infrastructure Tree + Detail ──────────────────────────────────────────────
function InfraView({ rawHosts, onRefresh }) {
  const [hosts,setHosts]=useState([]);
  const [expanded,setExpanded]=useState({});
  const [selected,setSelected]=useState(null); // {type:"host"|"vm", hostId, vmId}
  const [loadingHost,setLoadingHost]=useState(null);
  const [hostDetails,setHostDetails]=useState({});
  const [scanning,setScanning]=useState(null);
  const [scanResults,setScanResults]=useState({});
  const [showAdd,setShowAdd]=useState(false);

  useEffect(()=>{ setHosts(rawHosts); },[rawHosts]);

  const loadHostDetail=async(hid)=>{
    if(hostDetails[hid]) return hostDetails[hid];
    setLoadingHost(hid);
    try {
      const r=await api.get(`/hosts/${hid}`);
      setHostDetails(d=>({...d,[hid]:r.data}));
      setLoadingHost(null);
      return r.data;
    } catch(e){ setLoadingHost(null); return null; }
  };

  const selectHost=async(hid)=>{
    setSelected({type:"host",hostId:hid});
    await loadHostDetail(hid);
    setExpanded(e=>({...e,[hid]:!e[hid]}));
  };

  const selectVM=(hid,vm)=>{
    setSelected({type:"vm",hostId:hid,vmId:vm.id,vm});
  };

  const doScan=async()=>{
    if(!selected) return;
    const key=selected.type==="host"?selected.hostId:selected.vmId;
    setScanning(key);
    try {
      let res;
      if(selected.type==="host"){
        res=await api.post(`/hosts/${selected.hostId}/scan`);
      } else {
        res=await api.post(`/hosts/${selected.hostId}/vms/${selected.vmId}/scan`);
      }
      setScanResults(r=>({...r,[key]:res.data}));
    } catch(e){}
    setScanning(null);
  };

  const deleteHost=async(hid,e)=>{
    e.stopPropagation();
    await api.delete(`/hosts/${hid}`).catch(()=>{});
    onRefresh();
    if(selected?.hostId===hid) setSelected(null);
  };

  const currentHost = selected ? hostDetails[selected.hostId] : null;
  const currentVM   = selected?.type==="vm" ? selected.vm : null;
  const scanKey     = selected ? (selected.type==="host"?selected.hostId:selected.vmId) : null;

  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16,height:"calc(100vh - 110px)"}}>
      {/* Tree Panel */}
      <Card style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:700,fontSize:14}}>Infrastructure</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"8px 8px"}}>
          {hosts.map(h=>{
            const detail=hostDetails[h.id];
            const vms=detail?.vms||[];
            const isExp=expanded[h.id];
            const isSelHost=selected?.type==="host"&&selected.hostId===h.id;
            return (
              <div key={h.id}>
                {/* Host row */}
                <div className={`tree-row ${isSelHost?"active":""}`} onClick={()=>selectHost(h.id)}
                  style={{justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                    <span style={{fontSize:16}}>{h.os_type==="linux"?"🐧":"🪟"}</span>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{h.name}</div>
                      <div style={{fontSize:11,color:T.muted}}>{h.ip}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                    {loadingHost===h.id&&<span className="spinner" style={{width:12,height:12}}/>}
                    <span style={{fontSize:10,color:T.muted}}>{isExp?"▾":"▸"}</span>
                    <button className="btn btn-ghost btn-sm" style={{padding:"2px 6px",fontSize:10}}
                      onClick={(e)=>deleteHost(h.id,e)}>✕</button>
                  </div>
                </div>

                {/* VM rows */}
                {isExp&&(
                  <div style={{marginLeft:16,borderLeft:`2px solid ${T.border}`,paddingLeft:8,marginBottom:4}}>
                    {vms.length===0&&<div style={{padding:"6px 8px",color:T.muted,fontSize:12}}>
                      {loadingHost===h.id?"Loading VMs...":"No VMs found"}
                    </div>}
                    {vms.map(vm=>{
                      const isSelVM=selected?.type==="vm"&&selected.vmId===vm.id;
                      return (
                        <div key={vm.id} className={`tree-row ${isSelVM?"active":""}`}
                          onClick={()=>selectVM(h.id,vm)} style={{padding:"6px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14}}>🖥</span>
                            <div>
                              <div style={{fontWeight:500,fontSize:12}}>{vm.name}</div>
                              <div style={{fontSize:10,color:T.muted,display:"flex",gap:6}}>
                                <span className={`status-dot ${vm.status==="running"?"dot-green":"dot-gray"}`}
                                  style={{width:6,height:6,marginTop:2}}/>
                                {vm.status} · {vm.hypervisor}
                              </div>
                            </div>
                          </div>
                          <span className={`badge ${vm.hypervisor==="KVM"?"b-kvm":"b-hv"}`}
                            style={{fontSize:9,padding:"1px 6px"}}>{vm.hypervisor}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {hosts.length===0&&<div style={{padding:24,color:T.muted,textAlign:"center",fontSize:13}}>
            No hosts added yet.<br/>Click + Add to connect a host.
          </div>}
        </div>
      </Card>

      {/* Detail Panel */}
      <div style={{overflowY:"auto"}}>
        {!selected&&(
          <Card style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center",color:T.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>🖧</div>
              <div style={{fontSize:16,fontWeight:600,color:T.sub}}>Select a host or VM</div>
              <div style={{fontSize:13,marginTop:6}}>Click any item in the tree to view details,<br/>metrics, patch status and run a vulnerability scan.</div>
            </div>
          </Card>
        )}
        {selected?.type==="host"&&currentHost&&(
          <HostDetail host={currentHost}
            onScan={doScan} scanResult={scanResults[selected.hostId]}
            scanning={scanning===selected.hostId}/>
        )}
        {selected?.type==="vm"&&currentVM&&currentHost&&(
          <VMDetail vm={currentVM} host={currentHost}
            onScan={doScan} scanResult={scanResults[selected.vmId]}
            scanning={scanning===selected.vmId}/>
        )}
        {selected&&!currentHost&&(
          <Card style={{display:"flex",alignItems:"center",justifyContent:"center",height:200}}>
            <span className="spinner"/><span style={{marginLeft:10,color:T.muted}}>Loading...</span>
          </Card>
        )}
      </div>

      {showAdd&&<AddHostModal onClose={()=>setShowAdd(false)} onAdded={onRefresh}/>}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ hosts, summary, history }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
        {[["Total Hosts",summary.hosts,T.blue],["Total VMs",summary.total_vms,T.cyan],
          ["Avg CPU",`${summary.avg_cpu}%`,summary.avg_cpu>80?T.red:T.green],
          ["Warnings",summary.warnings,summary.warnings>0?T.amber:T.green],
          ["Unpatched",summary.unpatched,summary.unpatched>0?T.red:T.green]].map(([l,v,c])=>(
          <Card key={l}><Stat label={l} value={v} color={c}/></Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <div className="section-title">CPU Usage — Last 24h</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history}>
              <defs><linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.blue} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={T.blue} stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="hour" tick={{fontSize:10,fill:T.muted}}/>
              <YAxis tick={{fontSize:10,fill:T.muted}}/>
              <Tooltip contentStyle={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}}/>
              <Area type="monotone" dataKey="cpu" stroke={T.blue} fill="url(#gcpu)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="section-title">RAM Usage — Last 24h</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history}>
              <defs><linearGradient id="gram" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.amber} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={T.amber} stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="hour" tick={{fontSize:10,fill:T.muted}}/>
              <YAxis tick={{fontSize:10,fill:T.muted}}/>
              <Tooltip contentStyle={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}}/>
              <Area type="monotone" dataKey="ram" stroke={T.amber} fill="url(#gram)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="section-title">All Hosts — Live Status</div>
        <table>
          <thead><tr><th>Host</th><th>IP</th><th>OS / Hypervisor</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Uptime</th><th>Source</th></tr></thead>
          <tbody>{hosts.map(h=>(
            <tr key={h.id}>
              <td style={{fontWeight:600}}>{h.os_type==="linux"?"🐧 ":"🪟 "}{h.name}</td>
              <td><code style={{fontSize:12}}>{h.ip}</code></td>
              <td><span className={`badge ${h.os_type==="linux"?"b-kvm":"b-hv"}`}>{h.os_type==="linux"?"KVM":"Hyper-V"}</span></td>
              <td><div style={{minWidth:90}}><div style={{fontSize:12,marginBottom:3,fontWeight:600}}>{h.metrics?.cpu}%</div><Bar val={h.metrics?.cpu}/></div></td>
              <td><div style={{minWidth:90}}><div style={{fontSize:12,marginBottom:3,fontWeight:600}}>{h.metrics?.ram}%</div><Bar val={h.metrics?.ram}/></div></td>
              <td><div style={{minWidth:90}}><div style={{fontSize:12,marginBottom:3,fontWeight:600}}>{h.metrics?.disk}%</div><Bar val={h.metrics?.disk}/></div></td>
              <td style={{color:T.muted,fontSize:12}}>{h.metrics?.uptime}</td>
              <td><SrcBadge src={h.metrics?.source}/></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────
function Logs({ hosts }) {
  const [logs,setLogs]=useState([]);
  const [hf,setHf]=useState("all");
  const [lf,setLf]=useState("all");
  const [loading,setLoading]=useState(false);
  const fetch=useCallback(async()=>{
    setLoading(true);
    try {
      const res=hf!=="all"
        ?await api.get(`/hosts/${hf}/logs`,{params:{limit:200}})
        :await api.get("/logs",{params:{limit:200,...(lf!=="all"?{level:lf}:{})}});
      setLogs(res.data);
    } catch(e){}
    setLoading(false);
  },[hf,lf]);
  useEffect(()=>{fetch();},[fetch]);
  const lvlCol=l=>l==="ERROR"?T.red:l==="WARN"?T.amber:T.muted;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <select value={hf} onChange={e=>setHf(e.target.value)} style={{width:180}}>
          <option value="all">All Hosts</option>
          {hosts.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={lf} onChange={e=>setLf(e.target.value)} style={{width:130}}>
          <option value="all">All Levels</option>
          <option value="ERROR">ERROR</option><option value="WARN">WARN</option><option value="INFO">INFO</option>
        </select>
        <button className="btn btn-ghost" onClick={fetch}>{loading?<span className="spinner"/>:"↻"} Refresh</button>
        <span style={{color:T.muted,fontSize:12}}>{logs.length} entries</span>
      </div>
      <Card style={{padding:0,maxHeight:"68vh",overflowY:"auto"}}>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:14,padding:"8px 16px",
            borderBottom:`1px solid ${T.border}`,fontSize:12,
            background:i%2===0?T.card:T.tblRow}}>
            <span style={{color:T.muted,minWidth:72,fontFamily:"DM Mono"}}>{l.ts?.slice(11,19)}</span>
            <span style={{minWidth:48,fontWeight:700,color:lvlCol(l.level)}}>{l.level}</span>
            <span style={{minWidth:110,color:T.blue,fontWeight:500}}>{l.host}</span>
            <span style={{flex:1,color:T.sub}}>{l.msg}</span>
            <SrcBadge src={l.source}/>
          </div>
        ))}
        {logs.length===0&&<div style={{padding:40,textAlign:"center",color:T.muted}}>No logs found</div>}
      </Card>
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function Alerts() {
  const [alerts,setAlerts]=useState([]);
  useEffect(()=>{api.get("/alerts").then(r=>setAlerts(r.data)).catch(()=>{});},[]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <div style={{fontWeight:700,fontSize:16}}>Active Alerts <span style={{color:T.muted,fontSize:13,fontWeight:400}}>({alerts.length})</span></div>
        <button className="btn btn-ghost" onClick={()=>api.get("/alerts").then(r=>setAlerts(r.data))}>↻ Refresh</button>
      </div>
      {alerts.length===0&&<Card><div style={{color:T.green,textAlign:"center",padding:40,fontSize:15}}>✓ No active alerts — all systems nominal</div></Card>}
      {alerts.map(a=>(
        <Card key={a.id} style={{borderLeft:`4px solid ${a.severity==="critical"?T.red:T.amber}`,padding:"14px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{a.severity==="critical"?"🚨":"⚠️"}</span>
              <div>
                <span className={`badge ${a.severity==="critical"?"b-crit":"b-warn"}`}>{a.type}</span>
                <span style={{marginLeft:10,fontWeight:500}}>{a.msg}</span>
              </div>
            </div>
            <span style={{color:T.muted,fontSize:12}}>{a.host}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Patches ───────────────────────────────────────────────────────────────────
function Patches() {
  const [patches,setPatches]=useState([]);
  useEffect(()=>{api.get("/patches").then(r=>setPatches(r.data)).catch(()=>{});},[]);
  const pc=s=>s==="UP TO DATE"?T.green:s==="CRITICAL UPDATE"?T.red:T.amber;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontWeight:700,fontSize:16}}>Patch Status</div>
      <table style={{background:T.card,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`}}>
        <thead><tr><th>Host</th><th>OS</th><th>Current Kernel</th><th>Latest Kernel</th><th>Updates</th><th>Last Patched</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>{patches.map((p,i)=>(
          <tr key={i}>
            <td style={{fontWeight:600}}>{p.host}</td>
            <td style={{fontSize:12,color:T.sub}}>{p.os}</td>
            <td><code style={{fontSize:11}}>{p.kernel}</code></td>
            <td><code style={{fontSize:11,color:p.latest_kernel!==p.kernel?T.amber:T.green}}>{p.latest_kernel||"N/A"}</code></td>
            <td><span style={{fontWeight:700,color:p.updates_available>0?T.red:T.green}}>{p.updates_available}</span></td>
            <td style={{fontSize:12,color:T.muted}}>{p.last_patch}</td>
            <td><span className="badge" style={{background:pc(p.status)+"22",color:pc(p.status)}}>{p.status}</span></td>
            <td><SrcBadge src={p.source}/></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const VIEWS=[
  {id:"overview",label:"Overview",icon:"📊"},
  {id:"infra",label:"Infrastructure",icon:"🖧"},
  {id:"logs",label:"Logs",icon:"📋"},
  {id:"alerts",label:"Alerts",icon:"🔔"},
  {id:"patches",label:"Patches",icon:"🔧"},
];

export default function App() {
  const [view,setView]=useState("overview");
  const [hosts,setHosts]=useState([]);
  const [summary,setSummary]=useState({});
  const [history,setHistory]=useState([]);

  const fetchAll=useCallback(async()=>{
    try {
      const [h,s,hist]=await Promise.all([api.get("/hosts"),api.get("/summary"),api.get("/metrics/history")]);
      setHosts(h.data); setSummary(s.data); setHistory(hist.data);
    } catch(e){}
  },[]);

  useEffect(()=>{ fetchAll(); const t=setInterval(fetchAll,30000); return()=>clearInterval(t); },[fetchAll]);

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:220,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"22px 20px 18px"}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:17,letterSpacing:.5}}>InfraCommand</div>
            <div style={{color:"#7fa8c9",fontSize:11,marginTop:3}}>Infrastructure Monitor</div>
          </div>
          <div style={{padding:"0 10px",flex:1}}>
            {VIEWS.map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"10px 12px",borderRadius:8,border:"none",cursor:"pointer",
                fontFamily:"DM Sans",fontSize:13,fontWeight:view===v.id?600:400,
                background:view===v.id?"rgba(0,180,216,.2)":"transparent",
                color:view===v.id?"#00d4f0":"#94b8cc",
                marginBottom:2,transition:"all .15s",
                borderLeft:view===v.id?"3px solid #00b4d8":"3px solid transparent",
              }}>
                <span>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>
          <div style={{padding:"14px 20px",borderTop:"1px solid #2a3f54",fontSize:11,color:"#4a6a85"}}>
            <div>{hosts.length} hosts · {summary.total_vms||0} VMs</div>
            <div style={{marginTop:3}}>{hosts.filter(h=>h.metrics?.source==="live").length} live connections</div>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Topbar */}
          <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,
            padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:17}}>{VIEWS.find(v=>v.id===view)?.label}</div>
              <div style={{color:T.muted,fontSize:12}}>Last updated: {new Date().toLocaleTimeString()}</div>
            </div>
            <button className="btn btn-ghost" onClick={fetchAll}>↻ Refresh</button>
          </div>

          {/* Content */}
          <div style={{flex:1,overflowY:"auto",padding:view==="infra"?"16px":"24px"}}>
            {view==="overview"  && <Overview hosts={hosts} summary={summary} history={history}/>}
            {view==="infra"     && <InfraView rawHosts={hosts} onRefresh={fetchAll}/>}
            {view==="logs"      && <Logs hosts={hosts}/>}
            {view==="alerts"    && <Alerts/>}
            {view==="patches"   && <Patches/>}
          </div>
        </div>
      </div>
    </>
  );
}
