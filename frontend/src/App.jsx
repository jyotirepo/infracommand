import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as api from './api/client';

// ── Atoms ──────────────────────────────────────────────────────────────────────
const Dot = ({ s }) => {
  const c = { online:'var(--green)', warning:'var(--yellow)', critical:'var(--red)', offline:'var(--text3)', unknown:'var(--text3)' }[s]||'var(--text3)';
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}`, flexShrink:0, animation:s==='warning'||s==='critical'?'blink 1.5s ease-in-out infinite':undefined }}/>;
};

const MiniBar = ({ pct, w=70, c=85 }) => {
  const v = parseFloat(pct)||0;
  const col = v>=c?'var(--red)':v>=w?'var(--yellow)':'var(--green)';
  return (
    <div style={{ height:3, background:'var(--border)', borderRadius:2, overflow:'hidden', margin:'5px 0' }}>
      <div style={{ height:'100%', width:`${Math.min(100,v)}%`, background:col, boxShadow:`0 0 6px ${col}`, transition:'width .9s ease' }}/>
    </div>
  );
};

const SevTag = ({ sev }) => {
  const m = { CRITICAL:['var(--red)','rgba(255,69,105,.12)'], HIGH:['var(--orange)','rgba(255,145,0,.12)'], MEDIUM:['var(--yellow)','rgba(255,215,64,.12)'], LOW:['var(--accent)','rgba(0,212,255,.1)'] };
  const [col, bg] = m[sev]||['var(--text3)','transparent'];
  return <span style={{ fontSize:9, fontWeight:700, letterSpacing:'1px', padding:'2px 7px', color:col, background:bg, border:`1px solid ${col}` }}>{sev}</span>;
};

const Spin = ({ sz=14 }) => <span style={{ display:'inline-block', width:sz, height:sz, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>;

const Card = ({ children, style={} }) => (
  <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', padding:18, ...style }}>{children}</div>
);

const SecTitle = ({ children }) => (
  <div style={{ display:'flex', alignItems:'center', gap:10, fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:18 }}>
    <span style={{ width:3, height:16, background:'var(--accent)', display:'block', boxShadow:'0 0 8px var(--accent)', flexShrink:0 }}/>
    {children}
  </div>
);

const TH = ({ ch }) => <th style={{ padding:'9px 14px', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:'var(--text3)', fontWeight:400, textAlign:'left', borderBottom:'1px solid var(--border)', background:'var(--bg3)', whiteSpace:'nowrap' }}>{ch}</th>;
const TD = ({ children, style={} }) => <td style={{ padding:'11px 14px', fontSize:11, borderBottom:'1px solid var(--border)', ...style }}>{children}</td>;

const Btn = ({ children, onClick, variant='ghost', disabled=false, sx={} }) => {
  const base = { padding:'7px 16px', border:'1px solid var(--border2)', background:'transparent', color:'var(--text2)', fontFamily:'inherit', fontSize:11, cursor:disabled?'not-allowed':'pointer', letterSpacing:'1px', textTransform:'uppercase', opacity:disabled?.5:1, ...sx };
  if (variant==='primary') Object.assign(base, { background:'var(--accent)', border:'1px solid var(--accent)', color:'var(--bg)', fontWeight:700 });
  if (variant==='danger')  Object.assign(base, { border:'1px solid var(--red)', color:'var(--red)' });
  return <button onClick={disabled?undefined:onClick} style={base}>{children}</button>;
};

const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange} style={{ background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'7px 12px', fontFamily:'inherit', fontSize:11 }}>
    {children}
  </select>
);

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ hosts, sel, onSel, onNav }) {
  const [open, setOpen] = useState({});
  return (
    <aside style={{ width:264, minWidth:264, borderRight:'1px solid var(--border)', background:'var(--bg2)', overflowY:'auto', padding:'16px 12px' }}>
      <div style={{ fontSize:9, letterSpacing:'3px', textTransform:'uppercase', color:'var(--text3)', marginBottom:12, paddingLeft:4 }}>HOSTS & VMs</div>
      {hosts.map(h => (
        <div key={h.id} style={{ marginBottom:8, border:`1px solid ${sel===h.id?'var(--accent)':'var(--border)'}`, background:'var(--bg3)', boxShadow:sel===h.id?'0 0 12px rgba(0,212,255,.12)':undefined }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer' }}
            onClick={() => { onSel(h.id); onNav('resources'); setOpen(o => ({ ...o, [h.id]: !o[h.id] })); }}>
            <Dot s={h.status}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.name}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{h.ip} · {h.vms?.length||0} VMs</div>
            </div>
            <span style={{ fontSize:10, color:'var(--text3)', transition:'transform .2s', transform:open[h.id]?'rotate(180deg)':undefined }}>▼</span>
          </div>
          {open[h.id] && (
            <div style={{ borderTop:'1px solid var(--border)' }}>
              {(h.vms||[]).map(vm => (
                <div key={vm.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px 6px 28px' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:vm.status==='running'?'var(--green)':'var(--red)', display:'inline-block', flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:11, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vm.name}</span>
                  <span style={{ fontSize:9, color:'var(--text3)', background:'var(--border)', padding:'1px 5px' }}>{vm.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}

// ── View: Overview ─────────────────────────────────────────────────────────────
function Overview({ hosts, summary, history }) {
  return (
    <div className="fade-up">
      <SecTitle>Infrastructure Overview</SecTitle>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Hosts',  val:summary.hosts||0,       col:'var(--accent)'  },
          { label:'Total VMs',    val:summary.total_vms||0,   col:'var(--accent)'  },
          { label:'Running VMs',  val:summary.running_vms||0, col:'var(--green)'   },
          { label:'Avg CPU',      val:`${summary.avg_cpu||0}%`, col:parseFloat(summary.avg_cpu)>80?'var(--red)':'var(--yellow)' },
          { label:'Need Patches', val:summary.unpatched||0,   col:'var(--yellow)'  },
        ].map(({ label, val, col }) => (
          <Card key={label} style={{ borderTop:`2px solid ${col}` }}>
            <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>{label}</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:30, fontWeight:800, color:col }}>{val}</div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <Card>
          <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>CPU USAGE — 24H</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d"/>
              <XAxis dataKey="ts" tick={{ fill:'#4a6685', fontSize:9 }} interval={5}/>
              <YAxis tick={{ fill:'#4a6685', fontSize:9 }} domain={[0,100]}/>
              <Tooltip contentStyle={{ background:'#0c1219', border:'1px solid #1e2d3d', color:'#e2eaf4', fontSize:11 }}/>
              <Area type="monotone" dataKey="prod01_cpu" stroke="#00d4ff" fill="url(#g1)" strokeWidth={1.5} dot={false} name="prod-host-01"/>
              <Area type="monotone" dataKey="prod02_cpu" stroke="#ff4569" fill="none"      strokeWidth={1.5} dot={false} name="prod-host-02"/>
              <Area type="monotone" dataKey="dev01_cpu"  stroke="#00e676" fill="none"      strokeWidth={1.5} dot={false} name="dev-host-01"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>RAM USAGE — 24H</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d"/>
              <XAxis dataKey="ts" tick={{ fill:'#4a6685', fontSize:9 }} interval={5}/>
              <YAxis tick={{ fill:'#4a6685', fontSize:9 }} domain={[0,100]}/>
              <Tooltip contentStyle={{ background:'#0c1219', border:'1px solid #1e2d3d', color:'#e2eaf4', fontSize:11 }}/>
              <Line type="monotone" dataKey="prod01_ram" stroke="#9c6bff" strokeWidth={1.5} dot={false} name="prod-host-01"/>
              <Line type="monotone" dataKey="prod02_ram" stroke="#ff9100" strokeWidth={1.5} dot={false} name="prod-host-02"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Host table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{['Host','IP','Status','CPU','RAM','Disk','Uptime','VMs'].map(h => <TH key={h} ch={h}/>)}</tr></thead>
          <tbody>
            {hosts.map((h, i) => {
              const m = h.metrics||{};
              return (
                <tr key={h.id} style={{ background:i%2?'transparent':'rgba(0,0,0,.08)' }}>
                  <TD style={{ fontWeight:700 }}>{h.name}</TD>
                  <TD style={{ color:'var(--text3)' }}>{h.ip}</TD>
                  <TD><div style={{ display:'flex', alignItems:'center', gap:6 }}><Dot s={h.status}/><span>{h.status}</span></div></TD>
                  <TD style={{ minWidth:110 }}>
                    <span style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:800, color:m.cpu>=85?'var(--red)':m.cpu>=70?'var(--yellow)':'var(--green)' }}>{(m.cpu||0).toFixed(0)}%</span>
                    <MiniBar pct={m.cpu||0}/>
                  </TD>
                  <TD style={{ minWidth:110 }}>
                    <span style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:800, color:m.ram>=85?'var(--red)':m.ram>=70?'var(--yellow)':'var(--green)' }}>{(m.ram||0).toFixed(0)}%</span>
                    <MiniBar pct={m.ram||0}/>
                  </TD>
                  <TD style={{ minWidth:110 }}>
                    <span style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:800, color:m.disk>=85?'var(--red)':m.disk>=75?'var(--yellow)':'var(--green)' }}>{(m.disk||0).toFixed(0)}%</span>
                    <MiniBar pct={m.disk||0} w={75} c={90}/>
                  </TD>
                  <TD style={{ color:'var(--text3)' }}>{m.uptime||'—'}</TD>
                  <TD style={{ color:'var(--accent)', fontWeight:700 }}>
                    {(h.vms||[]).filter(v=>v.status==='running').length}/{(h.vms||[]).length}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── View: Resources ────────────────────────────────────────────────────────────
function Resources({ hosts, selId, onSel }) {
  const h = hosts.find(x => x.id===selId)||hosts[0]||{};
  const m = h.metrics||{};
  return (
    <div className="fade-up">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <SecTitle>Resources — {h.name}</SecTitle>
        <Select value={selId} onChange={e=>onSel(e.target.value)}>
          {hosts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:16 }}>
        {[
          { label:'CPU Usage',  val:m.cpu||0,  sub:`Load avg: ${m.load||0}` },
          { label:'RAM Usage',  val:m.ram||0,  sub:'Memory utilisation'      },
          { label:'Disk Usage', val:m.disk||0, sub:'Storage used', w:75, c:90 },
        ].map(({ label, val, sub, w=70, c=85 }) => (
          <Card key={label} style={{ borderTop:`2px solid ${val>=c?'var(--red)':val>=w?'var(--yellow)':'var(--green)'}` }}>
            <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>{label}</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:34, fontWeight:800, color:val>=c?'var(--red)':val>=w?'var(--yellow)':'var(--green)' }}>{val.toFixed(0)}%</div>
            <MiniBar pct={val} w={w} c={c}/>
            <div style={{ fontSize:10, color:'var(--text3)' }}>{sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:16 }}>
        <Card>
          <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>NET IN</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'var(--accent)' }}>{m.net_in||0} <span style={{ fontSize:12, color:'var(--text3)' }}>MB/s</span></div>
        </Card>
        <Card>
          <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>NET OUT</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'var(--purple)' }}>{m.net_out||0} <span style={{ fontSize:12, color:'var(--text3)' }}>MB/s</span></div>
        </Card>
        <Card>
          <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>UPTIME</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'var(--green)' }}>{m.uptime||'—'}</div>
        </Card>
      </div>

      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>VMs ON {(h.name||'').toUpperCase()}</div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{['Name','Type','Status','IP','vCPU','RAM','Disk','OS'].map(x => <TH key={x} ch={x}/>)}</tr></thead>
          <tbody>
            {(h.vms||[]).map((vm, i) => (
              <tr key={vm.id} style={{ background:i%2?'transparent':'rgba(0,0,0,.08)' }}>
                <TD style={{ fontWeight:700 }}>{vm.name}</TD>
                <TD style={{ color:'var(--text3)' }}>{vm.type}</TD>
                <TD><div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:vm.status==='running'?'var(--green)':'var(--red)', display:'inline-block' }}/>
                  <span>{vm.status}</span>
                </div></TD>
                <TD style={{ color:'var(--text3)' }}>{vm.ip}</TD>
                <TD style={{ color:'var(--accent)' }}>{vm.vcpu}</TD>
                <TD>{vm.ram}</TD>
                <TD>{vm.disk}</TD>
                <TD style={{ color:'var(--text3)' }}>{vm.os}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── View: Logs ─────────────────────────────────────────────────────────────────
function Logs({ hosts }) {
  const [logs, setLogs]     = useState([]);
  const [host, setHost]     = useState('all');
  const [level, setLevel]   = useState('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = host==='all'
        ? await api.getLogs({ level, limit:100 })
        : await api.getHostLogs(host, { level, limit:80 });
      setLogs(r.data);
    } catch(e) {} finally { setLoading(false); }
  }, [host, level]);

  useEffect(() => { load(); }, [load]);

  const LC = { INFO:'var(--accent)', WARN:'var(--yellow)', ERROR:'var(--red)', OK:'var(--green)' };

  return (
    <div className="fade-up">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <SecTitle>System Logs</SecTitle>
        <div style={{ display:'flex', gap:8 }}>
          <Select value={host} onChange={e=>setHost(e.target.value)}>
            <option value="all">All Hosts</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </Select>
          <Select value={level} onChange={e=>setLevel(e.target.value)}>
            <option value="all">All Levels</option>
            {['ERROR','WARN','INFO','OK'].map(l => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Btn onClick={load}>{loading ? <Spin/> : '↻ Refresh'}</Btn>
        </div>
      </div>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', maxHeight:520, overflowY:'auto' }}>
        {logs.map(l => (
          <div key={l.id} style={{ display:'flex', gap:14, padding:'5px 14px', borderBottom:'1px solid rgba(30,45,61,.4)' }}>
            <span style={{ color:'var(--text3)', fontSize:10, flexShrink:0, minWidth:155 }}>{new Date(l.ts).toLocaleString()}</span>
            <span style={{ fontSize:10, fontWeight:700, width:46, flexShrink:0, color:LC[l.level]||'var(--text3)' }}>{l.level}</span>
            <span style={{ fontSize:11, color:'var(--accent)', flexShrink:0, minWidth:130 }}>{l.host}</span>
            <span style={{ fontSize:11, color:'var(--text2)', flex:1 }}>{l.msg}</span>
          </div>
        ))}
        {!logs.length && <div style={{ padding:28, textAlign:'center', color:'var(--text3)', fontSize:12 }}>No logs found.</div>}
      </div>
    </div>
  );
}

// ── View: Patches ──────────────────────────────────────────────────────────────
function Patches() {
  const [patches, setPatches] = useState([]);
  useEffect(() => { api.getPatches().then(r => setPatches(r.data)).catch(()=>{}); }, []);
  const CFG = {
    uptodate:{ col:'var(--green)',  bg:'rgba(0,230,118,.08)',  label:'UP TO DATE'        },
    outdated: { col:'var(--yellow)', bg:'rgba(255,215,64,.08)', label:'UPDATE AVAILABLE'  },
    critical: { col:'var(--red)',    bg:'rgba(255,69,105,.08)', label:'CRITICAL UPDATE'   },
  };
  return (
    <div className="fade-up">
      <SecTitle>OS Versions & Patch Status</SecTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {patches.map(p => {
          const { col, bg, label } = CFG[p.status]||CFG.uptodate;
          return (
            <Card key={p.host_id} style={{ borderTop:`2px solid ${col}` }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8 }}>{p.host_name}  ·  {p.ip}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>{p.os}</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Kernel: {p.kernel}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:14 }}>
                Last patched: <strong style={{ color:'var(--text)' }}>{p.last_patch}</strong> · v{p.current_ver}
              </div>
              <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>LATEST AVAILABLE</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>v{p.latest_ver}</div>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'1px', padding:'3px 10px', color:col, background:bg, border:`1px solid ${col}` }}>{label}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── View: Alerts ───────────────────────────────────────────────────────────────
function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  const load = () => api.getAlerts().then(r => setAlerts(r.data)).catch(()=>{});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const SEV = {
    CRITICAL:{ bdr:'rgba(255,69,105,.4)',  bg:'rgba(255,69,105,.05)',  col:'var(--red)'    },
    WARNING: { bdr:'rgba(255,215,64,.4)',  bg:'rgba(255,215,64,.05)',  col:'var(--yellow)' },
    INFO:    { bdr:'rgba(0,212,255,.3)',   bg:'rgba(0,212,255,.04)',   col:'var(--accent)' },
  };

  return (
    <div className="fade-up">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <SecTitle>Active Alerts ({visible.length})</SecTitle>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={load}>↻ Refresh</Btn>
          <Btn variant="danger" onClick={() => setDismissed(new Set(alerts.map(a=>a.id)))}>Dismiss All</Btn>
        </div>
      </div>
      {!visible.length && (
        <Card style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:32, marginBottom:12, color:'var(--green)' }}>✓</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color:'var(--green)' }}>No Active Alerts</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>All systems operating normally</div>
        </Card>
      )}
      {visible.map(a => {
        const s = SEV[a.sev]||SEV.INFO;
        return (
          <div key={a.id} style={{ border:`1px solid ${s.bdr}`, borderLeft:`3px solid ${s.col}`, background:s.bg, padding:'12px 16px', marginBottom:10, display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:s.col, marginBottom:3 }}>{a.title}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{a.msg}</div>
            </div>
            <span style={{ fontSize:10, color:'var(--text3)', marginTop:2, flexShrink:0 }}>{a.host}</span>
            <button onClick={() => setDismissed(d => new Set([...d, a.id]))} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:16, padding:'0 4px', lineHeight:1 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── View: Vuln Scan ────────────────────────────────────────────────────────────
function VulnScan({ hosts }) {
  const [target, setTarget]   = useState(hosts[0]?.id||'');
  const [phase, setPhase]     = useState('idle');  // idle | scanning | done | error
  const [pct, setPct]         = useState(0);
  const [step, setStep]       = useState('');
  const [result, setResult]   = useState(null);

  const STEPS = [
    'Initialising scan engine…','Resolving target host…',
    'Checking OS packages against CVE DB…','Scanning kernel vulnerabilities…',
    'Auditing OpenSSL / crypto libraries…','Checking SSH configuration…',
    'Scanning container runtime…','Auditing open ports…',
    'Checking sudo & privilege escalation paths…',
    'Cross-referencing NIST NVD…','Checking CISA KEV list…',
    'Compiling full report…',
  ];

  const run = async () => {
    setPhase('scanning'); setResult(null); setPct(0);
    let i = 0;
    const iv = setInterval(() => {
      setStep(STEPS[Math.min(i, STEPS.length-1)]);
      setPct(Math.round(Math.min(95, (i+1)/STEPS.length*100)));
      i++;
    }, 400);
    try {
      const { data } = await api.triggerScan(target);
      clearInterval(iv); setPct(100); setStep('Scan complete ✔');
      setTimeout(() => { setPhase('done'); setResult(data); }, 500);
    } catch(e) {
      clearInterval(iv);
      setPhase('error'); setStep('Scan failed — check server connectivity');
    }
  };

  const download = () => {
    if (!result) return;
    const lines = [
      'INFRACOMMAND VULNERABILITY REPORT',
      '====================================',
      `Host:    ${result.host_name} (${result.host_ip})`,
      `Scan ID: ${result.scan_id}`,
      `Date:    ${new Date(result.ts).toLocaleString()}`,
      '',
      'SUMMARY',
      `  Critical : ${result.summary.critical}`,
      `  High     : ${result.summary.high}`,
      `  Medium   : ${result.summary.medium}`,
      `  Low      : ${result.summary.low}`,
      `  Total    : ${result.summary.total}`,
      '',
      'VULNERABILITIES',
      ...result.vulns.map(v => `\nCVE: ${v.cve}\nSeverity: ${v.sev} (CVSS ${v.cvss})\nPackage:  ${v.pkg}\nDesc:     ${v.desc}\nFix:      ${v.fix}\nRef:      ${v.link}`)
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type:'text/plain' }));
    a.download = `vuln-${result.host_name}-${Date.now()}.txt`;
    a.click();
  };

  const SC = { CRITICAL:'var(--red)', HIGH:'var(--orange)', MEDIUM:'var(--yellow)', LOW:'var(--accent)' };

  return (
    <div className="fade-up">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <SecTitle>On-Demand Vulnerability Scanner</SecTitle>
        <Select value={target} onChange={e => setTarget(e.target.value)}>
          {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
        </Select>
      </div>

      {/* ── Idle ── */}
      {phase==='idle' && (
        <Card style={{ textAlign:'center', padding:56, border:'1px dashed var(--border2)' }}>
          <div style={{ fontSize:52, marginBottom:16, opacity:.65 }}>🛡️</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, marginBottom:10 }}>On-Demand Vulnerability Scan</div>
          <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.9, marginBottom:28 }}>
            Scan is triggered only when you click below.<br/>
            Checks OS packages, kernel CVEs, open ports & misconfigs.<br/>
            Full CVE report with NVD links generated on completion.
          </div>
          <button onClick={run} style={{ padding:'12px 36px', background:'transparent', border:'1.5px solid var(--accent)', color:'var(--accent)', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'2px', textTransform:'uppercase', boxShadow:'0 0 20px rgba(0,212,255,.25)' }}>
            ⬡ &nbsp;INITIATE SCAN
          </button>
        </Card>
      )}

      {/* ── Scanning ── */}
      {phase==='scanning' && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
            <Spin sz={16}/>
            <span style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:'var(--accent)' }}>
              SCANNING — {hosts.find(h=>h.id===target)?.name}
            </span>
            <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>{pct}%</span>
          </div>
          <div style={{ height:4, background:'var(--border)', overflow:'hidden', marginBottom:14 }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', boxShadow:'0 0 12px var(--accent)', transition:'width .4s ease' }}/>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', minHeight:20 }}>{step}</div>
        </Card>
      )}

      {/* ── Error ── */}
      {phase==='error' && (
        <Card style={{ borderLeft:'3px solid var(--red)' }}>
          <div style={{ color:'var(--red)', fontWeight:700, marginBottom:8 }}>Scan Failed</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>{step}</div>
          <Btn onClick={() => setPhase('idle')}>Try Again</Btn>
        </Card>
      )}

      {/* ── Results ── */}
      {phase==='done' && result && (
        <div className="fade-up">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700 }}>
              Report — <span style={{ color:'var(--accent)' }}>{result.host_name}</span>
              <span style={{ fontSize:11, color:'var(--text3)', marginLeft:10 }}>{new Date(result.ts).toLocaleString()}</span>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <Btn onClick={download}>⬇ Download .txt</Btn>
              <Btn variant="primary" onClick={() => setPhase('idle')}>↻ New Scan</Btn>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Critical', val:result.summary.critical, col:'var(--red)'    },
              { label:'High',     val:result.summary.high,     col:'var(--orange)' },
              { label:'Medium',   val:result.summary.medium,   col:'var(--yellow)' },
              { label:'Low',      val:result.summary.low,      col:'var(--accent)' },
            ].map(({ label, val, col }) => (
              <Card key={label} style={{ textAlign:'center', borderTop:`2px solid ${col}` }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:32, fontWeight:800, color:col }}>{val}</div>
                <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', marginTop:4 }}>{label}</div>
              </Card>
            ))}
          </div>

          <Card style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['CVE ID','Severity','Package','Description','CVSS','Fix / Remediation'].map(h => <TH key={h} ch={h}/>)}</tr></thead>
              <tbody>
                {result.vulns.map((v, i) => (
                  <tr key={v.id} style={{ background:i%2?'transparent':'rgba(0,0,0,.08)' }}>
                    <TD><a href={v.link} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'none' }}>{v.cve}</a></TD>
                    <TD><SevTag sev={v.sev}/></TD>
                    <TD style={{ color:'var(--text2)', maxWidth:160 }}>{v.pkg}</TD>
                    <TD style={{ color:'var(--text3)', fontSize:10, maxWidth:220 }}>{v.desc}</TD>
                    <TD style={{ color:SC[v.sev], fontWeight:700 }}>{v.cvss}</TD>
                    <TD style={{ color:'var(--green)', fontSize:10 }}>{v.fix}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]       = useState('overview');
  const [hosts, setHosts]     = useState([]);
  const [summary, setSummary] = useState({});
  const [history, setHistory] = useState([]);
  const [selHost, setSelHost] = useState('');
  const [loading, setLoading] = useState(true);
  const [clock, setClock]     = useState('');

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-US',{hour12:false})), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [hR, sR, hiR] = await Promise.all([api.getHosts(), api.getSummary(), api.getMetricsHistory()]);
      setHosts(hR.data); setSummary(sR.data); setHistory(hiR.data);
      if (!selHost && hR.data.length) setSelHost(hR.data[0].id);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [selHost]);

  useEffect(() => { loadAll(); const t = setInterval(loadAll, 30000); return () => clearInterval(t); }, [loadAll]);

  const alertCount = (summary.warnings||0);

  const NAV = [
    { id:'overview',  label:'Overview'                              },
    { id:'resources', label:'Resources'                             },
    { id:'logs',      label:'Logs'                                  },
    { id:'patches',   label:'Patches & OS'                          },
    { id:'alerts',    label:`Alerts${alertCount?` (${alertCount})`:''}`},
    { id:'scan',      label:'Vuln Scan'                             },
  ];

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16 }}>
      <Spin sz={28}/><div style={{ fontSize:12, color:'var(--text3)' }}>Connecting to InfraCommand API…</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 28px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, border:'1.5px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'var(--accent)', boxShadow:'0 0 16px rgba(0,212,255,.2)' }}>IC</div>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:19, letterSpacing:'-0.5px' }}>Infra<span style={{ color:'var(--accent)' }}>Command</span></div>
            <div style={{ fontSize:9, color:'var(--text3)', letterSpacing:'3px', textTransform:'uppercase' }}>Server Intelligence Platform</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--text3)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 8px var(--green)', display:'inline-block', animation:'blink 1.5s ease-in-out infinite' }}/>
          LIVE &nbsp;·&nbsp; {hosts.length} HOSTS &nbsp;·&nbsp; {summary.total_vms||0} VMs
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'var(--accent)', fontWeight:500 }}>{clock}</span>
          <Btn onClick={loadAll}>↻ Refresh</Btn>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ display:'flex', padding:'0 28px', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{ padding:'12px 18px', fontSize:10, letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', background:'transparent', border:'none', borderBottom:`2px solid ${view===n.id?'var(--accent)':'transparent'}`, color:view===n.id?'var(--accent)':'var(--text3)', fontFamily:'inherit', transition:'all .2s' }}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <Sidebar hosts={hosts} sel={selHost} onSel={setSelHost} onNav={setView}/>
        <main style={{ flex:1, overflowY:'auto', padding:24 }}>
          {view==='overview'  && <Overview  hosts={hosts} summary={summary} history={history}/>}
          {view==='resources' && <Resources hosts={hosts} selId={selHost} onSel={setSelHost}/>}
          {view==='logs'      && <Logs      hosts={hosts}/>}
          {view==='patches'   && <Patches/>}
          {view==='alerts'    && <Alerts/>}
          {view==='scan'      && <VulnScan  hosts={hosts}/>}
        </main>
      </div>
    </div>
  );
}
