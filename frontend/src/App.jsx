import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const API = (window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api");
const api = axios.create({ baseURL: API });

const C = { bg: "#0a0e1a", card: "#111827", border: "#1e2a3a", cyan: "#00d4ff", warn: "#f59e0b", danger: "#ef4444", ok: "#10b981", text: "#e2e8f0", muted: "#64748b" };

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'JetBrains Mono', monospace; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.border}; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .badge-ok { background: #064e3b; color: ${C.ok}; }
  .badge-warn { background: #451a03; color: ${C.warn}; }
  .badge-crit { background: #450a0a; color: ${C.danger}; }
  .badge-sim { background: #1e1b4b; color: #818cf8; }
  .btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 600; transition: opacity .2s; }
  .btn:hover { opacity: .8; }
  .btn-primary { background: ${C.cyan}; color: #000; }
  .btn-danger { background: ${C.danger}; color: #fff; }
  .btn-ghost { background: ${C.border}; color: ${C.text}; }
  input, select, textarea { background: #1e2a3a; border: 1px solid ${C.border}; color: ${C.text}; padding: 8px 10px; border-radius: 6px; font-family: inherit; font-size: 12px; width: 100%; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${C.cyan}; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 999; }
  .modal { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; padding: 24px; width: 480px; max-height: 90vh; overflow-y: auto; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-full { grid-column: 1/-1; }
  .bar-bg { background: ${C.border}; border-radius: 4px; height: 6px; }
  .bar-fill { height: 6px; border-radius: 4px; transition: width .5s; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 12px; color: ${C.muted}; border-bottom: 1px solid ${C.border}; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #0d1520; }
  tr:hover td { background: #0d1520; }
`;

const Bar = ({ val, max = 100 }) => {
  const pct = Math.min(100, (val / max) * 100);
  const col = pct > 85 ? C.danger : pct > 60 ? C.warn : C.ok;
  return <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%`, background: col }} /></div>;
};

const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, ...style }}>{children}</div>
);

const KPI = ({ label, value, sub, color }) => (
  <Card style={{ flex: 1 }}>
    <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || C.cyan }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </Card>
);

const SrcBadge = ({ src }) => src === "live"
  ? <span className="badge badge-ok">LIVE</span>
  : <span className="badge badge-sim">SIM</span>;

// ─── Add Host Modal ──────────────────────────────────────────────────────────
function AddHostModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "", ip: "", os_type: "linux", auth_type: "password",
    username: "ubuntu", password: "", ssh_key: "", ssh_port: 22, winrm_port: 5985,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.ip) return setMsg({ type: "error", text: "Name and IP are required" });
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.post("/hosts", { ...form, ssh_port: Number(form.ssh_port) });
      setMsg({ type: "ok", text: res.data.message });
      setTimeout(() => { onAdded(); onClose(); }, 1500);
    } catch (e) {
      setMsg({ type: "error", text: e.response?.data?.detail || "Failed to add host" });
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: C.cyan }}>Add Host</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="form-grid">
          <div><label style={{ fontSize: 11, color: C.muted }}>Host Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="prod-server-01" /></div>

          <div><label style={{ fontSize: 11, color: C.muted }}>IP Address *</label>
            <input value={form.ip} onChange={e => set("ip", e.target.value)} placeholder="192.168.1.100" /></div>

          <div><label style={{ fontSize: 11, color: C.muted }}>OS Type</label>
            <select value={form.os_type} onChange={e => set("os_type", e.target.value)}>
              <option value="linux">Linux</option>
              <option value="windows">Windows</option>
            </select></div>

          <div><label style={{ fontSize: 11, color: C.muted }}>Auth Type</label>
            <select value={form.auth_type} onChange={e => set("auth_type", e.target.value)}>
              <option value="password">Password</option>
              <option value="key">SSH Key</option>
            </select></div>

          <div><label style={{ fontSize: 11, color: C.muted }}>Username</label>
            <input value={form.username} onChange={e => set("username", e.target.value)} placeholder="ubuntu" /></div>

          {form.os_type === "linux"
            ? <div><label style={{ fontSize: 11, color: C.muted }}>SSH Port</label>
                <input type="number" value={form.ssh_port} onChange={e => set("ssh_port", e.target.value)} /></div>
            : <div><label style={{ fontSize: 11, color: C.muted }}>WinRM Port</label>
                <input type="number" value={form.winrm_port} onChange={e => set("winrm_port", e.target.value)} /></div>
          }

          {form.auth_type === "password"
            ? <div className="form-full"><label style={{ fontSize: 11, color: C.muted }}>Password</label>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)} /></div>
            : <div className="form-full"><label style={{ fontSize: 11, color: C.muted }}>SSH Private Key (PEM)</label>
                <textarea rows={6} value={form.ssh_key} onChange={e => set("ssh_key", e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----" /></div>
          }
        </div>

        {msg && <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, fontSize: 12,
          background: msg.type === "ok" ? "#064e3b" : "#450a0a",
          color: msg.type === "ok" ? C.ok : C.danger }}>{msg.text}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Connecting..." : "Add Host"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview View ───────────────────────────────────────────────────────────
