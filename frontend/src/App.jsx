import React, { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import axios from "axios";

const API = window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api";
// Version injected at build time by Jenkins (REACT_APP_VERSION=BUILD_NUMBER)
// or from package.json. Shown in login footer - never hardcoded.
// Version injected by Jenkins at build time: REACT_APP_VERSION=${IMAGE_TAG} npm run build
const _APP_VERSION = process.env.REACT_APP_VERSION ? "v" + process.env.REACT_APP_VERSION : "v3.0.0";
const api = axios.create({ baseURL: API });
// Inject JWT on every request
api.interceptors.request.use(function(cfg) {
  var auth = loadAuth();
  if (auth.token) cfg.headers["Authorization"] = "Bearer " + auth.token;
  return cfg;
});
// On 401 force re-login
api.interceptors.response.use(function(r){ return r; }, function(err) {
  if (err.response && err.response.status === 401) {
    clearAuth();
    window.location.reload();
  }
  return Promise.reject(err);
});
// ── Auth helpers ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "infracommand_token";
const USER_KEY  = "infracommand_user";
function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function loadAuth() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user  = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return { token, user };
  } catch(e) { return { token: null, user: null }; }
}
function hasPerm(user, perm) {
  return !!(user && user.perms && user.perms.indexOf(perm) !== -1);
}

// ── IST timezone formatter ─────────────────────────────────────────────────────
var _istFmt = new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata",
  year:"numeric", month:"2-digit", day:"2-digit",
  hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
var _istTimeFmt = new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata",
  hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
var _istShortFmt = new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata",
  day:"2-digit", month:"short", year:"numeric",
  hour:"2-digit", minute:"2-digit", hour12:false });
function toIST(ts) {
  if (!ts) return "-";
  try { var d = new Date(ts); return isNaN(d) ? String(ts) : _istFmt.format(d) + " IST"; }
  catch(e) { return String(ts); }
}
function toISTTime(ts) {
  if (!ts) return "-";
  try { var d = new Date(ts); return isNaN(d) ? String(ts).slice(11,19) : _istTimeFmt.format(d); }
  catch(e) { return String(ts).slice(11,19); }
}
function toISTShort(ts) {
  if (!ts) return "-";
  try { var d = new Date(ts); return isNaN(d) ? String(ts) : _istShortFmt.format(d); }
  catch(e) { return String(ts); }
}