function Overview({ hosts, summary, history, onRefresh }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <KPI label="TOTAL HOSTS" value={summary.hosts} />
        <KPI label="TOTAL VMs" value={summary.total_vms} />
        <KPI label="AVG CPU" value={`${summary.avg_cpu}%`} color={summary.avg_cpu > 80 ? C.danger : C.cyan} />
        <KPI label="WARNINGS" value={summary.warnings} color={summary.warnings > 0 ? C.warn : C.ok} />
        <KPI label="UNPATCHED" value={summary.unpatched} color={summary.unpatched > 0 ? C.danger : C.ok} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>CPU USAGE 24H</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={history}><XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: 11 }} />
              <Area type="monotone" dataKey="cpu" stroke={C.cyan} fill="#00d4ff22" /></AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>RAM USAGE 24H</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={history}><XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: 11 }} />
              <Area type="monotone" dataKey="ram" stroke={C.warn} fill="#f59e0b22" /></AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>ALL HOSTS</div>
        <table>
          <thead><tr><th>Host</th><th>IP</th><th>OS</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Uptime</th><th>Source</th></tr></thead>
          <tbody>
            {hosts.map(h => (
              <tr key={h.id}>
                <td style={{ color: C.cyan }}>{h.name}</td>
                <td style={{ color: C.muted }}>{h.ip}</td>
                <td><span className="badge badge-sim">{h.os_type?.toUpperCase()}</span></td>
                <td><div style={{ minWidth: 80 }}><div style={{ fontSize: 11, marginBottom: 3 }}>{h.metrics?.cpu}%</div><Bar val={h.metrics?.cpu} /></div></td>
                <td><div style={{ minWidth: 80 }}><div style={{ fontSize: 11, marginBottom: 3 }}>{h.metrics?.ram}%</div><Bar val={h.metrics?.ram} /></div></td>
                <td><div style={{ minWidth: 80 }}><div style={{ fontSize: 11, marginBottom: 3 }}>{h.metrics?.disk}%</div><Bar val={h.metrics?.disk} /></div></td>
                <td style={{ color: C.muted, fontSize: 11 }}>{h.metrics?.uptime}</td>
                <td><SrcBadge src={h.metrics?.source} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Hosts Management View ───────────────────────────────────────────────────
function HostsView({ hosts, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const deleteHost = async (hid) => {
    setDeleting(hid);
    await api.delete(`/hosts/${hid}`).catch(() => {});
    onRefresh();
    setDeleting(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: C.cyan, fontSize: 16 }}>Host Management</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Host</button>
      </div>

      {showAdd && <AddHostModal onClose={() => setShowAdd(false)} onAdded={onRefresh} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {hosts.map(h => (
          <Card key={h.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ color: C.cyan, fontWeight: 700 }}>{h.name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{h.ip} · {h.os_type} · {h.auth_type}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <SrcBadge src={h.metrics?.source} />
                <button className="btn btn-danger" style={{ padding: "3px 8px", fontSize: 11 }}
                  onClick={() => deleteHost(h.id)} disabled={deleting === h.id}>
                  {deleting === h.id ? "..." : "✕"}
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
              {[["CPU", h.metrics?.cpu, "%"], ["RAM", h.metrics?.ram, "%"], ["Disk", h.metrics?.disk, "%"], ["Load", h.metrics?.load, ""]].map(([lbl, val, unit]) => (
                <div key={lbl}>
                  <div style={{ color: C.muted, fontSize: 10, marginBottom: 3 }}>{lbl}</div>
                  <div style={{ color: val > 85 ? C.danger : val > 60 ? C.warn : C.text }}>{val}{unit}</div>
                  <Bar val={val} />
                </div>
              ))}
            </div>
            {h.metrics?.reason && (
              <div style={{ marginTop: 8, fontSize: 10, color: C.muted, background: "#0d1520", padding: "4px 8px", borderRadius: 4 }}>
                ⚠ {h.metrics.reason}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Resources View ──────────────────────────────────────────────────────────
function Resources({ hosts }) {
  const [sel, setSel] = useState(null);
  const host = hosts.find(h => h.id === sel) || hosts[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {hosts.map(h => (
          <button key={h.id} className={`btn ${(sel||hosts[0]?.id) === h.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setSel(h.id)}>{h.name}</button>
        ))}
      </div>
      {host && (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            {[["CPU", host.metrics?.cpu, C.cyan], ["RAM", host.metrics?.ram, C.warn], ["DISK", host.metrics?.disk, "#a78bfa"], ["LOAD", host.metrics?.load, C.ok]].map(([l, v, c]) => (
              <KPI key={l} label={l} value={`${v}${l !== "LOAD" ? "%" : ""}`} color={c} />
            ))}
            <KPI label="UPTIME" value={host.metrics?.uptime || "—"} />
            <Card style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>SOURCE</div>
              <SrcBadge src={host.metrics?.source} />
            </Card>
          </div>
          <Card>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>NETWORK I/O</div>
            <div style={{ display: "flex", gap: 24 }}>
              <div><div style={{ color: C.muted, fontSize: 11 }}>IN</div><div style={{ color: C.ok, fontSize: 20, fontWeight: 700 }}>{host.metrics?.net_in} MB</div></div>
              <div><div style={{ color: C.muted, fontSize: 11 }}>OUT</div><div style={{ color: C.warn, fontSize: 20, fontWeight: 700 }}>{host.metrics?.net_out} MB</div></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Logs View ───────────────────────────────────────────────────────────────
function Logs({ hosts }) {
  const [logs, setLogs] = useState([]);
  const [hostFilter, setHostFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (levelFilter !== "all") params.level = levelFilter;
      if (hostFilter !== "all") {
        const res = await api.get(`/hosts/${hostFilter}/logs`, { params: { limit: 100 } });
        setLogs(res.data);
      } else {
        const res = await api.get("/logs", { params: { ...params, limit: 200 } });
        setLogs(res.data);
      }
    } catch (e) {}
    setLoading(false);
  }, [hostFilter, levelFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const lvlColor = l => l === "ERROR" ? C.danger : l === "WARN" ? C.warn : C.muted;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <select value={hostFilter} onChange={e => setHostFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">All Hosts</option>
          {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ width: 120 }}>
          <option value="all">All Levels</option>
          <option value="ERROR">ERROR</option>
          <option value="WARN">WARN</option>
          <option value="INFO">INFO</option>
        </select>
        <button className="btn btn-ghost" onClick={fetchLogs}>{loading ? "..." : "↻ Refresh"}</button>
        <span style={{ color: C.muted, fontSize: 11 }}>{logs.length} entries</span>
      </div>
      <Card style={{ maxHeight: "65vh", overflowY: "auto" }}>
        {logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
            <span style={{ color: C.muted, minWidth: 80 }}>{l.ts?.slice(11, 19)}</span>
            <span style={{ color: lvlColor(l.level), minWidth: 45, fontWeight: 700 }}>{l.level}</span>
            <span style={{ color: C.cyan, minWidth: 100 }}>{l.host}</span>
            <span style={{ color: C.text, flex: 1 }}>{l.msg}</span>
            <SrcBadge src={l.source} />
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>No logs found</div>}
      </Card>
    </div>
  );
}

// ─── Patches View ────────────────────────────────────────────────────────────
function Patches() {
  const [patches, setPatches] = useState([]);
  useEffect(() => { api.get("/patches").then(r => setPatches(r.data)).catch(() => {}); }, []);
  const sc = s => s === "UP TO DATE" ? "badge-ok" : s === "CRITICAL UPDATE" ? "badge-crit" : "badge-warn";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {patches.map((p, i) => (
        <Card key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: C.cyan, fontWeight: 700 }}>{p.host}</div>
            <SrcBadge src={p.source} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            {[["OS", p.os], ["Kernel", p.kernel], ["Last Patch", p.last_patch], ["Available", p.latest]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.muted }}>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 4 }}><span className={`badge ${sc(p.status)}`}>{p.status}</span></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Alerts View ─────────────────────────────────────────────────────────────
function Alerts() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => { api.get("/alerts").then(r => setAlerts(r.data)).catch(() => {}); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ color: C.cyan, fontSize: 16 }}>Active Alerts ({alerts.length})</h2>
        <button className="btn btn-ghost" onClick={() => api.get("/alerts").then(r => setAlerts(r.data))}>↻ Refresh</button>
      </div>
      {alerts.length === 0 && <Card><div style={{ color: C.ok, textAlign: "center", padding: 40 }}>✓ No active alerts</div></Card>}
      {alerts.map(a => (
        <Card key={a.id} style={{ borderLeft: `3px solid ${a.severity === "critical" ? C.danger : C.warn}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className={`badge ${a.severity === "critical" ? "badge-crit" : "badge-warn"}`}>{a.type}</span>
              <span style={{ marginLeft: 10 }}>{a.msg}</span>
            </div>
            <span style={{ color: C.muted, fontSize: 11 }}>{a.host}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Vuln Scan View ──────────────────────────────────────────────────────────
function VulnScan({ hosts }) {
  const [sel, setSel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const scan = async () => {
    if (!sel) return;
    setScanning(true); setResult(null);
    try {
      const r = await api.post(`/hosts/${sel}/scan`);
      setResult(r.data);
    } catch (e) {}
    setScanning(false);
  };

  const sevColor = s => s === "CRITICAL" ? C.danger : s === "HIGH" ? "#f97316" : s === "MEDIUM" ? C.warn : C.muted;

  const download = () => {
    if (!result) return;
    const txt = `InfraCommand Vulnerability Report\nHost: ${result.host}\nScanned: ${result.scanned_at}\n\nSummary: ${JSON.stringify(result.summary)}\n\n${result.vulns.map(v => `${v.id} [${v.severity}] CVSS:${v.cvss} ${v.pkg} — ${v.desc}\n${v.url}`).join("\n\n")}`;
    const a = document.createElement("a"); a.href = "data:text/plain," + encodeURIComponent(txt);
    a.download = `vuln-report-${result.host}.txt`; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ width: 200 }}>
            <option value="">Select host...</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={scan} disabled={!sel || scanning}>
            {scanning ? "Scanning..." : "▶ Run Scan"}
          </button>
          {result && <button className="btn btn-ghost" onClick={download}>↓ Download Report</button>}
        </div>
      </Card>
      {result && (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            {[["TOTAL", result.summary.total, C.cyan], ["CRITICAL", result.summary.critical, C.danger],
              ["HIGH", result.summary.high, "#f97316"], ["MEDIUM", result.summary.medium, C.warn], ["LOW", result.summary.low, C.muted]].map(([l, v, c]) => (
              <KPI key={l} label={l} value={v} color={c} />
            ))}
          </div>
          <Card>
            <table>
              <thead><tr><th>CVE ID</th><th>Severity</th><th>CVSS</th><th>Package</th><th>Description</th></tr></thead>
              <tbody>
                {result.vulns.map(v => (
                  <tr key={v.id}>
                    <td><a href={v.url} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{v.id}</a></td>
                    <td><span className="badge" style={{ background: sevColor(v.severity) + "33", color: sevColor(v.severity) }}>{v.severity}</span></td>
                    <td style={{ color: v.cvss >= 9 ? C.danger : v.cvss >= 7 ? "#f97316" : C.text }}>{v.cvss}</td>
                    <td style={{ color: C.warn }}>{v.pkg}</td>
                    <td style={{ color: C.muted }}>{v.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────────────
const VIEWS = ["Overview", "Hosts", "Resources", "Logs", "Patches", "Alerts", "Vuln Scan"];

export default function App() {
  const [view, setView] = useState("Overview");
  const [hosts, setHosts] = useState([]);
  const [summary, setSummary] = useState({});
  const [history, setHistory] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      const [h, s, hist] = await Promise.all([api.get("/hosts"), api.get("/summary"), api.get("/metrics/history")]);
      setHosts(h.data); setSummary(s.data); setHistory(hist.data);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 30000); return () => clearInterval(t); }, [fetchAll]);

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: C.card, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 16 }}>
          <div style={{ color: C.cyan, fontWeight: 900, fontSize: 16, marginBottom: 24, letterSpacing: 2 }}>INFRA<br />COMMAND</div>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? C.cyan + "22" : "transparent",
              border: "none", color: view === v ? C.cyan : C.muted,
              padding: "8px 12px", borderRadius: 6, cursor: "pointer",
              textAlign: "left", fontSize: 12, fontFamily: "inherit",
              marginBottom: 4, borderLeft: `2px solid ${view === v ? C.cyan : "transparent"}`,
            }}>{v}</button>
          ))}
          <div style={{ marginTop: "auto", fontSize: 10, color: C.muted }}>
            <div>{hosts.length} hosts · {summary.total_vms || 0} VMs</div>
            <div style={{ marginTop: 4 }}>{hosts.filter(h => h.metrics?.source === "live").length} live connections</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{view}</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.muted }}>{new Date().toLocaleTimeString()}</span>
              <button className="btn btn-ghost" onClick={fetchAll}>↻ Refresh</button>
            </div>
          </div>

          {view === "Overview"  && <Overview hosts={hosts} summary={summary} history={history} onRefresh={fetchAll} />}
          {view === "Hosts"     && <HostsView hosts={hosts} onRefresh={fetchAll} />}
          {view === "Resources" && <Resources hosts={hosts} />}
          {view === "Logs"      && <Logs hosts={hosts} />}
          {view === "Patches"   && <Patches />}
          {view === "Alerts"    && <Alerts />}
          {view === "Vuln Scan" && <VulnScan hosts={hosts} />}
        </div>
      </div>
    </>
  );
}