// ── D&IT Logo ─────────────────────────────────────────────────────────────────
var _LOGO_SRC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7Loorz/4ufECDwpp8ttazIL8oGeUrvFsrZ2nb/HI2DsT2LNhVOdKVKVWahBaszq1Y0ouUnob/AIt8YaN4bQpeStNdmMyLawYMhQfxnJARP9tyF968a8T/ABx1CcTf2QjrFFzIdPg87yx/tzyDYP8AgMbD0Y1yGn6RrHjeO21vUHM+hXl3JDNa2l6HvRKq/wCukUjM7rkPtHO0YVVGKu6UkGkWMngvxpFZ2NlpU7pdzDXJbM3MMp3+ctuqn7QcY2k+ykDBr6CjgKFH4/fkt1+fr/wdzwq2Or1fh92L2Ys3iP4kapJobJBd+Xr7MNPebWJtkm3ruETIEwOeVHAqi3jPxzo66jLMLkRaXfixung1e4wJjuwqq7uGzsbnaR+dS6F4ov8A/hErfTtJ8N63qAtNOlgtLoWp2wzmSYJKGHGDDMVb3A9M1DruoSXRunv9E8Q6DbX/AIm/tea8NgZRboItsfsxDkkj0PGTxXbGnHmcZQVv+D2vfb8TilOXKpKbv/wO9rb/AIHY6T8YvEOi3ENt4mtLy1eQB1j1i0MW9fVZo1GB7tEfcivXvB/jjRfEnlwwSG2vJELrbyspMijq0bqSsq+6k47gV8565Lo/iHV9MurnUzqel28jah4mGlySm1i3yBPPjSQB0LZBkCAheorP1GC+0LxNc2Xh7SblFsYDe6pYLcmS2hC8rcQTEh1DIUZX4cE4+YcVyVcuo1l7q5Zfh/X+a11OulmFai9XzR/H+v8AJ6aH2HRXmPwd+I8PiO2gsL+5Ms75W2uHAVpWUZaKQDgTKOeOHX5lxhlX06vnq1GdGbhNanvUa0K0FOD0MrxZrEeg6Dc6k8fmugCwxZwZZWIVE9ssQM9hk9q+TF17R/EnxIWHxJIL7TpXljErTNEkly42i4fb8wQsFUY+6gT0IPrv7TuuzWunw6bbFvMWEyKB1MsxMUePUhPPP1ArhXn8I3XgGe2tUsdbsdPgt2j0pnXTry3ZFY3EzyEFpN7EZVCeMDjFe7llJUqPtGneWl10/r1XU8TMqrqVfZpq0ddev9fMx9YtdN0W81Lwl4dF7PeXaqmo6fesrW9jNGu/z47kbTmE5BcqBjdyR19D+HvwsutWaLXNavbmVpFXF/ep5t1MAMAxJKCIU9GcNIRzhOlVvgX4WbXr6TWtZDz+cI7u7EzFy69ba3JbkqqqsrA9f3Oehr6DGKzzDHSpv2UHr1f9f1b8NMDgo1F7Sa06L+v6/XmLbwD4Tj2tcaRFqEgH+sv3a5Y/jITj8MCi48A+EZGLwaLBYyY4ksWa2cfjGVrp6K8b21T+Z/eex7Gn/KvuPEfHPwwu9LnOvaDeXYuIQSLyzjC30IxyWVAFuU9RgSY6F/u15zaXFzex6lpPiGK4uILazfWtTktLkvN4gZWUQkS44hVWBwB8oVjgEYH1pxXg/wAdvDNzpNzHrXh+SWzn3S3VlJbsUaC5Cl5o1I6LKgZ8dN8bf3zXr4DGupJUqm/R/wBf0t9zycdg1TXtKe3Vf1/XTY8ymnsdAh0LxNp9ld6LZaw0qXFj57StF5DrsuoWbDHBbcue6sMlWNfU3gHXv+Eg8OxXUpjF5ExguhGfk8xQPmX/AGWBV1/2XFfPdnpVr4m8O3XiCbQfEvinUru3NvY3eo3O3MmMNIqphIoIyT87tyeAOuOo/Zk1mVJTpVy43+W9nINwP7y3IMZyODmORlyOohFdGZU1WouX2ovX+t9NrvXQwy+o6VVR+zL+vTXey7mb8a9YtNP+LWnXupeYbSx1O2kkCLuYrDAsgAH+9L+teU6/qnhvW4HFp4Tl0vVbmYETRanJLDl2+YmOQE5OTghq9B/absJ5fGDrDC8ks9zDsVFyWMkARQB3JMJFYXxD03xzqtgPFviPTtK0xdGt4Lc28ciRzEbvkzECSGJycHHAOBxXoYH2caNJt2bVt7emnW9zhxvPKrUSWifa/rr0PcdHMuj/AAY1/U9Nma3udl9NDIoGY/LLRR4+ixJj6Vy2hw/E5vhva+O9P8fS3kxsjeSade2cZjZVBLKGHOcA+n4V1WhiTW/gxr2madGbm5KX0MSIRlzKWljAzxysqfnXK6R/wtRfhva+A7DwL9gf7J9jk1K6v49iochmCjkHBPr9DXi0/tfDfm15rbfP9D1qn2d7culr7/L9Tu9L+Jmky+C9D1+7trrzdVt5JhbW0RlZPKGZm7fKuOp56dTWZ8X/ABPqFl/whF3oOpyw2up6xAkjRgYnhcA4OR0IPsa5/wAWeANUsdC8PeHILPUNV0zTdOdYWsliJGoFs75VkZd0LAsCucYJyOlL4h0Hxxruj+EX1HSrhtRs/En2m9hUxCK1hDDAjIbmILgD+Lrmpp0sOpqcWrXe76a2/ruXOriHBwad7LZddLkPxLtPHPh3xBoUNv8AEfVHi13VjahBaxqLZWbI29d2Acc46V1nibQ9T0b4Z3v9seILnxBd2l3FfRXNxCsbKEkTKALxjAcf8CNP+MGg6vrOu+CbjTLGS5i0/W0uLplZR5UYxljkjj6ZrZ+LMif8ITc2hcI99NDapn/blUMfwXc30BrN1ueNJK1+tkr7+S7Gio8rqvW3S7fbz8z5TvdH8a3mm3umWa6pe6FpV7NaxWyTbkBWQ5CRZy+NwJIBxu5xXTfs+Pc6X41+x3ME1vcQ6hbq8MiFWQsk8TBlPIPzj8qw7L4htYWV6lnpyNey31zdQX7MrNGs0is0W0qf3bquGAIY54IGQek+Bs1zr/xAOp3KxrNNf2oxEu1FWKKZtqjJOAsaDv8AWvo8X7VYaoqkUl/wx8/hfZvEU3CTbO9/ag0Ga6sLfVbZW8wwmLI6iSImWPH1Xzx9SK86t7rR/EfhhbHRfDVraabpsQWW/wBc1Yw2sdzIvzS7Ux5kzc4LFsADgDivp3xZo8evaBdaY7+U8ihoZcZMUqkMj/gwBx36d6+UtchsPDX23w34m0fUH0mW/wDtcS2M6xy2l0qbJIssCrIVYFT12FGHUivLyut7Wl7P7UXp/V1fQ9HMqXsqvtOklr/Vmd98EfEU/hbU5dB8QMkBhSK3u28wMipx9muQw4MZVhEWHA/cngE4+hBivkDxgJ7XUbC/EMlj4kuUt7bTdDhAlFpYhPLSO53DLvICPk9CSw5Ar0H4ffFabSJ28P6tD89pIYHsZ7lRNbspwUhmc7JkGDhHZXHQM4xWePwEq376nu91/XTz2/XTA46NL9zPZbP+uv4/p79RgVy1t8QPCkgUXOqDTpCMlL+J7Yj/AL7AB/AkU6fx94UTi31ZNQfGRHYRvcsf+/YOPxxXi+wqfyv7j2PbU/5kdOcdTXz/APtC+NkmhktNOlMiQrNb2xTnfMVKTzD/AGIkLRhuheRv7hqb4lfF0zQXGn2Mc0EaoTLb20u66de/mSR5W2TnnBaTt8nWuO0fSdUuYND8Q6VqlhaazqKotvdzX0cVpCCzIunRWwDM5wAG3DaM/Vj7GAwTpNVq3y/r/h/m9vJxuMVVOlS+f9f1/nY13QtFltrpr7wvaw+FrPTlk0zxFp84jklCxDYj9VmkeTIKkBlyecCum/Zf8PvEsWoTJgxwNcv7ST4WMfURRlvpMK8qisLHxX4mj+y6DJpkULf8TW1tJd0Mk5fasduv8DSkbQuSBlmHyqa+tPAuhnQPD8VrN5Zu5WM920YwhlYDIX/ZUBUX/ZQVvmVZ0aHsr6v8Pxe/X5aGGXUlWre1tov67Lbp89Tergfiz8P7bxZp8txbwRtf+WFdGbYLhVyVG7B2OpJKvg4yQQVYiu+or5+lVlSmpweqPeq0o1YuMlofImmGPwZeXz6xp8yaiizJZ695byT2U7pgLcQlsBgOFbPG7cpcdI/A9lpaw+FtIOj6RrGpeIrp5b9rxTKba0DbQoIYeW2FkkLdeBX1D4q8J6P4iTdewmO6WMxpdQ4WRVPVTkEOv+wwK+1eO+IPghfWV095oEhSUqyiXTphbyEMCGBic7DkEg7XQH0FfRUMzpVYtTfLJ/ds7fK7vb8DwK2XVaTTguZL7+n49P1OX+HvheHVLeJ9J1vxPFZXurXFpD9k1COBLaBCCjsj8zZUgnYOMc81naVpD6//AMI1Z6hrviG7h1+G9Qt9tJS2lgkYCQoeHQIoLL1OTg9BWvpnhj4geGLeC1sC7Q2cjyWwvfDzzNbO4w7RuiybM99rYrN03wH43ks9Ktre61GOPTJZJrJrXSbhJInkILEO6x91HU8fjXX7WLlKXtFbo9ez8vT7vv5fZSso+zd+q+a8/X7w+x2HhrxF4O1fRZbE6RqmntZ6g9wklrbXQQmO53CQbgHQqw45OCB0FY+m6ckHiGc/D/VdQXT5A1pLqtxaBWbcxxHAADIzlcDC4duT8qk49M0z4Pa/rV4t74nu7u8lB/1usXZmIH+zBExH4NLj2Net+EvBejeHdk0EZubxE2LczKoMa91jVQFjX2QDPfJ5rkrZnTpL3XzO1vLd29bf0jqo5bUqO8lyrfz6X9L/ANM5j4P/AA6h8OWsF7e2xhmjBNtbOQzRFhhpZCOGmYccfKi/KucszemUUV89WrTrTc5vU9+lSjSiox2P/9k=";
function DitLogo(props) {
  var size = props.size || 40;
  return React.createElement("img", {
    src: _LOGO_SRC,
    alt: "D&IT",
    style: { width:size, height:size, borderRadius:"50%",
             objectFit:"contain", flexShrink:0, background:"#fff" }
  });
}



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
const KPI = ({label,value,color,sub,onClick,linkLabel}) => (
  <div
    className="kpi"
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); onClick(); } } : undefined}
    style={onClick ? {cursor:"pointer"} : undefined}
    title={onClick ? (linkLabel || "Open") : undefined}
  >
    <div className="kpi-val" style={{color:color||T.blue}}>{value}</div>
    <div className="kpi-lbl">{label}</div>
    {sub&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div>}
    {onClick&&<div style={{fontSize:10,color:T.blue,marginTop:6,fontWeight:700}}>{linkLabel||"View"} →</div>}
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
            {busy?<><span className="spinner"/>Adding...</>:"\u2795 Add as Host"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Host Modal ─────────────────────────────────────────────────────────────
function AddHostModal({onClose,onAdded,existingGroups=[]}) {
  const [form,setForm]=useState({name:"",ip:"",os_type:"linux",auth_type:"password",
    username:"root",password:"",ssh_key:"",ssh_port:22,winrm_port:5985,
    winrm_auth:"ntlm",domain:"",group:"Default"});
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const [testResult,setTestResult]=useState(null);
  const [testing,setTesting]=useState(false);
  const [newGroup,setNewGroup]=useState("");
  const [addingGroup,setAddingGroup]=useState(false);
  const [showWinGuide,setShowWinGuide]=useState(false);

  const allGroups=[...new Set([...existingGroups,"Default"])].sort();
  const isWin = form.os_type==="windows";

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
    if(!form.group) return setMsg({t:"e",text:"Select or create a Discom group"});
    setBusy(true);setMsg(null);
    try {
      const r=await api.post("/hosts",{...form,ssh_port:Number(form.ssh_port),winrm_port:Number(form.winrm_port)});
      setMsg({t:"ok",text:r.data.message});
      setTimeout(()=>{onAdded();onClose();},2000);
    } catch(e){
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
      <div className="modal" style={{width:520}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div><div style={{fontWeight:700,fontSize:16}}>Add Host</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>SSH (Linux/KVM) or WinRM (Windows/Hyper-V)</div></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* ── Discom Group ── */}
        <div style={{marginBottom:14,padding:"10px 14px",background:"#f0f9ff",borderRadius:8,border:"1px solid #bae6fd"}}>
          <label style={{fontSize:11,fontWeight:700,color:"#0369a1",display:"block",marginBottom:6}}>
            🏢 Discom / Business Unit Group
          </label>
          {!addingGroup?(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={form.group} onChange={e=>set("group",e.target.value)} style={{flex:1}}>
                {allGroups.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAddingGroup(true)}
                style={{whiteSpace:"nowrap",fontSize:11}}>+ New Group</button>
            </div>
          ):(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input autoFocus placeholder="e.g. TPCODL, NESCO, WESCO..." value={newGroup}
                onChange={e=>setNewGroup(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&newGroup.trim()){set("group",newGroup.trim());setAddingGroup(false);}
                               if(e.key==="Escape"){setAddingGroup(false);setNewGroup("");}}}
                style={{flex:1}}/>
              <button className="btn btn-primary btn-sm" onClick={()=>{if(newGroup.trim()){set("group",newGroup.trim());setAddingGroup(false);}}}
                style={{fontSize:11}}>Add</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setAddingGroup(false);setNewGroup("");}}
                style={{fontSize:11}}>Cancel</button>
            </div>
          )}
          {form.group&&<div style={{fontSize:10,color:"#0369a1",marginTop:5}}>
            This host will appear under: <strong>{form.group}</strong>
          </div>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Host Name *","name","text","prod-server-01"],["IP Address *","ip","text","192.168.1.100"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>OS / Hypervisor</label>
            <select value={form.os_type} onChange={e=>{
              set("os_type",e.target.value);
              set("username",e.target.value==="windows"?"Administrator":"root");
              if(e.target.value==="windows") set("winrm_auth","negotiate");
            }}>
              <option value="linux">🐧 Linux — KVM (SSH)</option>
              <option value="windows">🪟 Windows — Hyper-V (WinRM)</option>
            </select></div>
          {isWin?(
            <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>WinRM Auth</label>
              <select value={form.winrm_auth} onChange={e=>set("winrm_auth",e.target.value)}>
                <option value="ntlm">NTLM — Recommended (works without domain join)</option>
                <option value="basic">Basic — Only if AllowUnencrypted=true on host</option>
              </select>
            </div>
          ):(
            <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Auth Type</label>
              <select value={form.auth_type} onChange={e=>set("auth_type",e.target.value)}>
                <option value="password">Password</option><option value="key">SSH Key (PEM)</option>
              </select>
            </div>
          )}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Username</label>
            <input value={form.username} onChange={e=>set("username",e.target.value)}
              placeholder={isWin?"Administrator (domain added automatically)":"root"}/></div>
          {isWin?(
            <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>
              WinRM Port</label>
              <input type="number" value={form.winrm_port} onChange={e=>set("winrm_port",e.target.value)}/></div>
          ):(
            <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Port</label>
              <input type="number" value={form.ssh_port} onChange={e=>set("ssh_port",e.target.value)}/></div>
          )}
          {form.auth_type==="password"||isWin
            ?<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>Password</label>
               <input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
            :<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>SSH Private Key</label>
               <textarea rows={5} value={form.ssh_key} onChange={e=>set("ssh_key",e.target.value)} placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}/></div>}
        </div>

        {/* ── Windows Domain / NTLM section ── */}
        {isWin&&(
          <div style={{marginTop:12,padding:"12px 14px",background:"#f0f9ff",borderRadius:8,border:"1px solid #bae6fd"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:"#0369a1"}}>🔑 Active Directory / Domain Authentication</label>
              <button type="button" style={{fontSize:10,color:"#0369a1",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}
                onClick={()=>setShowWinGuide(g=>!g)}>{showWinGuide?"Hide Guide":"WinRM Setup Guide"}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>
                  AD Domain <span style={{fontWeight:400,color:T.muted}}>(optional for local accounts)</span>
                </label>
                <input value={form.domain} onChange={e=>set("domain",e.target.value)}
                  placeholder="e.g. TPCODL or corp.tpcodl.com"/>
                {form.domain&&(
                  <div style={{fontSize:10,color:"#0369a1",marginTop:4}}>
                    Will authenticate as: <strong>{form.domain.split(".")[0].toUpperCase()}\{form.username||"Administrator"}</strong>
                  </div>
                )}
              </div>
              <div style={{background:"#e0f2fe",borderRadius:6,padding:"8px 10px",fontSize:10,color:"#0369a1"}}>
                <div style={{fontWeight:700,marginBottom:4}}>How NTLM works without domain join:</div>
                <div>• ServerCapacity sends credentials to the Windows host</div>
                <div>• Windows validates against its own AD or local SAM</div>
                <div>• <strong>No need</strong> to join ServerCapacity server to the domain</div>
                <div>• Each Discom can have its own domain — just enter it per host</div>
              </div>
            </div>
            {showWinGuide&&(
              <div style={{marginTop:10,padding:"10px 12px",background:"#fff",borderRadius:6,
                border:"1px solid #bae6fd",fontSize:11,color:T.sub}}>
                <div style={{fontWeight:700,color:T.text,marginBottom:6}}>Run these on each Windows host (as Administrator):</div>
                <pre style={{background:"#0f1f2e",color:"#a5f3fc",padding:"8px 10px",borderRadius:5,
                  fontSize:10,overflowX:"auto",margin:"0 0 8px"}}>
{`# 1. Enable WinRM
Enable-PSRemoting -Force

# 2. Allow connections from ServerCapacity server IP
Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value "192.168.101.80" -Force
# Or allow all (simpler but less secure):
Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value "*" -Force

# 3. Ensure WinRM service is running
Start-Service WinRM
Set-Service WinRM -StartupType Automatic

# 4. Open firewall port 5985
New-NetFirewallRule -Name "WinRM-HTTP" -DisplayName "WinRM HTTP" \`
  -Protocol TCP -LocalPort 5985 -Action Allow

# 5. Verify NTLM is allowed (check GPO)
# Network security: LAN Manager authentication level
# Should be: Send NTLMv2 response only`}
                </pre>
                <div style={{color:T.muted,fontSize:10}}>
                  After setup, use <strong>Test Connection</strong> to verify. Domain accounts: enter domain above.
                  Local accounts: leave domain blank, use local Administrator credentials.
                </div>
              </div>
            )}
          </div>
        )}
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
          {scanBusy?<><span className="spinner"/>Scanning...</>:"\uD83D\uDD0C External Port Scan"}
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
          {scanBusy?<><span className="spinner"/>Scanning...</>:"\uD83D\uDD0C External Scan"}
        </button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
        {ports.map(p=>(
          <span key={p.port} className={`port-chip ${RISKY[p.port]?"port-risky":"port-active"}`}>
            <strong>:{p.port}</strong> {p.process}{RISKY[p.port]?" \u26A0":""}
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
      setResult({error:"Host ID not available \u2014 try closing and reopening."});
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
            <div style={{color:T.muted,fontSize:12}}>Scanning {ip} from ServerCapacity server</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-port btn-sm" onClick={scan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"\u21BB Rescan"}</button>
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
                ?result.ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}{p.risky?" \u26A0":""}</span>)
                :<div style={{color:T.muted,fontSize:12}}>No open ports detected</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Vuln Scan Modal ───────────────────────────────────────────────────────────
function VulnScanModal({target,hostId,vmId,ip,osType,onClose}) {
  const [result,setResult]         = useState(null);
  const [scanStatus,setScanStatus] = useState("idle");
  const [scanMsg,setScanMsg]       = useState("");
  const [elapsed,setElapsed]       = useState(0);
  const [httpError,setHttpError]   = useState(null);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);
  const isWin = (osType||"").toLowerCase()==="windows";

  const clearTimers = () => {
    if(pollRef.current)  clearInterval(pollRef.current);
    if(timerRef.current) clearInterval(timerRef.current);
  };

  const startPolling = () => {
    clearTimers();
    setElapsed(0);
    timerRef.current = setInterval(()=>setElapsed(e=>e+1), 1000);
    pollRef.current  = setInterval(async()=>{
      try {
        const url = vmId ? `/hosts/${hostId}/vms/${vmId}/scan/status` : `/hosts/${hostId}/scan/status`;
        const r = await api.get(url);
        const {status, result: sr} = r.data;
        if(status==="done"||status==="error") {
          clearTimers();
          setScanStatus(status);
          if(sr) setResult(sr);
        }
        // Frontend safety timeout: if backend hasn't responded in 10 mins, stop polling
        setElapsed(e => {
          if(e >= 600) {
            clearTimers();
            setScanStatus("error");
            setHttpError("Scan timed out after 10 minutes. The backend will finish and save the result — click ↻ Rescan to check for cached results.");
          }
          return e;
        });
      } catch(e) {
        clearTimers();
        setHttpError(e.response?.data?.detail||"Poll failed");
        setScanStatus("error");
      }
    }, 3000);
  };

  const startScan = async(force=false) => {
    if(!hostId||hostId==="undefined") { setHttpError("Host ID not available."); return; }
    setHttpError(null); setResult(null); setScanStatus("running"); setScanMsg("");
    try {
      const url = vmId
        ? `/hosts/${hostId}/vms/${vmId}/scan${force?"?force=true":""}`
        : `/hosts/${hostId}/scan${force?"?force=true":""}`;
      const r = await api.post(url);
      const {status, result: sr, message} = r.data;
      setScanMsg(message||"");
      if(status==="done"&&sr) { setScanStatus("done"); setResult(sr); }
      else { setScanStatus("running"); startPolling(); }
    } catch(e) {
      setHttpError(e.response?.data?.detail||"Failed to start scan");
      setScanStatus("error");
    }
  };

  useEffect(()=>{
    if(!hostId||hostId==="undefined") return;
    (async()=>{
      try {
        const url = vmId ? `/hosts/${hostId}/vms/${vmId}/scan/status` : `/hosts/${hostId}/scan/status`;
        const r = await api.get(url);
        const {status, result: sr} = r.data;
        if(status==="done"&&sr)      { setScanStatus("done"); setResult(sr); }
        else if(status==="running")  { setScanStatus("running"); startPolling(); }
      } catch(e) {}
    })();
    return ()=>clearTimers();
  }, [hostId]); // eslint-disable-line

  const dl=()=>{
    if(!result) return;
    const txt=`ServerCapacity Vulnerability Report\nTarget: ${result.target} (${result.ip})\nDate: ${result.scanned_at}\n\nSUMMARY: Critical:${result.summary?.critical} High:${result.summary?.high} Medium:${result.summary?.medium}\n\n${result.vulns?.map(v=>`${v.id} [${v.severity}] CVSS:${v.cvss} ${v.pkg}: ${v.desc}`).join("\n")}`;
    const a=document.createElement("a"); a.href="data:text/plain,"+encodeURIComponent(txt);
    a.download=`vuln-${result.target}-${Date.now()}.txt`; a.click();
  };

  const isRunning = scanStatus==="running";
  const scanError = result?.scan_error;
  const hasVulns  = result?.vulns?.length>0;
  const mins=Math.floor(elapsed/60), secs=elapsed%60;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&(clearTimers(),onClose())}>
      <div className="modal" style={{width:740,maxWidth:"96vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{isWin?"🪟":"🐧"} Vulnerability Scan — {target}</div>
            <div style={{color:T.muted,fontSize:11,marginTop:2,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontFamily:"IBM Plex Mono"}}>{ip}</span>
              <span style={{padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:600,
                background:isWin?"#dbeafe":"#dcfce7",color:isWin?"#1d4ed8":"#166534"}}>
                {isWin?"Windows — WinRM":"Linux — SSH:22"}
              </span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {result&&!isRunning&&<button className="btn btn-ghost btn-sm" onClick={dl}>↓ Export</button>}
            <button className="btn btn-scan btn-sm" onClick={()=>startScan(true)} disabled={isRunning}>
              {isRunning
                ?<><span className="spinner"/>Scanning {mins>0?`${mins}m`:""}{String(secs).padStart(2,"0")}s</>
                :"↻ Rescan"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{clearTimers();onClose();}}>✕</button>
          </div>
        </div>

        {isRunning&&(
          <div style={{marginBottom:12}}>
            <div className="scan-bar"/>
            <div style={{fontSize:11,color:T.muted,marginTop:6,display:"flex",gap:6,alignItems:"center"}}>
              <span className="spinner" style={{width:10,height:10}}/>
              {scanMsg||(isWin
                ?"Connecting via WinRM → querying Windows Update + Trivy NVD..."
                :"Connecting via SSH → fetching packages → running Trivy CVE scan...")}
            </div>
          </div>
        )}

        {scanStatus==="idle"&&!httpError&&(
          <div style={{padding:"30px 0",textAlign:"center",color:T.muted}}>
            <div style={{fontSize:28,marginBottom:8}}>🔍</div>
            <div style={{fontSize:13}}>No scan results yet</div>
            <div style={{fontSize:11,marginTop:4}}>Click <strong>↻ Rescan</strong> to start a {isWin?"Windows (WinRM)":"Linux (SSH)"} scan</div>
          </div>
        )}

        {httpError&&<div style={{color:T.red,padding:12,background:"#fee2e2",borderRadius:7,fontSize:12,marginBottom:12}}>⚠ {httpError}</div>}

        {result&&scanError&&(
          <div style={{marginBottom:12,padding:"10px 14px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:7,fontSize:12,color:"#9a3412"}}>
            <div style={{fontWeight:700,marginBottom:4}}>⚠ Scan Error</div>
            <div style={{fontFamily:"IBM Plex Mono",fontSize:11,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{scanError}</div>
            <div style={{marginTop:6,color:"#92400e",fontSize:11}}>
              {isWin?"Check WinRM (5985/5986) is enabled and credentials are correct."
                    :"Check SSH (port 22) and that Trivy is installed on the backend."}
            </div>
          </div>
        )}

        {result&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
              {[["Total",result.summary?.total,T.blue],["Critical",result.summary?.critical,T.red],
                ["High",result.summary?.high,T.amber],["Medium",result.summary?.medium,T.purple],
                ["Low",result.summary?.low,T.muted]].map(([l,v,c])=>(<KPI key={l} label={l} value={v??0} color={c}/>))}
            </div>
            <div style={{fontSize:10,color:T.muted,marginBottom:10,display:"flex",gap:14,flexWrap:"wrap"}}>
              {result.scanned_at&&<span>🕐 {new Date(result.scanned_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</span>}
              {result.vulns?.some(v=>v.source==="Trivy/NVD"||(!v.source&&!isWin))&&<span style={{color:"#6d28d9"}}>✦ Trivy/NVD CVEs</span>}
              {result.vulns?.some(v=>v.source==="Windows Update"||(isWin&&!v.source))&&<span style={{color:"#0369a1"}}>✦ Windows Update KBs</span>}
            </div>
            {result.open_ports?.length>0&&(
              <div style={{marginBottom:12}}>
                <div className="section-hd">Open Ports ({result.open_ports.length})</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {result.open_ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}{p.risky?" ⚠":""}</span>)}
                </div>
              </div>
            )}
            {hasVulns?(
              <div style={{maxHeight:"42vh",overflowY:"auto"}}>
                <table>
                  <thead><tr><th>CVE / KB ID</th><th>Severity</th><th style={{textAlign:"center"}}>CVSS</th><th>Source</th><th>Package</th><th>Description</th></tr></thead>
                  <tbody>{result.vulns.map((v,i)=>(
                    <tr key={(v.id||"v")+i} style={{background:v.port_exposed?"#fffbeb":""}}>
                      <td style={{whiteSpace:"nowrap"}}>
                        <a href={v.url||"#"} target="_blank" rel="noreferrer" style={{color:T.blue,fontFamily:"IBM Plex Mono",fontSize:11}}>{v.id}</a>
                        {v.port_exposed&&<span title={`Exposed port ${v.exposed_port}`} style={{marginLeft:4,fontSize:9,color:T.amber}}>⚡:{v.exposed_port}</span>}
                      </td>
                      <td><SevBadge sev={v.severity}/></td>
                      <td style={{textAlign:"center"}}><span style={{fontFamily:"IBM Plex Mono",fontWeight:700,fontSize:12,color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.sub}}>{v.cvss}</span></td>
                      <td><span style={{fontSize:10,padding:"1px 6px",borderRadius:4,whiteSpace:"nowrap",
                        background:v.source==="Trivy/NVD"||(v.source!=="Windows Update"&&!v.source)?"#ede9fe":"#e0f2fe",
                        color:v.source==="Trivy/NVD"||(v.source!=="Windows Update"&&!v.source)?"#6d28d9":"#0369a1"}}>
                          {v.source||(isWin?"Windows Update":"Trivy/NVD")}</span></td>
                      <td><code style={{background:"#f1f5f9",padding:"2px 5px",borderRadius:4,fontSize:11}}>{v.pkg}</code></td>
                      <td style={{color:T.sub,maxWidth:230,wordBreak:"break-word",fontSize:11}}>{v.desc}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ):(
              !scanError&&!isRunning&&(
                <div style={{padding:"24px 0",textAlign:"center",color:T.muted}}>
                  <div style={{fontSize:32,marginBottom:8}}>✅</div>
                  <div style={{fontSize:13,fontWeight:600}}>No vulnerabilities found</div>
                  <div style={{fontSize:11,marginTop:4}}>System appears up to date</div>
                </div>
              )
            )}
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
    : ["metrics","hardware","nics","storage","ports","patch","os","logs"];

  const tabLabel={metrics:"\uD83D\uDCCA Metrics",hardware:"\uD83D\uDDA5 Hardware",nics:"\uD83C\uDF10 NICs",storage:"\uD83D\uDCBE Storage",
                  ports:"\uD83D\uDD0C Ports",patch:"\uD83D\uDD27 Patches",os:"\uD83D\uDCBB OS Info",logs:"\uD83D\uDCCB Logs"};

  // ── NIC sparkline mini-bar ───────────────────────────────────────────────
  const NicBar=({val,max,color})=>{
    const pct=max>0?Math.min(100,val/max*100):0;
    return <div style={{height:4,background:"#f1f5f9",borderRadius:2,marginTop:3}}>
      <div style={{height:4,width:`${pct}%`,background:color,borderRadius:2,transition:"width .3s"}}/>
    </div>;
  };

  // ── NIC table row ────────────────────────────────────────────────────────
  const NicRow=({n})=>{
    if(!n||typeof n!=="object") return null;
    const safeNics = Array.isArray(nics) ? nics.filter(x=>x&&typeof x==="object") : [];
    const maxMB=safeNics.length>0 ? Math.max(...safeNics.map(x=>Math.max(Number(x.rx_mb)||0,Number(x.tx_mb)||0)),1) : 1;
    const rxMb = Number(n.rx_mb)||0;
    const txMb = Number(n.tx_mb)||0;
    return (
      <div style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:700,fontFamily:"IBM Plex Mono",fontSize:13}}>{n.name||"unknown"}</span>
            <span className={`badge ${n.state==="up"?"b-ok":"b-stop"}`}>{n.state||"unknown"}</span>
            {n.speed_mbps&&<span className="badge b-info">{n.speed_mbps>=1000?`${n.speed_mbps/1000}Gbps`:`${n.speed_mbps}Mbps`}</span>}
          </div>
          <div style={{fontSize:11,color:T.muted,fontFamily:"IBM Plex Mono"}}>{n.mac||""}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
          <div>
            <div style={{color:T.muted}}>IPv4</div>
            <div style={{fontWeight:600,color:T.blue}}>{n.ipv4||"—"}</div>
            {n.ipv6&&<div style={{color:T.muted,fontSize:10}}>{String(n.ipv6).slice(0,30)}</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>RX</div>
            <div style={{fontWeight:600,color:T.green}}>{rxMb.toFixed(1)} MB</div>
            <NicBar val={rxMb} max={maxMB} color={T.green}/>
            {(Number(n.rx_err)>0)&&<div style={{color:T.red,fontSize:10}}>⚠ {n.rx_err} errors</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>TX</div>
            <div style={{fontWeight:600,color:T.amber}}>{txMb.toFixed(1)} MB</div>
            <NicBar val={txMb} max={maxMB} color={T.amber}/>
            {(Number(n.tx_err)>0)&&<div style={{color:T.red,fontSize:10}}>⚠ {n.tx_err} errors</div>}
          </div>
        </div>
        {(n.gateway||n.subnet||n.switch)&&(
          <div style={{marginTop:6,fontSize:10,color:T.muted}}>
            {n.subnet&&<span>Subnet: {n.subnet}{"  "}</span>}
            {n.gateway&&<span>GW: {n.gateway}{"  "}</span>}
            {n.switch&&<span>Switch: {n.switch}</span>}
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
              {isVM?(target.hypervisor==="Hyper-V"?"\uD83E\uDE9F":"\uD83D\uDDA5"):(target.os_type==="windows"?"\uD83E\uDE9F":"\uD83D\uDC27")}
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
            {isVM&&(
              <button className="btn btn-ghost btn-sm" title="Edit VM IP address"
                onClick={async()=>{
                  const current = ip==="N/A" ? "" : ip;
                  const newIp = window.prompt(
                    `Edit IP for ${target.name}:\n(macvtap/direct-mode VMs need manual IP entry)`,
                    current
                  );
                  if(newIp !== null && newIp.trim()){
                    try{
                      await api.patch(`/hosts/${hostId}/vms/${sel.vmId}/ip`, {ip: newIp.trim()});
                      await onDbReload(hostId);
                    } catch(e){ alert("Failed to update IP: " + (e.response?.data?.detail||e.message)); }
                  }
                }}
                style={{fontSize:10, color: ip==="N/A"||!ip ? T.amber : T.muted,
                  border: `1px solid ${ip==="N/A"||!ip ? T.amber+"66" : T.border}`,
                  borderRadius:4, padding:"1px 6px"}}>
                ✎ {ip==="N/A"||!ip ? "Set IP" : ip}
              </button>
            )}
            <SrcBadge src={m.source}/>
            <button className="btn btn-refresh btn-sm" onClick={doRefresh} disabled={refreshing}>
              {refreshing?<><span className="spinner"/>...</>:"\u21BB Refresh"}</button>
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
                ["Uptime",   m.uptime && m.uptime!=="N/A" ? m.uptime : (isVM ? "See host" : "\u2014")],
                ["OS",       osInfo.os_pretty || osInfo.os_name || (isVM ? target?.os : "\u2014") || "\u2014"],
                ["Kernel",   osInfo.kernel || "\u2014"],
                ["Arch",     osInfo.arch || "\u2014"],
                ["Hostname", osInfo.hostname || "\u2014"],
                ["Load Avg", !isVM && m.load ? String(m.load) : null],
              ].filter(([,v])=>v && v!=="\u2014" && v!==null).slice(0,4).map(([l,v])=>(
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

      {/* Hardware Tab */}
      {tab==="hardware"&&!isVM&&(()=>{
        const hw = m.hardware || {};
        const HwRow=({label,value,sub,color})=>(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
            padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
            <div style={{color:T.muted,fontSize:12,fontWeight:500,minWidth:180}}>{label}</div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:color||T.text}}>{value||"\u2014"}</div>
              {sub&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div>}
            </div>
          </div>
        );
        const HwCard=({title,icon,children})=>(
          <div className="card" style={{padding:16}}>
            <div style={{fontWeight:700,fontSize:12,color:T.sub,marginBottom:10,
              display:"flex",alignItems:"center",gap:6}}>
              <span>{icon}</span>{title}
            </div>
            {children}
          </div>
        );

        const noData = !hw.cpu_model && !hw.ram_total_gb;

        return (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {noData&&(
              <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,
                padding:"12px 16px",fontSize:12,color:"#9a3412"}}>
                ⚠ Hardware data not yet collected. Click <strong>↻ Refresh</strong> to collect hardware inventory.
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>

              {/* CPU Card */}
              <HwCard title="CPU / Processor" icon="\u26A1">
                <HwRow label="Model" value={hw.cpu_model} />
                <HwRow label="Architecture" value={hw.cpu_arch} />
                <HwRow label="Sockets" value={hw.cpu_sockets} />
                <HwRow label="Physical Cores" value={hw.cpu_physical_cores}
                  sub={hw.cpu_sockets&&hw.cpu_cores_per_socket ? `${hw.cpu_sockets} socket × ${hw.cpu_cores_per_socket} cores` : null} color={T.blue}/>
                <HwRow label="Threads per Core" value={hw.cpu_threads_per_core}
                  sub="Hyper-Threading multiplier"/>
                <HwRow label="Total vCPU Capacity" value={hw.cpu_vcpu_capacity}
                  sub={`Physical cores × threads = ${hw.cpu_physical_cores||0} × ${hw.cpu_threads_per_core||1}`}
                  color={T.blue}/>
                {hw.cpu_logical&&<HwRow label="Logical CPUs (OS)" value={hw.cpu_logical}
                  sub="As seen by OS (/proc/cpuinfo)"/>}
                {hw.cpu_mhz&&<HwRow label="CPU Speed" value={`${parseFloat(hw.cpu_mhz||0).toFixed(0)} MHz`}/>}
                {(()=>{
                  // vCPU allocation from running VMs
                  const vms = hostData?.vms || [];
                  const allocVcpu = vms.filter(v=>v.status==="running")
                                       .reduce((s,v)=>s+(v.vcpu||0),0);
                  const totalVcpu = hw.cpu_vcpu_capacity || hw.cpu_logical || 0;
                  const freeVcpu  = Math.max(0, totalVcpu - allocVcpu);
                  const usePct    = totalVcpu > 0 ? Math.min(100, Math.round(allocVcpu/totalVcpu*100)) : 0;
                  if (!totalVcpu) return null;
                  return (<>
                    <HwRow label="vCPU Allocated (running VMs)"
                      value={`${allocVcpu} vCPUs`}
                      sub={`${vms.filter(v=>v.status==="running").length} running VMs`}
                      color={usePct>85?T.red:usePct>65?T.amber:T.text}/>
                    <HwRow label="vCPU Free"
                      value={`${freeVcpu} vCPUs`}
                      sub={`${100-usePct}% available`}
                      color={T.green}/>
                    <div style={{marginTop:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginBottom:4}}>
                        <span>vCPU Utilization</span><span>{usePct}%</span>
                      </div>
                      <div style={{height:8,background:"#f1f5f9",borderRadius:4}}>
                        <div style={{height:8,borderRadius:4,transition:"width .4s",
                          width:`${usePct}%`,
                          background:usePct>85?T.red:usePct>65?T.amber:T.green}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted,marginTop:3}}>
                        <span>{allocVcpu} allocated</span><span>{freeVcpu} free of {totalVcpu}</span>
                      </div>
                    </div>
                  </>);
                })()}
              </HwCard>

              {/* Memory Card */}
              <HwCard title="Memory / RAM" icon="\uD83E\uDDE0">
                <HwRow label="Total Physical RAM"
                  value={hw.ram_total_gb ? `${hw.ram_total_gb} GB` : "\u2014"}
                  color={T.blue}/>
                <HwRow label="RAM In Use"
                  value={hw.ram_total_gb ? `${(hw.ram_total_gb * (m.ram||0) / 100).toFixed(1)} GB` : "\u2014"}
                  sub={`${m.ram||0}% utilization`} color={m.ram>85?T.red:m.ram>65?T.amber:T.text}/>
                <HwRow label="RAM Free"
                  value={hw.ram_total_gb ? `${(hw.ram_total_gb * (1-(m.ram||0)/100)).toFixed(1)} GB` : "\u2014"}
                  color={T.green}/>
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginBottom:4}}>
                    <span>RAM Utilization</span><span>{m.ram||0}%</span>
                  </div>
                  <div style={{height:8,background:"#f1f5f9",borderRadius:4}}>
                    <div style={{height:8,borderRadius:4,transition:"width .4s",
                      width:`${Math.min(100,m.ram||0)}%`,
                      background:m.ram>85?T.red:m.ram>65?T.amber:T.green}}/>
                  </div>
                </div>
              </HwCard>

              {/* Storage Card */}
              <HwCard title="Local Storage" icon="\uD83D\uDCBE">
                <HwRow label="Total Local Storage"
                  value={hw.local_storage_total_gb ? `${hw.local_storage_total_gb} GB` : "\u2014"}
                  color={T.blue}/>
                <HwRow label="Used"
                  value={hw.local_storage_used_gb != null ? `${hw.local_storage_used_gb} GB` : "\u2014"}
                  sub={hw.local_storage_total_gb ? `${Math.round(hw.local_storage_used_gb/hw.local_storage_total_gb*100)}% of total` : null}
                  color={T.amber}/>
                <HwRow label="Free"
                  value={hw.local_storage_total_gb ? `${(hw.local_storage_total_gb - (hw.local_storage_used_gb||0)).toFixed(1)} GB` : "\u2014"}
                  color={T.green}/>
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginBottom:4}}>
                    <span>Storage Utilization</span>
                    <span>{hw.local_storage_total_gb ? Math.round((hw.local_storage_used_gb||0)/hw.local_storage_total_gb*100) : 0}%</span>
                  </div>
                  <div style={{height:8,background:"#f1f5f9",borderRadius:4}}>
                    <div style={{height:8,borderRadius:4,transition:"width .4s",
                      width:`${hw.local_storage_total_gb ? Math.min(100,Math.round((hw.local_storage_used_gb||0)/hw.local_storage_total_gb*100)) : 0}%`,
                      background:T.red}}/>
                  </div>
                </div>
              </HwCard>

              {/* System Summary Card */}
              <HwCard title="System Summary" icon="\uD83D\uDDA7">
                <HwRow label="Hostname"   value={osInfo.hostname}/>
                <HwRow label="OS"         value={osInfo.os_pretty||osInfo.os_name}/>
                <HwRow label="Kernel"     value={osInfo.kernel}/>
                <HwRow label="Uptime"     value={m.uptime}/>
                <HwRow label="Load Avg"   value={m.load} sub="1-minute load average"/>
                <HwRow label="CPU Usage"  value={`${m.cpu||0}%`}
                  color={m.cpu>85?T.red:m.cpu>65?T.amber:T.green}/>
              </HwCard>

            </div>
          </div>
        );
      })()}

      {/* NICs Tab */}
      {tab==="nics"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Network Interfaces ({(nics||[]).filter(n=>n&&typeof n==="object").length})</div>
            <div style={{fontSize:11,color:T.muted}}>RX/TX bars show relative utilization vs peak</div>
          </div>
          {(()=>{
            const validNics=(nics||[]).filter(n=>n&&typeof n==="object"&&(n.name||n.mac||n.ipv4));
            if(validNics.length===0) return (
              <div style={{textAlign:"center",color:T.muted,padding:"30px 0"}}>
                No NIC data — click ↻ Refresh to collect
              </div>
            );
            return validNics.map((n,i)=>{
              try { return <NicRow key={(n.name||n.mac||"nic")+"-"+i} n={n}/>; }
              catch(e) { return (
                <div key={i} style={{padding:"8px",color:T.muted,fontSize:11,borderBottom:"1px solid #f1f5f9"}}>
                  NIC {i+1}: {n.name||n.mac||"unknown"} — {n.ipv4||"no IP"}
                </div>
              ); }
            });
          })()}
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
                <span style={{fontSize:16}}>{patch.status==="UP TO DATE"?"\u2705":patch.status==="CRITICAL UPDATE"?"\uD83D\uDEA8":"\u26A0\uFE0F"}</span>
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
                  <span style={{color:T.muted,minWidth:60,fontFamily:"IBM Plex Mono"}}>{toISTTime(l.ts)}</span>
                  <span style={{minWidth:14,color:lc,fontWeight:700}}>
                    {l.level==="ERROR"?"\u2715":l.level==="WARN"?"\u26A0":"\u2713"}
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
        osType={isVM ? (sel.vm?.os_type||sel.vm?.hypervisor==="Hyper-V"?"windows":"linux") : (target?.os_type||"linux")}
        onClose={()=>setVulnModal(false)}/>}
    </div>
  );
}

// ── Change Discom Group Modal ─────────────────────────────────────────────────
function ChangeGroupModal({host, existingGroups=[], onClose, onSaved}) {
  const [group, setGroup] = useState(host.group||"Default");
  const [newGroup, setNewGroup] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const allGroups = [...new Set([...existingGroups,"Default"])].sort();

  const save = async () => {
    const g = (addingNew ? newGroup : group).trim();
    if (!g) return setMsg({t:"e", text:"Group name cannot be empty"});
    setBusy(true); setMsg(null);
    try {
      await api.patch(`/hosts/${host.id}/group`, {group: g});
      setMsg({t:"ok", text:`Moved to "${g}"`});
      setTimeout(onSaved, 1000);
    } catch(e) {
      setMsg({t:"e", text: e.response?.data?.detail || "Failed to update group"});
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:420}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Move Host to Discom Group</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>{host.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:4}}>
            Current group: <strong style={{color:T.blue}}>{host.group||"Default"}</strong>
          </div>
          {!addingNew?(
            <div style={{display:"flex",gap:8}}>
              <select value={group} onChange={e=>setGroup(e.target.value)} style={{flex:1}}>
                {allGroups.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAddingNew(true)}>+ New</button>
            </div>
          ):(
            <div style={{display:"flex",gap:8}}>
              <input autoFocus value={newGroup} placeholder="New Discom group name..."
                onChange={e=>setNewGroup(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setAddingNew(false);}}
                style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAddingNew(false)}>←</button>
            </div>
          )}
        </div>
        {msg&&<div style={{padding:"8px 12px",borderRadius:6,fontSize:12,marginBottom:8,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy?<><span className="spinner"/>Saving...</>:"Move Host"}
          </button>
        </div>
      </div>
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
  const [physicalOsTab,setPhysicalOsTab] = useState("linux"); // "linux" | "windows"
  const [vmOsTab,setVmOsTab]     = useState("linux"); // "linux" | "windows"
  const [expanded,setExpanded]   = useState({});
  // ── Discom Group state ───────────────────────────────────────────────────
  const [selectedGroup,setSelectedGroup] = useState("All");   // "All" or group name
  const [changeGroupHost,setChangeGroupHost] = useState(null); // {id, name, group}
  const [allGroups,setAllGroups] = useState([]);

  // Load groups and keep in sync with hosts
  const loadGroups = async () => {
    try {
      const r = await api.get("/groups");
      setAllGroups(r.data || []);
    } catch(e) {}
  };
  useEffect(()=>{ loadGroups(); },[rawHosts.length]); // eslint-disable-line

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

  const editVmIp = async (vm, hostId) => {
    const current = vm.ip && vm.ip !== "N/A" ? vm.ip : "";
    const newIp = window.prompt(
      `Edit IP for ${vm.name}:`,
      current
    );
    if (newIp !== null && newIp.trim()) {
      try {
        await api.patch(`/hosts/${hostId}/vms/${vm.id}/ip`, {ip: newIp.trim()});
        // Update local cache immediately
        setHostCache(c => {
          const host = c[hostId];
          if (!host) return c;
          return {...c, [hostId]: {...host,
            vms: (host.vms||[]).map(v => v.id===vm.id ? {...v, ip: newIp.trim()} : v)
          }};
        });
        onGlobalReload();
      } catch(e) { alert("Failed: " + (e.response?.data?.detail||e.message)); }
    }
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
  // Hosts filtered by selected Discom group
  const groupedHosts = selectedGroup==="All"
    ? rawHosts
    : rawHosts.filter(h=>(h.group||"Default")===selectedGroup);

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
          <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={{fontWeight:700,fontSize:13}}>🏢 Infrastructure</div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add Host</button>
            </div>
            {/* Discom Group Dropdown */}
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:T.muted,fontWeight:600,whiteSpace:"nowrap"}}>Discom:</span>
              <select value={selectedGroup} onChange={e=>{setSelectedGroup(e.target.value);setSel(null);}}
                style={{flex:1,fontSize:11,padding:"4px 6px",borderRadius:6,border:`1px solid ${T.border}`}}>
                <option value="All">All Groups ({rawHosts.length})</option>
                {allGroups.map(g=>(
                  <option key={g} value={g}>{g} ({rawHosts.filter(h=>(h.group||"Default")===g).length})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Physical / VM Groups tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:"#f8fafc"}}>
            {[["physical","🖧 Physical",groupedHosts.length],
              ["vms","🖥 VM Groups",groupedHosts.reduce((a,h)=>{const d=hostCache[h.id];return a+(d?.vms||h.vms||[]).length;},0)]
            ].map(([id,label,count])=>(
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
                {/* Linux / Windows sub-tabs */}
                <div style={{display:"flex",gap:0,marginBottom:6,borderRadius:7,overflow:"hidden",border:`1px solid ${T.border}`}}>
                  {[["linux","🐧 Linux",groupedHosts.filter(h=>h.os_type!=="windows").length],
                    ["windows","🪟 Windows",groupedHosts.filter(h=>h.os_type==="windows").length]
                  ].map(([key,label,cnt])=>(
                    <button key={key} onClick={()=>setPhysicalOsTab(key)}
                      style={{flex:1,padding:"5px 4px",fontSize:10,fontWeight:physicalOsTab===key?700:400,
                        border:"none",cursor:"pointer",
                        background:physicalOsTab===key?(key==="linux"?"#f0fdf4":"#eff6ff"):"#f8fafc",
                        color:physicalOsTab===key?(key==="linux"?"#16a34a":T.blue):T.muted,
                        borderRight:key==="linux"?`1px solid ${T.border}`:"none"}}>
                      {label} <span style={{fontSize:9,background:physicalOsTab===key?(key==="linux"?"#dcfce7":"#dbeafe"):T.border,
                        borderRadius:8,padding:"1px 5px",marginLeft:2}}>{cnt}</span>
                    </button>
                  ))}
                </div>
                {/* Filtered hosts by OS sub-tab */}
                {groupedHosts.filter(h=>physicalOsTab==="windows"?h.os_type==="windows":h.os_type!=="windows").length===0&&(
                  <div style={{padding:"20px 10px",textAlign:"center",color:T.muted,fontSize:11}}>
                    No {physicalOsTab==="windows"?"Windows":"Linux"} hosts in {selectedGroup==="All"?"any group":selectedGroup}
                  </div>
                )}
                {groupedHosts.filter(h=>physicalOsTab==="windows"?h.os_type==="windows":h.os_type!=="windows").map(h=>{
                  const det=hostCache[h.id];
                  const vms=det?.vms||h.vms||[];
                  const m=(det||h).metrics||{};
                  const isExp=expanded[h.id];
                  const isSel=sel?.type==="host"&&sel.hostId===h.id;
                  const isOnline=m.source==="live";
                  const isWin=h.os_type==="windows";
                  const grp=h.group||"Default";
                  return (
                    <div key={h.id} style={{marginBottom:2}}>
                      <div className={`tree-row ${isSel?"sel":""}`} onClick={()=>clickHost(h.id)}>
                        <span style={{fontSize:15,flexShrink:0}}>{isWin?"🪟":"🐧"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                          <div style={{fontSize:10,color:T.muted,display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{fontFamily:"IBM Plex Mono",fontSize:9}}>{h.ip}</span>
                            {isOnline&&<><span style={{color:T.blue}}>CPU:{m.cpu}%</span><span style={{color:T.amber}}>RAM:{m.ram}%</span></>}
                            <span className={`badge ${isWin?"b-hv":"b-kvm"}`} style={{fontSize:8,padding:"0 4px"}}>{isWin?"Hyper-V":"KVM"}</span>
                            {selectedGroup==="All"&&<span style={{fontSize:8,background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"0 4px"}}>{grp}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0,alignItems:"center"}}>
                          {(loading===h.id||loading===h.id+"_vms")&&<span className="spinner" style={{width:10,height:10}}/>}
                          {isExp&&<button className="btn btn-ghost btn-sm" style={{padding:"2px 5px",fontSize:9}}
                            onClick={e=>refreshVMs(h.id,e)} title="Discover VMs">⟳</button>}
                          <span style={{fontSize:10,color:T.muted,cursor:"pointer",padding:"0 2px"}}
                            onClick={e=>{e.stopPropagation();setExpanded(ex=>({...ex,[h.id]:!ex[h.id]}));}}>{isExp?"▾":"▸"}</span>
                          <button title="Move to Discom group" onClick={e=>{e.stopPropagation();setChangeGroupHost({id:h.id,name:h.name,group:grp});}}
                            style={{fontSize:9,padding:"1px 4px",border:`1px solid ${T.border}`,borderRadius:3,
                              background:"transparent",color:T.muted,cursor:"pointer"}} >⇄</button>
                          <button className="btn btn-ghost btn-sm" style={{padding:"2px 4px",fontSize:9,color:T.red}}
                            onClick={e=>deleteHost(h.id,e)}>✕</button>
                        </div>
                      </div>
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
                                      <button title="Edit VM IP" onClick={()=>editVmIp(vm,h.id)}
                                        style={{fontSize:9,padding:"1px 5px",border:`1px solid ${T.muted}44`,
                                          borderRadius:3,background:"transparent",color:T.muted,cursor:"pointer"}}>✎</button>
                                      {alreadyAdded
                                        ?<span title="Already in Physical Hosts" style={{fontSize:9,color:T.green,
                                            padding:"1px 4px",border:`1px solid ${T.green}44`,borderRadius:3}}>✓</span>
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
                {/* Linux / Windows sub-tabs for VM Groups */}
                <div style={{display:"flex",gap:0,marginBottom:6,borderRadius:7,overflow:"hidden",border:`1px solid ${T.border}`}}>
                  {[["linux","🐧 Linux VMs",groupedHosts.filter(h=>h.os_type!=="windows")],
                    ["windows","🪟 Windows VMs",groupedHosts.filter(h=>h.os_type==="windows")]
                  ].map(([key,label,filteredHosts])=>{
                    const vmCount=filteredHosts.reduce((acc,h)=>{const det=hostCache[h.id];return acc+(det?.vms||h.vms||[]).length;},0);
                    return (
                      <button key={key} onClick={()=>setVmOsTab(key)}
                        style={{flex:1,padding:"5px 4px",fontSize:10,fontWeight:vmOsTab===key?700:400,
                          border:"none",cursor:"pointer",
                          background:vmOsTab===key?(key==="linux"?"#f0fdf4":"#eff6ff"):"#f8fafc",
                          color:vmOsTab===key?(key==="linux"?"#16a34a":T.blue):T.muted,
                          borderRight:key==="linux"?`1px solid ${T.border}`:"none"}}>
                        {label} <span style={{fontSize:9,background:vmOsTab===key?(key==="linux"?"#dcfce7":"#dbeafe"):T.border,
                          borderRadius:8,padding:"1px 5px",marginLeft:2}}>{vmCount}</span>
                      </button>
                    );
                  })}
                </div>
                {groupedHosts.filter(h=>vmOsTab==="windows"?h.os_type==="windows":h.os_type!=="windows").filter(h=>{
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
                        {selectedGroup==="All"&&<span style={{fontSize:8,background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"0 3px",fontWeight:400}}>{h.group||"Default"}</span>}
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
                                  <button title="Edit VM IP" onClick={()=>editVmIp(vm,h.id)}
                                    style={{fontSize:9,padding:"1px 5px",border:`1px solid ${T.muted}44`,
                                      borderRadius:3,background:"transparent",color:T.muted,cursor:"pointer"}}>✎</button>
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
                {rawHosts.filter(h=>vmOsTab==="windows"?h.os_type==="windows":h.os_type!=="windows").filter(h=>{const det=hostCache[h.id];return (det?.vms||h.vms||[]).length>0;}).length===0&&(
                  <div style={{padding:"30px 10px",textAlign:"center",color:T.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>{vmOsTab==="windows"?"🪟":"🖥"}</div>
                    <div style={{fontSize:12}}>No {vmOsTab==="windows"?"Windows":"Linux"} VMs discovered yet</div>
                    <div style={{fontSize:11,marginTop:4}}>Click ⟳ on a {vmOsTab==="windows"?"Windows":"Linux"} physical host to discover</div>
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

      {showAdd&&<AddHostModal
        onClose={()=>setShowAdd(false)}
        onAdded={()=>{onGlobalReload();loadGroups();setShowAdd(false);}}
        existingGroups={allGroups}/>}
      {promoteVM&&<PromoteVMModal
        vm={promoteVM.vm} hostId={promoteVM.hostId}
        onClose={()=>setPromoteVM(null)}
        onAdded={()=>{onGlobalReload();setPromoteVM(null);}}/>}
      {changeGroupHost&&<ChangeGroupModal
        host={changeGroupHost}
        existingGroups={allGroups}
        onClose={()=>setChangeGroupHost(null)}
        onSaved={()=>{onGlobalReload();loadGroups();setChangeGroupHost(null);}}/>}
    </div>
  );
}

function Overview({hosts,summary,history,onNavigate}) {
  const [selHost,setSelHost]=useState(null);
  const host=selHost?hosts.find(h=>h.id===selHost):null;
  const m=host?.metrics||{};
  const stor=m.storage||[];
  const ports=m.active_ports||[];
  const liveCount = hosts.filter(h=>h.metrics?.source==="live").length;

  const kpis = [
    { label:"Hosts",   value:summary.hosts,                     color:T.blue,  to:"infra",  linkLabel:"Open Infrastructure" },
    { label:"VMs",     value:summary.total_vms,                 color:T.cyan,  to:"infra",  linkLabel:"Open Infrastructure" },
    { label:"Avg CPU", value:`${summary.avg_cpu}%`,             color:summary.avg_cpu>80?T.red:T.green },
    { label:"Warnings",value:summary.warnings,                  color:summary.warnings>0?T.amber:T.green, to:"alerts", linkLabel:"Open Alerts" },
    { label:"Live",    value:liveCount,                         color:T.green, to:"infra",  linkLabel:"Open Infrastructure" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Global KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {kpis.map(k=>(
          <div key={k.label} className="card shadow">
            <KPI
              label={k.label}
              value={k.value}
              color={k.color}
              onClick={k.to && onNavigate ? ()=>onNavigate(k.to) : undefined}
              linkLabel={k.linkLabel}
            />
          </div>
        ))}
      </div>

      {/* Host selector */}
      <div className="card shadow" style={{padding:14}}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:600,color:T.sub}}>Drill down:</span>
          <button className={`btn ${!selHost?"btn-primary":"btn-ghost"}`} onClick={()=>setSelHost(null)}>All Hosts</button>
          {hosts.map(h=>(
            <button key={h.id} className={`btn ${selHost===h.id?"btn-primary":"btn-ghost"}`}
              onClick={()=>setSelHost(h.id)}>{h.os_type==="linux"?"\uD83D\uDC27":"\uD83E\uDE9F"} {h.name}</button>
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
                  <td style={{fontWeight:600}}>{h.os_type==="linux"?"\uD83D\uDC27":"\uD83E\uDE9F"} {h.name}</td>
                  <td><code style={{fontSize:11}}>{h.ip}</code></td>
                  <td style={{fontSize:11}}>{o.os_pretty||"\u2014"}</td>
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
                    <td style={{fontWeight:600}}>{vm.name}</td>
                    <td><span className={`badge ${vm.hypervisor==="KVM"?"b-kvm":"b-hv"}`}>{vm.hypervisor}</span></td>
                    <td><StatusDot s={vm.status}/>{vm.status}</td>
                    <td style={{fontSize:11,color:T.sub}}>{vm.os||"\u2014"}</td>
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

// \u2500\u2500 Patches \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// \u2500\u2500 Capacity Planning \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function CapacityPlanning() {
  const [data,setData]         = useState([]);
  const [busy,setBusy]         = useState(false);
  const [err,setErr]           = useState("");
  const [sel,setSel]           = useState(null);
  const [hostFilter,setHostFilter] = useState("all");
  const [osTab,setOsTab]           = useState("linux");
  const [genReport,setGenReport]   = useState(false);
  const [groupFilter,setGroupFilter] = useState("All");  // Discom group filter
  const [capGroups,setCapGroups]     = useState([]);     // all groups from API
  const [mailOpen,setMailOpen]       = useState(false);
  const [sendingMail,setSendingMail] = useState(false);
  const [mailMsg,setMailMsg]         = useState(null);
  const [mailForm,setMailForm]       = useState({ discom:"All", os_type:"linux", to_email:"" });

  useEffect(()=>{
    api.get("/groups").then(r=>setCapGroups(r.data||[])).catch(()=>{});
  },[]);

  const openMailDialog = () => {
    setMailMsg(null);
    setMailForm({
      discom: groupFilter === "All" ? "All" : groupFilter,
      os_type: osTab,
      to_email: "",
    });
    setMailOpen(true);
  };

  const sendMailReport = async () => {
    if (!mailForm.to_email) {
      setMailMsg({t:"e", text:"Recipient email is required"});
      return;
    }
    setSendingMail(true); setMailMsg(null);
    try {
      const pdfPack = await generateReport("pdf-email");
      const payload = {
        ...mailForm,
        pdf_data_uri: pdfPack?.dataUri || "",
        filename: pdfPack?.filename || "",
      };
      const r = await api.post("/capacity/email-report", payload);
      setMailMsg({t:"ok", text:r.data?.message || "Mail sent"});
      setTimeout(()=>setMailOpen(false), 1200);
    } catch(e) {
      setMailMsg({t:"e", text:e.response?.data?.detail || e.message || "Failed to send mail"});
    }
    setSendingMail(false);
  };

  const selectedHost = sel ? data.find(h=>h.host_id===sel) || null : null;
  const gb = v => { const x=Number(v); return Number.isFinite(x)&&x>0?`${x} GB`:"—"; };
  const txt = v => (v==null||v===""||v===undefined) ? "—" : String(v);
  const StatCard = ({label,value,sub,color}) => (
    <div className="card" style={{padding:14}}>
      <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:color||T.text}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>{sub}</div>}
    </div>
  );

  const load = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.get("/capacity");
      setData(Array.isArray(r.data) ? r.data : []);
    } catch(e) {
      setData([]);
      setErr(e.response?.data?.detail || e.message || "Failed to load capacity data");
    }
    setBusy(false);
  };
  useEffect(()=>{ load(); },[]);

  const CommitBar = ({pct,warn=80,crit=100}) => {
    const color = pct>=crit ? T.red : pct>=warn ? T.amber : T.green;
    return (
      <div style={{height:6,background:"#f1f5f9",borderRadius:3,minWidth:60}}>
        <div style={{height:6,borderRadius:3,transition:"width .3s",
          width:`${Math.min(100,pct||0)}%`,background:color}}/>
      </div>
    );
  };

  const n = v => { const x=Number(v); return Number.isFinite(x)?x:0; };

  var generateReport = async function(format) {
    var rData = displayData;
    var ts = new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"});
    var osLabel = osTab === "linux" ? "Linux" : "Windows";
    var groupLabel = groupFilter === "All" ? "All Discoms" : groupFilter;
    var fileSlug = (groupFilter==="All"?"all":groupFilter.replace(/[^a-z0-9]/gi,"-").toLowerCase());

    // ── Load logo ────────────────────────────────────────────────────────────
    var logoBase64 = null;
    try {
      var imgRes = await fetch("/logo.jpg");
      var imgBlob = await imgRes.blob();
      logoBase64 = await new Promise(function(res) {
        var r = new FileReader();
        r.onloadend = function(){ res(r.result); };
        r.readAsDataURL(imgBlob);
      });
    } catch(e) {}

    if (format === "pdf" || format === "pdf-email") {
      // ── PDF generation via jsPDF + autoTable ────────────────────────────
      var jsPDFLib = await import("jspdf");
      var autoTable = (await import("jspdf-autotable")).default;
      var jsPDF = jsPDFLib.jsPDF || jsPDFLib.default;
      var doc = new jsPDF({orientation:"landscape", unit:"mm", format:"a4"});
      var PW = 297, PH = 210; // A4 landscape

      // ── Colour palette ───────────────────────────────────────────────────
      var COL = {
        navy:   [15,  31,  46],
        blue:   [29, 123, 255],
        green:  [22, 163,  74],
        amber:  [245,158, 11],
        red:    [220,  38,  38],
        purple: [124, 58, 237],
        white:  [255,255,255],
        lgrey:  [245,248,252],
        mgrey:  [148,163,184],
        dgrey:  [55,  65,  81],
        border: [226,232,240],
      };

      // ── Helpers ──────────────────────────────────────────────────────────
      var setFill = function(c){ doc.setFillColor(c[0],c[1],c[2]); };
      var setTxt  = function(c){ doc.setTextColor(c[0],c[1],c[2]); };
      var setDraw = function(c){ doc.setDrawColor(c[0],c[1],c[2]); };

      // Draw a horizontal utilisation bar
      // x,y = top-left, w=width, h=height, pct=0-100, colour
      var drawBar = function(x, y, w, h, pct, col) {
        // Background track
        setFill(COL.lgrey);
        setDraw(COL.border);
        doc.roundedRect(x, y, w, h, 0.8, 0.8, "FD");
        // Fill
        var fillW = Math.max(0, Math.min(w, w * pct / 100));
        if(fillW > 0) {
          setFill(col);
          doc.roundedRect(x, y, fillW, h, 0.8, 0.8, "F");
        }
      };

      // KPI summary card
      var drawKPI = function(x, y, w, h, label, value, sub, col) {
        setFill(COL.white);
        setDraw(COL.border);
        doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
        // Colour accent bar on left
        setFill(col);
        doc.roundedRect(x, y, 2.5, h, 1, 1, "F");
        setTxt(COL.mgrey);
        doc.setFontSize(6);
        doc.setFont("helvetica","normal");
        doc.text(label.toUpperCase(), x+5, y+5);
        setTxt(col);
        doc.setFontSize(14);
        doc.setFont("helvetica","bold");
        doc.text(String(value), x+5, y+11.5);
        setTxt(COL.mgrey);
        doc.setFontSize(6);
        doc.setFont("helvetica","normal");
        doc.text(sub, x+5, y+16);
      };

      // ── PAGE 1: Cover / Summary ──────────────────────────────────────────

      // Dark header bar
      setFill(COL.navy);
      doc.rect(0, 0, PW, 28, "F");
      // Blue accent line under header
      setFill(COL.blue);
      doc.rect(0, 28, PW, 1.5, "F");

      // Logo
      if(logoBase64) {
        try { doc.addImage(logoBase64, "JPEG", 5, 3, 22, 22); } catch(e){}
      }

      // Title
      setTxt(COL.white);
      doc.setFontSize(18);
      doc.setFont("helvetica","bold");
      doc.text("ServerCapacity - Capacity Report", 38, 9);
      doc.setFontSize(8);
      doc.setFont("helvetica","normal");
      doc.text("Discom: " + groupLabel + ", OS: " + osLabel + ", Hosts: " + rData.length + ", Generated: " + ts + " IST", 38, 16);

      // Sub-header line
      doc.setFillColor(0, 123, 255);
      doc.rect(0, 22, 297, 1.2, "F");

      // Table
      var headers = ["Host","CPU Model","vCPU Total","vCPU Used","vCPU Free",
                     "RAM Total (GB)","RAM Used (GB)","RAM Free (GB)",
                     "Disk Total (GB)","Disk Used (GB)","Disk Free (GB)","VMs"];
      var rows = rData.map(function(h) {
        return [
          h.host_name + (h.host_ip ? "\n" + h.host_ip : ""),
          h.cpu_model || "—",
          String(h.cpu_vcpus || 0),
          String(h.vm_vcpu_alloc || 0),
          String(h.free_vcpus != null ? h.free_vcpus : 0),
          String(h.ram_total_gb || 0),
          String(h.vm_ram_alloc_gb || 0),
          String(h.free_ram_gb != null ? h.free_ram_gb : 0),
          String(h.disk_total_gb || 0),
          String(h.disk_used_gb != null ? h.disk_used_gb : 0),
          String(h.free_disk_gb != null ? h.free_disk_gb : 0),
          String(h.vm_count || 0),
        ];
      });

      // Totals summary row
      var tot = rData.reduce(function(a,h){
        return {
          vcpus:      a.vcpus      + Number(h.cpu_vcpus||0),
          vcpu_alloc: a.vcpu_alloc + Number(h.vm_vcpu_alloc||0),
          free_vcpus: a.free_vcpus + Number(h.free_vcpus||0),
          ram:        a.ram        + Number(h.ram_total_gb||0),
          ram_used:   a.ram_used   + Number(h.vm_ram_alloc_gb||0),
          free_ram:   a.free_ram   + Number(h.free_ram_gb||0),
          disk:       a.disk       + Number(h.disk_total_gb||0),
          disk_used:  a.disk_used  + Number(h.disk_used_gb||0),
          free_disk:  a.free_disk  + Number(h.free_disk_gb||0),
          vms:        a.vms        + Number(h.vm_count||0),
        };
      },{vcpus:0,vcpu_alloc:0,free_vcpus:0,ram:0,ram_used:0,free_ram:0,disk:0,disk_used:0,free_disk:0,vms:0});

      var vcpuPct  = tot.vcpus  ? Math.round(tot.vcpu_alloc/tot.vcpus*100)  : 0;
      var ramPct   = tot.ram    ? Math.round(tot.ram_used/tot.ram*100)       : 0;
      var diskPct  = tot.disk   ? Math.round(tot.disk_used/tot.disk*100)     : 0;

      // ── KPI Summary Cards ────────────────────────────────────────────────
      var kpiY = 33, kpiH = 20, kpiGap = 3;
      var kpiW = (PW - 10 - kpiGap*6) / 7;
      var kpis = [
        ["Total Hosts",  rData.length,                  "In this report",                 COL.navy],
        ["Total vCPUs",  tot.vcpus,                     vcpuPct+"% allocated",            COL.blue],
        ["vCPU Used",    tot.vcpu_alloc,                 tot.free_vcpus+" vCPUs free",     COL.purple],
        ["Total RAM",    tot.ram.toFixed(1)+" GB",       ramPct+"% allocated",             COL.amber],
        ["RAM Used",     tot.ram_used.toFixed(1)+" GB",  tot.free_ram.toFixed(1)+" GB free",COL.red],
        ["Total Disk",   tot.disk.toFixed(0)+" GB",      diskPct+"% used",                 COL.green],
        ["Total VMs",    tot.vms,                        "Across all hosts",               COL.blue],
      ];
      kpis.forEach(function(k, i) {
        drawKPI(5 + i*(kpiW+kpiGap), kpiY, kpiW, kpiH, k[0], k[1], k[2], k[3]);
      });

      // ── Utilisation Summary Bars ─────────────────────────────────────────
      var barSectY = kpiY + kpiH + 6;
      setTxt(COL.dgrey);
      doc.setFontSize(8);
      doc.setFont("helvetica","bold");
      doc.text("CLUSTER UTILISATION OVERVIEW", 5, barSectY);

      setFill(COL.border);
      doc.rect(5, barSectY+1, PW-10, 0.3, "F");

      var bY = barSectY + 6;
      var bW = 80, bH = 4.5;
      var summaryBars = [
        ["vCPU Allocation", vcpuPct, tot.vcpu_alloc+" of "+tot.vcpus+" vCPUs used",
          vcpuPct>=90?COL.red:vcpuPct>=75?COL.amber:COL.blue],
        ["RAM Allocation",  ramPct,  tot.ram_used.toFixed(1)+" of "+tot.ram.toFixed(1)+" GB used",
          ramPct>=90?COL.red:ramPct>=75?COL.amber:COL.amber],
        ["Disk Usage",      diskPct, tot.disk_used.toFixed(1)+" of "+tot.disk.toFixed(1)+" GB used",
          diskPct>=90?COL.red:diskPct>=75?COL.amber:COL.green],
      ];
      summaryBars.forEach(function(b, i) {
        var bx = 5 + i*(bW+15);
        setTxt(COL.dgrey);
        doc.setFontSize(7);
        doc.setFont("helvetica","bold");
        doc.text(b[0], bx, bY);
        drawBar(bx, bY+2, bW, bH, b[1], b[3]);
        setTxt(COL.mgrey);
        doc.setFontSize(6.5);
        doc.setFont("helvetica","normal");
        doc.text(b[2] + "  (" + b[1] + "%)", bx, bY+bH+5);
        // Percentage label on bar
        setTxt(COL.white);
        doc.setFontSize(6);
        if(b[1] > 15) {
          doc.text(b[1]+"%", bx+2, bY+2+bH-1);
        }
      });

      // ── Per-host mini bar chart section ─────────────────────────────────
      var chartY = bY + bH + 16;
      setTxt(COL.dgrey);
      doc.setFontSize(8);
      doc.setFont("helvetica","bold");
      doc.text("PER-HOST UTILISATION  (vCPU% \u2502 RAM% \u2502 Disk%)", 5, chartY);
      setFill(COL.border);
      doc.rect(5, chartY+1, PW-10, 0.3, "F");

      var chY = chartY + 5;
      var hostBarW = 18; // width for each host's set of 3 bars
      var barSetGap = 1;
      var singleH = 3.5;
      var maxHostsPerRow = Math.floor((PW-10)/(hostBarW+barSetGap));
      var hostsToChart = rData.slice(0, maxHostsPerRow*2); // up to 2 rows

      var row0 = hostsToChart.slice(0, maxHostsPerRow);
      var row1 = hostsToChart.slice(maxHostsPerRow, maxHostsPerRow*2);

      [row0, row1].forEach(function(rowHosts, ri) {
        rowHosts.forEach(function(h, ci) {
          var hx = 5 + ci*(hostBarW+barSetGap);
          var hy = chY + ri*18;
          var vcpuP = h.cpu_vcpus ? Math.min(100,Math.round(Number(h.vm_vcpu_alloc||0)/Number(h.cpu_vcpus)*100)) : 0;
          var ramP  = h.ram_total_gb ? Math.min(100,Math.round(Number(h.vm_ram_alloc_gb||0)/Number(h.ram_total_gb)*100)) : 0;
          var diskP = h.disk_total_gb ? Math.min(100,Math.round(Number(h.disk_used_gb||0)/Number(h.disk_total_gb)*100)) : 0;

          // Host name (truncated)
          setTxt(COL.dgrey);
          doc.setFontSize(5);
          doc.setFont("helvetica","bold");
          var hname = (h.host_name||"").length>12 ? (h.host_name||"").slice(0,11)+"\u2026" : (h.host_name||"");
          doc.text(hname, hx, hy);

          // 3 mini bars
          var barPcts = [vcpuP, ramP, diskP];
          var barCols = [
            vcpuP>=90?COL.red:vcpuP>=75?COL.amber:COL.blue,
            ramP>=90?COL.red:ramP>=75?COL.amber:COL.amber,
            diskP>=90?COL.red:diskP>=75?COL.amber:COL.green,
          ];
          var barLabels = ["C","R","D"];
          barPcts.forEach(function(p, bi) {
            var by = hy+1.5+bi*(singleH+1);
            // Label
            setTxt(COL.mgrey);
            doc.setFontSize(4.5);
            doc.setFont("helvetica","normal");
            doc.text(barLabels[bi], hx, by+singleH-0.5);
            // Bar
            drawBar(hx+3, by, hostBarW-3, singleH, p, barCols[bi]);
            // Pct text
            setTxt(COL.white);
            doc.setFontSize(4);
            if(p>20) doc.text(p+"%", hx+4, by+singleH-0.8);
          });
        });
      });

      // ── Footer on page 1 ─────────────────────────────────────────────────
      setTxt(COL.mgrey);
      doc.setFontSize(6.5);
      doc.setFont("helvetica","normal");
      doc.text(
        "ServerCapacity \u2014 " + groupLabel + " \u2014 Confidential  |  C=vCPU%  R=RAM%  D=Disk%  |  Page 1",
        5, PH-4
      );

      // ── PAGE 2: Detailed Data Table ──────────────────────────────────────
      doc.addPage();

      // Header on page 2
      setFill(COL.navy);
      doc.rect(0, 0, PW, 18, "F");
      setFill(COL.blue);
      doc.rect(0, 18, PW, 1, "F");
      if(logoBase64) {
        try { doc.addImage(logoBase64, "JPEG", 4, 1, 15, 15); } catch(e){}
      }
      setTxt(COL.white);
      doc.setFontSize(12);
      doc.setFont("helvetica","bold");
      doc.text("Host Details \u2014 " + groupLabel + " \u2502 " + osLabel, 23, 9);
      setTxt([148,163,184]);
      doc.setFontSize(7);
      doc.setFont("helvetica","normal");
      doc.text("Generated: " + ts + " IST  \u2502  Hosts: " + rData.length, 23, 15);

      // Data table
      var headers = [
        "Host","CPU Model",
        "vCPU\nTotal","vCPU\nUsed","vCPU\nFree",
        "RAM Total\n(GB)","RAM Used\n(GB)","RAM Free\n(GB)",
        "Disk Total\n(GB)","Disk Used\n(GB)","Disk Free\n(GB)","VMs"
      ];
      var rows = rData.map(function(h) {
        var vcpuP = h.cpu_vcpus ? Math.round(Number(h.vm_vcpu_alloc||0)/Number(h.cpu_vcpus)*100) : 0;
        var ramP  = h.ram_total_gb ? Math.round(Number(h.vm_ram_alloc_gb||0)/Number(h.ram_total_gb)*100) : 0;
        var diskP = h.disk_total_gb ? Math.round(Number(h.disk_used_gb||0)/Number(h.disk_total_gb)*100) : 0;
        return [
          h.host_name + "\n" + (h.host_ip||""),
          (h.cpu_model||"\u2014").replace(/\(R\)/g,"").replace(/\(TM\)/g,"").replace(/CPU/,"").trim().slice(0,35),
          String(h.cpu_vcpus||0),
          String(h.vm_vcpu_alloc||0) + "\n(" + vcpuP + "%)",
          String(h.free_vcpus!=null?h.free_vcpus:0),
          String(h.ram_total_gb||0),
          String(h.vm_ram_alloc_gb||0) + "\n(" + ramP + "%)",
          String(h.free_ram_gb!=null?h.free_ram_gb:0),
          String(h.disk_total_gb||0),
          String(h.disk_used_gb!=null?h.disk_used_gb:0) + "\n(" + diskP + "%)",
          String(h.free_disk_gb!=null?h.free_disk_gb:0),
          String(h.vm_count||0),
        ];
      });

      // Totals row
      rows.push([
        "TOTAL (" + rData.length + " hosts)", "",
        String(tot.vcpus),
        String(tot.vcpu_alloc)+"\n("+vcpuPct+"%)",
        String(tot.free_vcpus),
        tot.ram.toFixed(1),
        tot.ram_used.toFixed(1)+"\n("+ramPct+"%)",
        tot.free_ram.toFixed(1),
        tot.disk.toFixed(1),
        tot.disk_used.toFixed(1)+"\n("+diskPct+"%)",
        tot.free_disk.toFixed(1),
        String(tot.vms)
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 22,
        styles: { fontSize:6.5, cellPadding:2.5, lineColor:[226,232,240], lineWidth:0.2 },
        headStyles: { fillColor:COL.navy, textColor:255, fontStyle:"bold", fontSize:6.5,
                      halign:"center", cellPadding:3 },
        alternateRowStyles: { fillColor:[245,248,252] },
        columnStyles: {
          0:{cellWidth:30, fontStyle:"bold"},
          1:{cellWidth:42, fontSize:6},
          2:{cellWidth:14, halign:"center"},
          3:{cellWidth:16, halign:"center"},
          4:{cellWidth:14, halign:"center"},
          5:{cellWidth:18, halign:"right"},
          6:{cellWidth:18, halign:"right"},
          7:{cellWidth:18, halign:"right"},
          8:{cellWidth:18, halign:"right"},
          9:{cellWidth:18, halign:"right"},
          10:{cellWidth:18, halign:"right"},
          11:{cellWidth:12, halign:"center"},
        },
        didDrawPage: function(d) {
          setTxt(COL.mgrey);
          doc.setFontSize(6.5);
          doc.setFont("helvetica","normal");
          var pg = doc.internal.getCurrentPageInfo().pageNumber;
          doc.text("ServerCapacity - " + groupLabel + " - Confidential, Page " + pg, 14, doc.internal.pageSize.height - 6);
        },
        willDrawCell: function(d) {
          // Highlight overcommitted cells (>100% allocation)
          var txt = String(d.cell.raw||"");
          var pctMatch = txt.match(/\((\d+)%\)/);
          if(pctMatch) {
            var pct = parseInt(pctMatch[1]);
            if(pct >= 100)      d.cell.styles.fillColor = [254,226,226];
            else if(pct >= 80)  d.cell.styles.fillColor = [254,243,199];
          }
          // Totals row
          if(d.row.index === rows.length - 1) {
            d.cell.styles.fillColor = COL.navy;
            d.cell.styles.textColor = [255,255,255];
            d.cell.styles.fontStyle = "bold";
          }
        },
      });

      var pdfName = "ServerCapacity-" + fileSlug + "-" + osLabel + "-" + new Date().toISOString().slice(0,10) + ".pdf";
      if (format === "pdf-email") {
        return { filename: pdfName, dataUri: doc.output("datauristring") };
      }
      doc.save(pdfName);

    } else if (format === "excel") {
      // ── Excel generation via SheetJS ─────────────────────────────────────
      var XLSX = await import("xlsx");
      var wb = XLSX.utils.book_new();

      var headers = ["Host","IP","Discom Group","CPU Model","vCPU Total","vCPU Used","vCPU Free",
                     "RAM Total (GB)","RAM Used (GB)","RAM Free (GB)",
                     "Disk Total (GB)","Disk Used (GB)","Disk Free (GB)","VMs"];
      var wsData = [
        ["ServerCapacity — Capacity Report — " + groupLabel],
        ["Generated: " + ts + " IST", "", "Discom: " + groupLabel, "OS Filter: " + osLabel],
        [],
        headers,
      ];
      rData.forEach(function(h) {
        wsData.push([
          h.host_name || "",
          h.host_ip || "",
          h.group || "Default",
          h.cpu_model || "",
          Number(h.cpu_vcpus || 0),
          Number(h.vm_vcpu_alloc || 0),
          Number(h.free_vcpus != null ? h.free_vcpus : 0),
          Number(h.ram_total_gb || 0),
          Number(h.vm_ram_alloc_gb || 0),
          Number(h.free_ram_gb != null ? h.free_ram_gb : 0),
          Number(h.disk_total_gb || 0),
          Number(h.disk_used_gb != null ? h.disk_used_gb : 0),
          Number(h.free_disk_gb != null ? h.free_disk_gb : 0),
          Number(h.vm_count || 0),
        ]);
      });
      // VM detail sheet
      var vmData = [["Host","Discom Group","VM Name","Status","vCPU","RAM (GB)","Disk (GB)","OS","IP"]];
      rData.forEach(function(h) {
        (h.vms || []).forEach(function(vm) {
          vmData.push([h.host_name, h.group||"Default", vm.name, vm.status||"", vm.vcpus||0, (vm.ram_mb||0)/1024, vm.disk_gb||0, vm.os||"", vm.ip||""]);
        });
      });

      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{wch:22},{wch:15},{wch:14},{wch:30},{wch:12},{wch:12},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:8}];
      ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:13}}];
      XLSX.utils.book_append_sheet(wb, ws, "Capacity Summary");

      var ws2 = XLSX.utils.aoa_to_sheet(vmData);
      XLSX.utils.book_append_sheet(wb, ws2, "VM Details");

      XLSX.writeFile(wb, "ServerCapacity-" + fileSlug + "-" + osLabel + "-" + new Date().toISOString().slice(0,10) + ".xlsx");
    }
  };

  const hostOptions  = data.map(h=>({ id:h.host_id, name:h.host_name }));
  // Apply Discom group filter first, then host-level filter, then OS tab filter
  const groupFilteredData = groupFilter==="All" ? data : data.filter(h=>(h.group||"Default")===groupFilter);
  const filteredData = hostFilter==="all" ? groupFilteredData : groupFilteredData.filter(h=>h.host_id===hostFilter);
  const osFilteredData = filteredData.filter(h => {
    const os = (h.os_name || h.os_type || "").toLowerCase();
    if (osTab === "windows") return os.includes("windows") || (h.os_type||"").toLowerCase()==="windows";
    return !os.includes("windows") && (h.os_type||"linux").toLowerCase()!=="windows";
  });
  const displayData = osFilteredData;

  // Aggregate totals across filtered hosts
  const totals = filteredData.reduce((a,h)=>({
    vcpus:      a.vcpus      + n(h.cpu_vcpus),
    vcpu_alloc: a.vcpu_alloc + n(h.vm_vcpu_alloc),
    ram:        a.ram        + n(h.ram_total_gb),
    ram_alloc:  a.ram_alloc  + n(h.vm_ram_alloc_gb),
    disk:       a.disk       + n(h.disk_total_gb),
    disk_used:  a.disk_used  + n(h.disk_used_gb),
    disk_alloc: a.disk_alloc + n(h.vm_disk_alloc_gb),
    disk_free:  a.disk_free  + n(h.free_disk_gb),
    vms:        a.vms        + n(h.vm_count),
  }),{vcpus:0,vcpu_alloc:0,ram:0,ram_alloc:0,disk:0,disk_used:0,disk_alloc:0,disk_free:0,vms:0});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── Header ── */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:700,fontSize:16}}>Capacity Planning</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>
              {displayData.length} host{displayData.length!==1?"s":""} · {groupFilter==="All"?"All Discoms":groupFilter} · snapshot from last Refresh
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {/* Discom Group Filter */}
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:11,color:T.muted,fontWeight:600}}>🏢</span>
              <select value={groupFilter} onChange={e=>{setGroupFilter(e.target.value);setHostFilter("all");setSel(null);}}
                style={{minWidth:130,fontSize:12}}>
                <option value="All">All Discoms</option>
                {capGroups.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <select value={hostFilter} onChange={e=>{ setHostFilter(e.target.value); setSel(null); }} style={{minWidth:160}}>
              <option value="all">All Hosts</option>
              {hostOptions.filter(h=>groupFilter==="All"||groupFilteredData.some(d=>d.host_id===h.id))
                .map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              {busy?<><span className="spinner"/>Loading...</>:"↻ Refresh"}
            </button>
            <div style={{display:"flex",gap:0,borderRadius:7,overflow:"hidden",border:"1px solid #1e3a5f"}}>
              <button onClick={()=>generateReport("pdf")}
                style={{padding:"7px 13px",border:"none",background:"#0f1f2e",
                  color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",
                  borderRight:"1px solid #1e3a5f",display:"flex",alignItems:"center",gap:5}}>
                📄 PDF
              </button>
              <button onClick={()=>generateReport("excel")}
                style={{padding:"7px 13px",border:"none",background:"#0f1f2e",
                  color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:5}}>
                📊 Excel
              </button>
            </div>
            <button className="btn btn-ghost" onClick={openMailDialog}>✉️ Email</button>
          </div>
        </div>
        <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",
          border:"1px solid #e2e8f0",alignSelf:"flex-start"}}>
          {[["linux","\uD83D\uDC27 Linux"],["windows","\uD83E\uDE9F Windows"]].map(function(pair){
            var key=pair[0]; var label=pair[1];
            var count = filteredData.filter(function(h){
              var os=(h.os_name||h.os_type||"").toLowerCase();
              return key==="windows"
                ?(os.includes("windows")||(h.os_type||"").toLowerCase()==="windows")
                :(!os.includes("windows")&&(h.os_type||"linux").toLowerCase()!=="windows");
            }).length;
            return (
              <button key={key} onClick={function(){setOsTab(key);setSel(null);}}
                style={{padding:"8px 20px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                  background:osTab===key?"#0f1f2e":"#fff",
                  color:osTab===key?"#fff":T.muted,
                  borderRight:key==="linux"?"1px solid #e2e8f0":"none"}}>
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* \u2500\u2500 Error banner \u2500\u2500 */}
      {err&&(
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"10px 14px",color:"#b91c1c",fontSize:13}}>
          \u26A0\uFE0F {err}
        </div>
      )}

      {/* \u2500\u2500 Summary cards \u2500\u2500 */}
      {displayData.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          {[
            ["Total vCPUs",       `${totals.vcpus}`,                                                   `${totals.vcpu_alloc} allocated`,                                                  T.blue],
            ["Free vCPUs",        `${totals.vcpus-totals.vcpu_alloc}`,                                 `${totals.vcpus?Math.round((totals.vcpus-totals.vcpu_alloc)/totals.vcpus*100):0}% available`, T.green],
            ["Total RAM",         `${totals.ram.toFixed(0)} GB`,                                        `${totals.ram_alloc.toFixed(1)} GB allocated`,                                      T.blue],
            ["Free RAM",          `${(totals.ram-totals.ram_alloc).toFixed(1)} GB`,                    `${totals.ram?Math.round((totals.ram-totals.ram_alloc)/totals.ram*100):0}% available`,T.green],
            ["Local Storage",     `${totals.disk.toFixed(0)} GB`,                                       `${totals.disk_used.toFixed(1)} GB used \u00B7 ${totals.disk_free.toFixed(1)} GB free`,  T.blue],
            ["Total VMs",         `${totals.vms}`,                                                      `across ${displayData.length} host(s)`,                                            T.purple],
          ].map(([l,v,s,c])=>(
            <div key={l} className="card" style={{padding:12}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>{l}</div>
              <div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {/* \u2500\u2500 Main table \u2500\u2500 */}
      <div className="card shadow" style={{padding:0,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
          <thead>
            <tr style={{background:"#f8fafc",borderBottom:`2px solid ${T.border}`}}>
              {/* FIX 5: table had 12 headers but only 11 data cells \u2014 "Storage Used" cell was missing */}
              {["Host","CPU Model","vCPU Total","vCPU Used","vCPU Free","RAM Total","RAM Used","RAM Free","Disk Total","Disk Used","Disk Free","VMs"].map(col=>(
                <th key={col} style={{padding:"10px 12px",fontSize:10,fontWeight:700,color:T.muted,
                  textAlign:"left",textTransform:"uppercase",whiteSpace:"nowrap"}}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((h,i)=>{
              const vcpuPct = h.cpu_vcpus    ? Math.round(n(h.vm_vcpu_alloc)/n(h.cpu_vcpus)*100)       : 0;
              const ramPct  = h.ram_total_gb  ? Math.round(n(h.vm_ram_alloc_gb)/n(h.ram_total_gb)*100)  : 0;
              const diskPct = h.disk_total_gb ? Math.round(n(h.disk_used_gb)/n(h.disk_total_gb)*100)    : 0;
              const isSel   = sel===h.host_id;
              const missing = h.hw_missing;
              return (
                <Fragment key={h.host_id}>
                  {/* Warning banner for hosts that need a Refresh */}
                  {missing&&(
                    <tr style={{background:"#fffbeb"}}>
                      <td colSpan={12} style={{padding:"6px 14px",fontSize:11,color:"#92400e"}}>
                        \u26A0\uFE0F <strong>{h.host_name}</strong> \u2014 hardware inventory not yet collected.
                        Go to <strong>Infrastructure</strong> tab \u2192 select this host \u2192 click <strong>\u21BB Refresh</strong>.
                      </td>
                    </tr>
                  )}

                  {/* Main data row \u2014 click to expand VM drill-down */}
                  <tr style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer",
                    background:isSel?"#eff6ff":missing?"#fffbeb":i%2===0?"#fff":"#fafbfc"}}
                    onClick={()=>setSel(isSel?null:h.host_id)}>

                    {/* Host name + IP */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,fontSize:12}}>{h.host_name}</div>
                      <div style={{fontSize:10,color:T.muted,fontFamily:"IBM Plex Mono"}}>{h.host_ip}</div>
                    </td>

                    {/* CPU Model */}
                    <td style={{padding:"10px 12px",fontSize:11,color:T.sub,maxWidth:160,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={h.cpu_model}>
                      {h.cpu_model||<span style={{color:T.amber,fontSize:10}}>\u21BB Refresh needed</span>}
                      {h.cpu_model&&<div style={{fontSize:9,color:T.muted}}>{h.cpu_sockets} socket{h.cpu_sockets!==1?"s":""} \u00B7 {h.cpu_pcores} cores \u00B7 {h.threads_per_core}t</div>}
                    </td>

                    {/* vCPU Total */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:T.blue}}>{h.cpu_vcpus||"\u2014"}</div>
                    </td>

                    {/* vCPU Used */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:vcpuPct>100?T.red:T.text}}>{h.vm_vcpu_alloc}</div>
                      <CommitBar pct={vcpuPct} warn={80} crit={100}/>
                      <div style={{fontSize:9,color:T.muted,marginTop:2}}>{vcpuPct}%</div>
                    </td>

                    {/* vCPU Free */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:n(h.free_vcpus)>0?T.green:T.red}}>
                        {h.free_vcpus!=null?h.free_vcpus:"\u2014"}
                      </div>
                    </td>

                    {/* RAM Total */}
                    <td style={{padding:"10px 12px",fontWeight:700,color:T.blue}}>
                      {h.ram_total_gb?`${h.ram_total_gb} GB`:"\u2014"}
                    </td>

                    {/* RAM Used (VM alloc) */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:ramPct>100?T.red:T.text}}>{h.vm_ram_alloc_gb} GB</div>
                      <CommitBar pct={ramPct} warn={80} crit={100}/>
                      <div style={{fontSize:9,color:T.muted,marginTop:2}}>{ramPct}%</div>
                    </td>

                    {/* RAM Free */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:n(h.free_ram_gb)>0?T.green:T.red}}>
                        {h.free_ram_gb!=null?`${h.free_ram_gb} GB`:"\u2014"}
                      </div>
                    </td>

                    {/* Disk Total */}
                    <td style={{padding:"10px 12px",fontWeight:700}}>
                      {h.disk_total_gb?`${h.disk_total_gb} GB`:"\u2014"}
                    </td>

                    {/* FIX 5: Disk Used \u2014 this cell existed in header but was MISSING in the row */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:diskPct>80?T.amber:T.text}}>
                        {h.disk_used_gb!=null?`${h.disk_used_gb} GB`:"\u2014"}
                      </div>
                      {h.disk_total_gb&&<CommitBar pct={diskPct} warn={80} crit={95}/>}
                      {h.disk_total_gb&&<div style={{fontSize:9,color:T.muted,marginTop:2}}>{diskPct}%</div>}
                    </td>

                    {/* Disk Free */}
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,color:n(h.free_disk_gb)>0?T.green:T.red}}>
                        {h.free_disk_gb!=null?`${h.free_disk_gb} GB`:"\u2014"}
                      </div>
                    </td>

                    {/* VM count */}
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      <span style={{fontWeight:700,color:T.blue}}>{h.vm_running}</span>
                      <span style={{color:T.muted,fontSize:11}}>/{h.vm_count}</span>
                      <div style={{fontSize:9,color:T.muted}}>running/total</div>
                    </td>
                  </tr>

                  {/* \u2500\u2500 VM drill-down (expand on row click) \u2500\u2500 */}
                  {isSel&&(
                    <tr style={{background:"#f0f7ff"}}>
                      <td colSpan={12} style={{padding:"0 16px 16px 32px"}}>
                        <div style={{paddingTop:12}}>
                          <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:T.blue}}>
                            VMs on {h.host_name} \u2014 {h.vm_running} running / {h.vm_count} total
                          </div>
                          {(!Array.isArray(h.vms)||h.vms.length===0)?(
                            <div style={{color:T.muted,fontSize:12,padding:"8px 0"}}>
                              No VMs found for this host. Run \u21BB Refresh on the host to discover VMs.
                            </div>
                          ):(
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead>
                                <tr style={{borderBottom:`1px solid ${T.border}`}}>
                                  {["VM Name","Status","IP","RAM","vCPUs","Disk"].map(col=>(
                                    <th key={col} style={{padding:"6px 10px",fontSize:10,fontWeight:700,
                                      color:T.muted,textAlign:"left",textTransform:"uppercase"}}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {h.vms.map((vm,vi)=>(
                                  <tr key={`${vm.name||"vm"}-${vi}`} style={{borderBottom:`1px solid #e2e8f0`}}>
                                    <td style={{padding:"7px 10px",fontWeight:600}}>{vm.name||"\u2014"}</td>
                                    <td style={{padding:"7px 10px"}}>
                                      <span className={`badge ${vm.status==="running"?"b-ok":"b-stop"}`}>{vm.status||"unknown"}</span>
                                    </td>
                                    <td style={{padding:"7px 10px",fontFamily:"IBM Plex Mono",fontSize:11,color:T.blue}}>{vm.ip||"N/A"}</td>
                                    <td style={{padding:"7px 10px",fontWeight:600,color:T.amber}}>{vm.ram_gb>0?`${vm.ram_gb} GB`:"\u2014"}</td>
                                    <td style={{padding:"7px 10px",fontWeight:600,color:T.blue}}>{vm.vcpus||"\u2014"}</td>
                                    <td style={{padding:"7px 10px",color:T.sub}}>{vm.disk_gb>0?`${vm.disk_gb} GB`:"\u2014"}</td>
                                  </tr>
                                ))}
                                <tr style={{background:"#e0f2fe",fontWeight:700}}>
                                  <td style={{padding:"7px 10px",color:T.blue}}>ALLOCATED (running VMs)</td>
                                  <td/><td/>
                                  <td style={{padding:"7px 10px",color:T.amber}}>{h.vm_ram_alloc_gb} GB</td>
                                  <td style={{padding:"7px 10px",color:T.blue}}>{h.vm_vcpu_alloc}</td>
                                  <td style={{padding:"7px 10px"}}>{h.vm_disk_alloc_gb} GB</td>
                                </tr>
                                <tr style={{background:"#dcfce7",fontWeight:700}}>
                                  <td style={{padding:"7px 10px",color:T.green}}>REMAINING (host free)</td>
                                  <td/><td/>
                                  <td style={{padding:"7px 10px",color:T.green}}>{h.free_ram_gb!=null?`${h.free_ram_gb} GB`:"\u2014"}</td>
                                  <td style={{padding:"7px 10px",color:T.green}}>{h.free_vcpus!=null?`${h.free_vcpus} vCPUs`:"\u2014"}</td>
                                  <td style={{padding:"7px 10px",color:T.green}}>{h.free_disk_gb!=null?`${h.free_disk_gb} GB`:"\u2014"}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {displayData.length===0&&!busy&&(
          <div style={{padding:40,textAlign:"center",color:T.muted}}>
            <div style={{fontSize:28,marginBottom:8}}>\uD83D\uDCCA</div>
            <div style={{fontWeight:600,marginBottom:6}}>
              {data.length===0?"No capacity data yet":"No hosts match the selected filter"}
            </div>
            <div style={{fontSize:12}}>
              {data.length===0?(
                <>Go to <strong>Infrastructure</strong> tab \u2192 select each host \u2192 click <strong>\u21BB Refresh</strong> to collect hardware inventory.</>
              ):(
                <>Change the host filter to <strong>All Hosts</strong> or choose a different host.</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* \u2500\u2500 Selected host detail panel (shown when a row is expanded) \u2500\u2500 */}
      {selectedHost&&(
        <div className="card shadow" style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:10,flexWrap:"wrap"}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{selectedHost.host_name}</div>
              <div style={{fontSize:12,color:T.muted}}>{selectedHost.host_ip} \u00B7 {selectedHost.cpu_model||"CPU model unknown"}</div>
            </div>
            <div style={{fontSize:11,color:T.muted}}>
              {selectedHost.hw_missing
                ? "\u26A0\uFE0F Hardware snapshot incomplete \u2014 refresh host for full totals."
                : `${n(selectedHost.vm_running)} running VM(s) of ${n(selectedHost.vm_count)} total`}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:16}}>
            <StatCard label="CPU Capacity"     value={`${n(selectedHost.cpu_vcpus)} vCPU`}      sub={`${n(selectedHost.vm_vcpu_alloc)} used \u00B7 ${n(selectedHost.free_vcpus)} free`}        color={T.blue}/>
            <StatCard label="Memory Capacity"  value={gb(selectedHost.ram_total_gb)}             sub={`${gb(selectedHost.vm_ram_alloc_gb)} used \u00B7 ${gb(selectedHost.free_ram_gb)} free`}   color={T.amber}/>
            <StatCard label="Storage Capacity" value={gb(selectedHost.disk_total_gb)}            sub={`${gb(selectedHost.disk_used_gb)} host used \u00B7 ${gb(selectedHost.free_disk_gb)} free`} color={T.green}/>
          </div>

          <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:T.blue}}>VM Allocation Details</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${T.border}`}}>
                {["VM Name","Status","IP","RAM","vCPU","Disk"].map(col=>(
                  <th key={col} style={{padding:"8px 10px",fontSize:10,fontWeight:700,
                    color:T.muted,textAlign:"left",textTransform:"uppercase"}}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(selectedHost.vms)&&selectedHost.vms.length>0)?selectedHost.vms.map((vm,idx)=>(
                <tr key={`${vm.name||"vm"}-${idx}`} style={{borderBottom:`1px solid #e2e8f0`}}>
                  <td style={{padding:"8px 10px",fontWeight:600}}>{vm.name||"\u2014"}</td>
                  <td style={{padding:"8px 10px"}}><span className={`badge ${vm.status==="running"?"b-ok":"b-stop"}`}>{vm.status||"unknown"}</span></td>
                  <td style={{padding:"8px 10px",fontFamily:"IBM Plex Mono",fontSize:11,color:T.blue}}>{vm.ip||"N/A"}</td>
                  <td style={{padding:"8px 10px"}}>{gb(vm.ram_gb)}</td>
                  <td style={{padding:"8px 10px"}}>{n(vm.vcpus)||"\u2014"}</td>
                  <td style={{padding:"8px 10px"}}>{vm.disk_gb>0?`${vm.disk_gb} GB`:"\u2014"}</td>
                </tr>
              )):(
                <tr>
                  <td colSpan={6} style={{padding:"14px 10px",color:T.muted,textAlign:"center"}}>
                    No VMs in DB for this host \u2014 run \u21BB Refresh on the host to discover VMs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mailOpen&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMailOpen(false)}>
          <div className="modal" style={{width:460}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15}}>Email Capacity Report</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setMailOpen(false)}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>Discom</label>
                <select value={mailForm.discom} onChange={e=>setMailForm(f=>({...f,discom:e.target.value}))}>
                  <option value="All">All Discoms</option>
                  {capGroups.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>OS</label>
                <select value={mailForm.os_type} onChange={e=>setMailForm(f=>({...f,os_type:e.target.value}))}>
                  <option value="linux">Linux</option>
                  <option value="windows">Windows</option>
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>To Email</label>
                <input type="email" value={mailForm.to_email}
                  onChange={e=>setMailForm(f=>({...f,to_email:e.target.value}))}
                  placeholder="ops-team@example.com"/>
              </div>
            </div>
            <div style={{fontSize:11,color:T.muted,marginTop:12}}>
              Subject format: <code>Capacity report for &lt;discom&gt; &lt;OS&gt; physical</code>
            </div>
            {mailMsg&&<div style={{marginTop:12,padding:"8px 10px",borderRadius:6,fontSize:12,
              background:mailMsg.t==="ok"?"#dcfce7":"#fee2e2",
              color:mailMsg.t==="ok"?"#166534":"#991b1b"}}>{mailMsg.text}</div>}
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setMailOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendMailReport} disabled={sendingMail}>
                {sendingMail?<><span className="spinner"/>Sending...</>:"Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
              <td style={{fontSize:11}}>{p.os||"\u2014"}</td>
              <td><code style={{fontSize:10}}>{p.kernel||"\u2014"}</code></td>
              <td><code style={{fontSize:10,color:p.latest_kernel&&p.latest_kernel!==p.kernel?T.amber:T.green}}>{p.latest_kernel||"N/A"}</code></td>
              <td><code style={{fontSize:11}}>{p.pkg_manager||"\u2014"}</code></td>
              <td><span style={{fontWeight:700,color:p.updates_available>0?T.red:T.green}}>{p.updates_available??0}</span></td>
              <td><span style={{fontWeight:700,color:p.security_updates>0?T.red:T.green}}>{p.security_updates??0}</span></td>
              <td style={{fontSize:11,color:T.muted}}>{p.last_patch||"\u2014"}</td>
              <td><span className="badge" style={{background:pc(p.status)+"22",color:pc(p.status)}}>{p.status||"\u2014"}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// \u2500\u2500 Alerts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  const typeIcon={Connection:"\uD83D\uDD0C","CPU":"\uD83D\uDD25","RAM":"\uD83E\uDDE0","Disk":"\uD83D\uDCBE","Storage":"\uD83D\uDCBD",
                  NIC:"\uD83C\uDF10","NIC Error":"\uD83C\uDF10","Security Patch":"\uD83D\uDD10","Patch":"\uD83D\uDD27"};

  const AlertCard=({a})=>(
    <div className="card shadow" style={{padding:"12px 18px",borderLeft:`4px solid ${a.severity==="critical"?T.red:T.amber}`,
      background:a.severity==="critical"?"#fff8f8":"#fffdf0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <span style={{fontSize:18}}>{typeIcon[a.type]||"\u26A0\uFE0F"}</span>
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
        <button className="btn btn-ghost" onClick={load} disabled={busy}>{busy?<span className="spinner"/>:"\u21BB"} Refresh</button>
      </div>
      {alerts.length===0&&<div className="card shadow" style={{padding:40,textAlign:"center",color:T.green,fontSize:15}}>\u2705 No active alerts \u2014 all systems healthy</div>}
      {crit.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.red,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>\uD83D\uDEA8 Critical ({crit.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{crit.map(a=><AlertCard key={a.id} a={a}/>)}</div>
        </div>
      )}
      {warn.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.amber,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>\u26A0\uFE0F Warnings ({warn.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{warn.map(a=><AlertCard key={a.id} a={a}/>)}</div>
        </div>
      )}
    </div>
  );
}

// \u2500\u2500 Logs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        <button className="btn btn-ghost" onClick={fetch}>{busy?<span className="spinner"/>:"\u21BB"} Refresh</button>
        <span style={{color:T.muted,fontSize:11}}>{logs.length} entries</span>
      </div>
      <div className="card shadow" style={{padding:0,maxHeight:"68vh",overflowY:"auto"}}>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"7px 14px",borderBottom:`1px solid #f1f5f9`,fontSize:11,background:i%2===0?"#fff":"#fafbfc"}}>
            <span style={{color:T.muted,minWidth:70,fontFamily:"IBM Plex Mono"}}>{toISTTime(l.ts)}</span>
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


// \u2500\u2500 Debug Console \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// \u2500\u2500 VM IP Debugger \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
          <option value="">\u2014 Select host \u2014</option>
          {hosts.map(h=><option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={busy||!hid}>
          {busy?<><span className="spinner"/>Running...</>:"\uD83D\uDD0D Run IP Debug"}
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
              <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>\uD83D\uDDA5 {vname} <span style={{fontSize:11,color:T.muted}}>({d.state})</span></div>
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
  const stepIcon=ok=>ok?"\u2714":"\u2717";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:900}}>
      <div style={{fontWeight:700,fontSize:15}}>Connection Debug Console</div>
      <div style={{fontSize:12,color:T.muted}}>
        Tests TCP \u2192 Auth \u2192 OS detect \u2192 Metrics \u2192 Patch \u2192 VMs step by step and shows exact error at each stage.
      </div>

      <div className="card shadow" style={{padding:18}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {[["IP Address","ip","text","192.168.1.100"],["Username","username","text","root"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>OS Type</label>
            <select value={form.os_type} onChange={e=>set("os_type",e.target.value)}>
              <option value="linux">\uD83D\uDC27 Linux</option>
              <option value="windows">\uD83E\uDE9F Windows</option>
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
          {busy?<><span className="spinner"/>Running diagnostics...</>:"\u25B6 Run Full Diagnostics"}</button>
      </div>

      {result&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>
            Diagnostic Results \u2014 {result.ip}
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
              <div style={{fontWeight:700,marginBottom:10,color:T.blue}}>\uD83E\uDE9F WinRM Setup Required</div>
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
              <div style={{fontWeight:700,marginBottom:8,color:T.amber}}>\uD83D\uDCA1 Remediation hints</div>
              {result.steps.filter(s=>!s.ok).map((s,i)=>{
                let hint="";
                if(s.step.startsWith("TCP")) hint=`Port unreachable \u2014 check firewall, confirm the IP is correct, and that SSH/WinRM is running. Run: nc -zv ${result.ip} ${form.os_type==="linux"?form.ssh_port:form.winrm_port}`;
                else if(s.step==="SSH") hint="Auth failed \u2014 verify username/password. If key auth, ensure the key is correct. Try: ssh "+form.username+"@"+result.ip;
                else if(s.step.startsWith("WinRM")) {
                  hint="WinRM failed. On the Windows host run (PowerShell as Admin):\n  winrm quickconfig\n  winrm set winrm/config/service/auth @{Basic=\"true\"}\n  winrm set winrm/config/service @{AllowUnencrypted=\"true\"}\n  netsh advfirewall firewall add rule name=WinRM dir=in action=allow protocol=TCP localport=5985";
                }
                else if(s.step==="Metrics") hint="SSH connected but metrics collection failed \u2014 likely a missing command. Check if top/free/df are available.";
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

function EmailSettingsPage() {
  const [form,setForm] = useState({host:"",port:587,username:"",password:"",from_email:"",use_tls:true});
  const [busy,setBusy] = useState(false);
  const [msg,setMsg]   = useState(null);

  const load = useCallback(async ()=>{
    try{
      const r = await api.get("/email-settings");
      setForm(f=>({
        ...f,
        host:r.data?.host||"",
        port:r.data?.port||587,
        username:r.data?.username||"",
        password:"",
        from_email:r.data?.from_email||"",
        use_tls:!!r.data?.use_tls,
      }));
    }catch(e){
      setMsg({t:"e",text:e.response?.data?.detail || "Failed to load email settings"});
    }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const save = async ()=>{
    setBusy(true); setMsg(null);
    try{
      const payload = {...form};
      if(!payload.password) delete payload.password;
      const r = await api.put("/email-settings", payload);
      setMsg({t:"ok",text:r.data?.message || "Saved"});
      setForm(f=>({...f,password:""}));
    }catch(e){
      setMsg({t:"e",text:e.response?.data?.detail || "Failed to save settings"});
    }
    setBusy(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:760}}>
      <div className="card shadow" style={{padding:16}}>
        <div style={{fontWeight:700,fontSize:16}}>Email Settings (Admin)</div>
        <div style={{fontSize:12,color:T.muted,marginTop:4}}>
          Configure SMTP details used for sending capacity reports.
        </div>
      </div>
      <div className="card shadow" style={{padding:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 140px",gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>SMTP Host</label>
            <input value={form.host} onChange={e=>setForm(f=>({...f,host:e.target.value}))}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>SMTP Port</label>
            <input type="number" value={form.port} onChange={e=>setForm(f=>({...f,port:Number(e.target.value)||0}))}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>SMTP Username</label>
            <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>Use TLS</label>
            <select value={form.use_tls ? "yes":"no"} onChange={e=>setForm(f=>({...f,use_tls:e.target.value==="yes"}))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>From Email</label>
            <input type="email" value={form.from_email} onChange={e=>setForm(f=>({...f,from_email:e.target.value}))}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:700,color:T.sub,display:"block",marginBottom:4}}>SMTP Password</label>
            <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
              placeholder="Leave blank to keep existing password"/>
          </div>
        </div>
        {msg&&<div style={{marginTop:12,padding:"8px 10px",borderRadius:6,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",
          color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <button className="btn btn-ghost" onClick={load}>Reload</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy?<><span className="spinner"/>Saving...</>:"Save SMTP Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// \u2500\u2500 App Shell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const VIEWS=[{id:"overview",icon:"\uD83D\uDCCA",label:"Overview"},{id:"infra",icon:"\uD83D\uDDA7",label:"Infrastructure"},
             {id:"logs",icon:"\uD83D\uDCCB",label:"Logs"},{id:"alerts",icon:"\uD83D\uDD14",label:"Alerts"},
             {id:"patches",icon:"\uD83D\uDD27",label:"Patches"},{id:"capacity",icon:"\uD83D\uDCCA",label:"Capacity"},
             {id:"emailcfg",icon:"✉️",label:"Email Setup"},
             {id:"vmip",icon:"\uD83D\uDD2C",label:"VM IP Debug"},{id:"scans",icon:"\uD83D\uDD12",label:"Vuln Scans"},{id:"users",icon:"\uD83D\uDC65",label:"Users"},{id:"debug",icon:"\uD83D\uDEE0",label:"Debug"}];

export default function App() {
  // \u2500\u2500 All hooks first (React rules) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var _stored = loadAuth();
  var [authUser,    setAuthUser]    = useState(_stored.user);
  var [mustChangePw,setMustChangePw]= useState(_stored.user ? !!_stored.user.must_change_pw : false);
  var [view,        setView]        = useState("overview");
  var [hosts,       setHosts]       = useState([]);
  var [summary,     setSummary]     = useState({});
  var [history,     setHistory]     = useState([]);
  var [lastUpd,     setLastUpd]     = useState(null);

  useEffect(function() {
    if (_stored.token) api.defaults.headers.common["Authorization"] = "Bearer " + _stored.token;
  }, []); // eslint-disable-line

  var loadData = useCallback(async function() {
    try {
      var results = await Promise.all([api.get("/hosts"),api.get("/summary"),api.get("/metrics/history")]);
      setHosts(results[0].data); setSummary(results[1].data); setHistory(results[2].data);
      setLastUpd(new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata"}));
    } catch(e){}
  }, []); // eslint-disable-line

  useEffect(function(){ if (authUser && !mustChangePw) loadData(); }, [authUser, mustChangePw]); // eslint-disable-line

  // \u2500\u2500 Auth handlers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function handleLogin(user, mustChange) {
    setAuthUser(user);
    setMustChangePw(!!mustChange);
  }
  function handleLogout() {
    clearAuth();
    delete api.defaults.headers.common["Authorization"];
    setAuthUser(null);
    setMustChangePw(false);
  }
  function handlePasswordChanged() {
    var a = loadAuth();
    var u = Object.assign({}, a.user || {}, { must_change_pw: false });
    setAuthUser(u);
    setMustChangePw(false);
  }

  // \u2500\u2500 Auth gate (after all hooks) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (!authUser) return React.createElement(LoginPage, { onLogin: handleLogin });
  if (mustChangePw) return React.createElement(ChangePasswordPage, { user: authUser, onDone: handlePasswordChanged });

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <div style={{width:210,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #1e3347"}}>
            <DitLogo size={34} />
            <div>
              <div style={{color:"#f0f9ff",fontWeight:800,fontSize:13}}>ServerCapacity</div>
              <div style={{color:"#5b8fad",fontSize:10}}>D&amp;IT Monitor</div>
            </div>
          </div>
          <div style={{padding:"0 8px",flex:1}}>
            {VIEWS.filter(function(v){
              if ((v.id === "users" || v.id === "emailcfg") && !hasPerm(authUser,"manage_users")) return false;
              return true;
            }).map(v=>(
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
          <div style={{padding:"12px 14px",borderTop:"1px solid #1e3347",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"#1e3347",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:800,color:"#7dd3fc",flexShrink:0}}>
                {authUser && authUser.username ? authUser.username[0].toUpperCase() : "U"}
              </div>
              <div>
                <div style={{color:"#e2e8f0",fontSize:12,fontWeight:600}}>
                  {authUser ? (authUser.full_name || authUser.username) : ""}
                </div>
                <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,
                  background:"#1e3a5f",color:"#93c5fd"}}>
                  {authUser ? authUser.role.toUpperCase() : ""}
                </span>
              </div>
            </div>
            <div style={{fontSize:10,color:"#3d6177",marginBottom:8}}>
              <div>{hosts.length} hosts - {summary.total_vms||0} VMs</div>
              {lastUpd&&<div>Updated: {lastUpd}</div>}
            </div>
            <div style={{fontSize:9,color:"#2f4f66",opacity:.65,marginBottom:8}}>
              Proprietary © JyotiRanjan
            </div>
            <button onClick={handleLogout}
              style={{width:"100%",padding:"7px",borderRadius:7,border:"1px solid #1e3347",
                background:"transparent",color:"#5b8fad",fontSize:11,cursor:"pointer"}}>
              Sign Out
            </button>
          </div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"11px 22px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{VIEWS.find(v=>v.id===view)?.label}</div>
              <div style={{color:T.muted,fontSize:11}}>Data persisted in DB \u00B7 use \u21BB Refresh per host to update</div>
            </div>
            <button className="btn btn-refresh" onClick={loadData}>\u21BB Reload DB</button>
            <a href={"http://" + window.location.hostname + ":5000/api/docs"}
              target="_blank" rel="noreferrer"
              style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",
                background:"#fff",color:"#0369a1",fontWeight:600,fontSize:12,
                textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
              API Docs
            </a>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:view==="infra"?"14px":"22px"}}>
            {view==="overview" && <Overview hosts={hosts} summary={summary} history={history} onNavigate={setView}/>}
            {view==="infra"    && <InfraView rawHosts={hosts} onGlobalReload={loadData}/>}
            {view==="logs"     && <Logs hosts={hosts}/>}
            {view==="alerts"   && <Alerts/>}
            {view==="patches"  && <Patches/>}
            {view==="capacity"  && <CapacityPlanning/>}
            {view==="emailcfg" && hasPerm(authUser,"manage_users") && <EmailSettingsPage/>}
            {view==="vmip"     && <VMIPDebug hosts={hosts}/>}
            {view==="debug"    && <DebugConsole/>}
            {view==="scans"    && <AllScans/>}
            {view==="users"    && hasPerm(authUser,"manage_users") && <UserManagementPage currentUser={authUser}/>}
          </div>
        </div>
      </div>
    </>
  );
}

// \u2500\u2500 LoginPage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500



function LoginPage({ onLogin }) {
  var [form, setForm] = useState({ username: "", password: "" });
  var [error, setError] = useState("");
  var [loading, setLoading] = useState(false);

  var submit = async function(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      var r = await axios.post(API + "/auth/login", form);
      saveAuth(r.data.access_token, r.data.user);
      api.defaults.headers.common["Authorization"] = "Bearer " + r.data.access_token;
      onLogin(r.data.user, r.data.must_change_pw);
    } catch(err) {
      setError(err.response && err.response.data ? err.response.data.detail : "Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0f1f2e",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:40,width:380,boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}>
            <DitLogo size={72}/>
          </div>
          <div style={{fontWeight:800,fontSize:22,color:"#0f172a"}}>ServerCapacity</div>
          <div style={{color:"#64748b",fontSize:13,marginTop:4}}>Infrastructure Monitoring Platform</div>
        </div>
        <form onSubmit={submit}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Username</label>
            <input type="text" required autoFocus value={form.username}
              onChange={function(e){ setForm(function(f){ return Object.assign({},f,{username:e.target.value}); }); }}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Password</label>
            <input type="password" required value={form.password}
              onChange={function(e){ setForm(function(f){ return Object.assign({},f,{password:e.target.value}); }); }}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {error && <div style={{padding:"10px 14px",borderRadius:8,marginBottom:16,background:"#fee2e2",color:"#991b1b",fontSize:13}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:loading?"#94a3b8":"#0f1f2e",color:"#fff",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer"}}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div style={{textAlign:"center",marginTop:24,fontSize:11,color:"#94a3b8"}}>
          ServerCapacity {_APP_VERSION} - Secured by JWT
        </div>
        <div style={{textAlign:"center",marginTop:6,fontSize:10,color:"#cbd5e1",opacity:.55}}>
          Proprietary © JyotiRanjan
        </div>
      </div>
    </div>
  );
}

// \u2500\u2500 ChangePasswordPage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function ChangePasswordPage({ user, onDone }) {
  var [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  var [error, setError] = useState("");
  var [ok, setOk] = useState(false);
  var [loading, setLoading] = useState(false);

  var submit = async function(e) {
    e.preventDefault(); setError("");
    if (form.new_password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.new_password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      var r = await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      if (r.data.access_token) {
        var auth = loadAuth();
        saveAuth(r.data.access_token, Object.assign({}, auth.user||{}, {must_change_pw:false}));
        api.defaults.headers.common["Authorization"] = "Bearer " + r.data.access_token;
      }
      setOk(true);
      setTimeout(function(){ onDone(); }, 1500);
    } catch(err) {
      setError(err.response && err.response.data ? err.response.data.detail : "Failed to change password");
    }
    setLoading(false);
  };

  var fields = [
    ["Current Password (from welcome email)", "current_password"],
    ["New Password (min 8 characters)", "new_password"],
    ["Confirm New Password", "confirm"],
  ];

  return (
    <div style={{minHeight:"100vh",background:"#0f1f2e",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:40,width:400,boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:8}}>\uD83D\uDD10</div>
          <div style={{fontWeight:800,fontSize:20,color:"#0f172a"}}>Change Your Password</div>
          <div style={{marginTop:10,padding:"8px 14px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:13,color:"#92400e"}}>
            Welcome, <strong>{user ? (user.full_name || user.username) : ""}</strong>! Set a new password before continuing.
          </div>
        </div>
        {ok ? (
          <div style={{padding:20,textAlign:"center",background:"#f0fdf4",borderRadius:10,color:"#059669",fontWeight:600}}>
            Password changed! Redirecting...
          </div>
        ) : (
          <form onSubmit={submit}>
            {fields.map(function(pair) {
              return (
                <div key={pair[1]} style={{marginBottom:16}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>{pair[0]}</label>
                  <input type="password" required value={form[pair[1]]}
                    onChange={function(e){ var k=pair[1]; setForm(function(f){ return Object.assign({},f,{[k]:e.target.value}); }); }}
                    style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                </div>
              );
            })}
            {error && <div style={{padding:"10px 14px",borderRadius:8,marginBottom:12,background:"#fee2e2",color:"#991b1b",fontSize:13}}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:loading?"#94a3b8":"#059669",color:"#fff",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer"}}>
              {loading ? "Saving..." : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// \u2500\u2500 AllScans \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function AllScans() {
  var [scans, setScans] = useState([]);
  var [hosts, setHosts] = useState([]);
  var [loading, setLoading] = useState(true);
  var SEV = {"CRITICAL":"#dc2626","HIGH":"#d97706","MEDIUM":"#7c3aed","LOW":"#64748b"};

  useEffect(function() {
    Promise.all([api.get("/scans"), api.get("/hosts")])
      .then(function(results) { setScans(results[0].data||[]); setHosts(results[1].data||[]); })
      .finally(function() { setLoading(false); });
  }, []);

  var validIds = {};
  hosts.forEach(function(h){ validIds[h.id] = true; });
  var active = scans.filter(function(s){ return s.target_type !== "host" || validIds[s.target_id]; });

  if (loading) return <div style={{padding:40,color:"#64748b"}}>Loading scans...</div>;
  return (
    <div>
      <div style={{fontWeight:700,fontSize:18,marginBottom:16}}>Vulnerability Scan Results</div>
      {active.length===0 && <div style={{padding:40,textAlign:"center",color:"#64748b"}}>No scan results yet.</div>}
      {active.map(function(s) {
        return (
          <div key={s.target_id} style={{background:"#fff",borderRadius:10,padding:16,marginBottom:12,border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <span style={{fontWeight:700}}>{s.target}</span>
                <span style={{color:"#64748b",fontSize:12,marginLeft:8}}>{s.ip}</span>
              </div>
              <span style={{fontSize:11,color:"#64748b"}}>{toIST(s.scanned_at)}</span>
            </div>
            {s.scan_error && <div style={{padding:"6px 10px",background:"#fffbeb",borderRadius:6,fontSize:12,color:"#92400e",marginBottom:8}}>{s.scan_error}</div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["CRITICAL","HIGH","MEDIUM","LOW"].map(function(sev) {
                return <span key={sev} style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,background:(SEV[sev]||"#64748b")+"18",color:SEV[sev]||"#64748b"}}>{sev}: {(s.summary&&s.summary[sev.toLowerCase()])||0}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// \u2500\u2500 UserManagementPage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var PERM_LABELS = {
  view:"View Dashboard", scan:"Run Scans", refresh:"Refresh Hosts",
  patch:"Patch Management", logs:"View Logs",
  add_host:"Add Hosts", delete_host:"Delete Hosts", manage_users:"Manage Users",
};

function UserManagementPage({ currentUser }) {
  var [users, setUsers] = useState([]);
  var [roles, setRoles] = useState([]);
  var [showCreate, setShowCreate] = useState(false);
  var [editUser, setEditUser] = useState(null);
  var [msg, setMsg] = useState(null);
  var [loading, setLoading] = useState(true);

  var load = async function() {
    try {
      var results = await Promise.all([api.get("/users"), api.get("/roles")]);
      setUsers(results[0].data); setRoles(results[1].data);
    } catch(e) {}
    setLoading(false);
  };
  useEffect(function(){ load(); }, []);

  var resetPw = async function(uid) {
    if (!window.confirm("Reset this user password?")) return;
    try { var r = await api.post("/users/"+uid+"/reset-password"); setMsg(r.data); }
    catch(e) { alert(e.response&&e.response.data ? e.response.data.detail : "Failed"); }
  };
  var toggleActive = async function(uid, cur) {
    try { await api.patch("/users/"+uid, {is_active:!cur}); load(); }
    catch(e) { alert(e.response&&e.response.data ? e.response.data.detail : "Failed"); }
  };
  var deleteUser = async function(uid, uname) {
    if (!window.confirm("Delete user "+uname+"?")) return;
    try { await api.delete("/users/"+uid); load(); }
    catch(e) { alert(e.response&&e.response.data ? e.response.data.detail : "Failed"); }
  };

  if (loading) return <div style={{padding:40,color:"#64748b"}}>Loading users...</div>;

  return (
    <div style={{maxWidth:1100}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:20}}>User Management</div>
        <button onClick={function(){setShowCreate(true);}} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0f1f2e",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>
          + Create User
        </button>
      </div>
      {msg && (
        <div style={{padding:14,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,marginBottom:16,fontSize:13}}>
          {msg.email_sent ? "Password reset - email sent." : <span>Password reset. Share: <code style={{background:"#1e293b",color:"#e2e8f0",padding:"3px 10px",borderRadius:5,fontFamily:"monospace"}}>{msg.temp_password}</code></span>}
          <button onClick={function(){setMsg(null);}} style={{float:"right",background:"none",border:"none",cursor:"pointer",color:"#64748b"}}>x</button>
        </div>
      )}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
              {["User","Email","Role","Status","Last Login","Actions"].map(function(h){
                return <th key={h} style={{padding:"12px 16px",textAlign:"left",fontWeight:600,color:"#374151",fontSize:12}}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {users.map(function(u, idx) {
              return (
                <tr key={u.id} style={{borderBottom:idx<users.length-1?"1px solid #f1f5f9":"none",background:u.is_active?"#fff":"#fafafa"}}>
                  <td style={{padding:"14px 16px"}}>
                    <div style={{fontWeight:600}}>{u.full_name||u.username}</div>
                    <div style={{color:"#64748b",fontSize:11}}>@{u.username}</div>
                    {u.must_change_pw && <span style={{fontSize:10,background:"#fef3c7",color:"#92400e",borderRadius:3,padding:"1px 5px"}}>pw change pending</span>}
                  </td>
                  <td style={{padding:"14px 16px",color:"#475569",fontSize:12}}>{u.email}</td>
                  <td style={{padding:"14px 16px"}}>
                    <span style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,background:"#dbeafe",color:"#1d4ed8"}}>{u.role.toUpperCase()}</span>
                  </td>
                  <td style={{padding:"14px 16px"}}>
                    <span style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:600,background:u.is_active?"#f0fdf4":"#f1f5f9",color:u.is_active?"#059669":"#94a3b8"}}>{u.is_active?"Active":"Disabled"}</span>
                  </td>
                  <td style={{padding:"14px 16px",color:"#64748b",fontSize:11}}>{u.last_login ? toISTShort(u.last_login) : "Never"}</td>
                  <td style={{padding:"14px 16px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={function(){setEditUser(u);}} style={{padding:"5px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:12}} title="Edit">Edit</button>
                      <button onClick={function(){resetPw(u.id);}} style={{padding:"5px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:12}} title="Reset PW">Reset PW</button>
                      {u.id !== (currentUser&&currentUser.id) && (
                        <button onClick={function(){deleteUser(u.id,u.username);}} style={{padding:"5px 10px",borderRadius:6,border:"1px solid #fee2e2",background:"#fff",color:"#dc2626",cursor:"pointer",fontSize:12}}>Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(showCreate||editUser) && (
        <UserFormModal user={editUser} roles={roles}
          onClose={function(){setShowCreate(false);setEditUser(null);}}
          onSaved={function(r){ setShowCreate(false); setEditUser(null); if(r&&r.temp_password) setMsg(r); load(); }}/>
      )}
    </div>
  );
}

function UserFormModal({ user, roles, onClose, onSaved }) {
  var isEdit = !!user;
  var [form, setForm] = useState({
    username: user?user.username:"", email: user?user.email:"",
    full_name: user?user.full_name:"", role: user?user.role:"viewer",
    custom_perms: user?user.custom_perms:[], is_active: user?user.is_active:true,
  });
  var [error, setError] = useState("");
  var [loading, setLoading] = useState(false);
  var allPerms = Object.keys(PERM_LABELS);

  var submit = async function(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      var r;
      if (isEdit) {
        r = await api.patch("/users/"+user.id, {full_name:form.full_name,role:form.role,custom_perms:form.role==="custom"?form.custom_perms:undefined,is_active:form.is_active});
        onSaved({user:r.data});
      } else {
        r = await api.post("/users", {username:form.username,email:form.email,full_name:form.full_name,role:form.role,custom_perms:form.role==="custom"?form.custom_perms:[]});
        onSaved(r.data);
      }
    } catch(e) { setError(e.response&&e.response.data?e.response.data.detail:"Failed"); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={function(e){if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{width:480,maxWidth:"95vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:16}}>{isEdit?"Edit User - "+user.username:"Create New User"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#64748b"}}>x</button>
        </div>
        <form onSubmit={submit}>
          {!isEdit && [["Username","username","text"],["Email","email","email"]].map(function(f){
            return (
              <div key={f[1]} style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5}}>{f[0]}</label>
                <input type={f[2]} required value={form[f[1]]}
                  onChange={function(e){ var k=f[1]; setForm(function(p){ return Object.assign({},p,{[k]:e.target.value}); }); }}
                  style={{width:"100%",padding:"9px 12px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}}/>
              </div>
            );
          })}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5}}>Full Name</label>
            <input value={form.full_name} onChange={function(e){setForm(function(p){return Object.assign({},p,{full_name:e.target.value});});}}
              style={{width:"100%",padding:"9px 12px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5}}>Role</label>
            <select value={form.role} onChange={function(e){setForm(function(p){return Object.assign({},p,{role:e.target.value});});}}
              style={{width:"100%",padding:"9px 12px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13}}>
              {roles.map(function(r){ return <option key={r.role} value={r.role}>{r.role} - {r.description}</option>; })}
            </select>
          </div>
          {form.role==="custom" && (
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>Permissions</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {allPerms.map(function(p){
                  var checked = form.custom_perms&&form.custom_perms.indexOf(p)!==-1;
                  return (
                    <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,border:"1.5px solid",borderColor:checked?"#0369a1":"#e2e8f0",background:checked?"#eff6ff":"#fff",fontSize:12,cursor:"pointer"}}>
                      <input type="checkbox" checked={!!checked}
                        onChange={function(){ setForm(function(prev){
                          var cp = prev.custom_perms ? prev.custom_perms.slice() : [];
                          var i = cp.indexOf(p);
                          if (i>=0) cp.splice(i,1); else cp.push(p);
                          return Object.assign({},prev,{custom_perms:cp});
                        }); }}/>
                      {PERM_LABELS[p]||p}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {error && <div style={{padding:"9px 12px",background:"#fee2e2",borderRadius:7,color:"#991b1b",fontSize:13,marginBottom:12}}>{error}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button type="button" onClick={onClose} style={{padding:"9px 18px",borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>
            <button type="submit" disabled={loading} style={{padding:"9px 18px",borderRadius:7,border:"none",background:loading?"#94a3b8":"#0f1f2e",color:"#fff",fontWeight:600,fontSize:13,cursor:loading?"not-allowed":"pointer"}}>
              {loading?"Saving...":(isEdit?"Save Changes":"Create User")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
