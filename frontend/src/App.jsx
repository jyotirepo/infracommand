import React, { useState, useEffect, useCallback, useRef, Fragment } from "react";

// \u2500\u2500 Auth helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
  } catch { return { token: null, user: null }; }
}
function hasPerm(user, perm) {
  return user?.perms?.includes(perm) ?? false;
}

// \u2500\u2500 IST Date/Time Helper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Converts any timestamp to Indian Standard Time (IST = UTC+5:30)
// Uses the browser's Intl API \u2014 no NTP call needed client-side.
// The NTP server (ntp.tpcentralodisha.com) should be configured on the
// backend hosts so that log timestamps they emit are already accurate.
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone:    "Asia/Kolkata",
  year:        "numeric",
  month:       "2-digit",
  day:         "2-digit",
  hour:        "2-digit",
  minute:      "2-digit",
  second:      "2-digit",
  hour12:      false,
});
const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour:     "2-digit",
  minute:   "2-digit",
  second:   "2-digit",
  hour12:   false,
});
const IST_SHORT = new Intl.DateTimeFormat("en-IN", {
  timeZone:  "Asia/Kolkata",
  day:       "2-digit",
  month:     "short",
  year:      "numeric",
  hour:      "2-digit",
  minute:    "2-digit",
  hour12:    false,
});

function toIST(ts) {
  if (!ts) return "\u2014";
  try {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    if (isNaN(d)) return ts;
    return IST.format(d) + " IST";
  } catch { return ts; }
}
function toISTTime(ts) {
  if (!ts) return "\u2014";
  try {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    if (isNaN(d)) return String(ts).slice(11, 19);
    return IST_TIME.format(d);
  } catch { return String(ts).slice(11, 19); }
}
function toISTShort(ts) {
  if (!ts) return "\u2014";
  try {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    if (isNaN(d)) return ts;
    return IST_SHORT.format(d);
  } catch { return ts; }
}

// D&IT Logo \u2014 embedded as base64 (no external file needed)
const DIT_LOGO_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABQAFADASIAAhEBAxEB/8QAHAAAAgMAAwEAAAAAAAAAAAAABgcABQgBAwQC/8QAOBAAAgIBAwIDBgQEBQUAAAAAAQIDBAUABhESIQcTMRQiQVFhcQgWYoEVIzNCFzJSgpElcpKTof/EABgBAQEBAQEAAAAAAAAAAAAAAAUDBAYC/8QAMBEAAQIDBQYFBQEBAAAAAAAAAQIDABEhBBMxQfAFElFxgaEiQmGRwSMyUtHh8bH/2gAMAwEAAhEDEQA/ANl6mppf+LniBBtTHy1qsyC+UDPKV6xWVuek9P8AfI3B6E+hZuFU80aaU6sIQKmJuupaSVKNIv8Adu8MNttClyVprZjMi1YODIUH955ICJ+tyF+uk1ufxxyE4m/hCOsUXeQ4+DzvLH655B0D/bGw+THQhj8RmN7x1s3kHM+CuW5IZqtS6HuiVV/rSKRzO68h+kd+kcKqjjXtxSQYijJsvekVOjSxU7pbmGclpmzDKevzlrqp9oPHHST9FIHB10DNgYZ+/wAahiP+8/7jAT1ufd+3wpOBjmbcfiRlJMGyQW/Lz7MMe82Ym6JOn16hEyBOB37qOw14W3nvnDrkZZhZEWLvijaeDL2OBMerhVV3cNz0N36SP+dduC3Rf/KVfHYnbebyAqY6WCpaFU9MM5kmCShh24MMxVvqB8uddOdyElo2nv4TcOBrX9zfxea4aBlFdBF0x/RiHJJHyPbk9tbUtp3ilSBL+8Jzw7xiUtW6FBZn/OMpY9oMcT4xbhwtiGtuapcqvIA6x5ioYutfms0ajgfVoj9SNN7Z++MLuTy4YJDWuSIXWvKykyKPVo3UlZV+qk8fEDWc85Lh9w5fGWrOTOTxdeRshuYYuSU1YuuQJ58aSAOhbkGQICF9RqvyMF7Bbms0tvYmyi0YDdylBbJkrQhe62IJiQ6hkKMr9nBPHvDtrI7s5l4eEbqu2v2K1jW1tB5k1O8nvr9GlI2HqaWPg74jw7jrQUL9kyzvytaw4CtKyjlopAOwmUd+3Z195eOGVWdrnnmVsrKFisPMvIeQFoNIqt2ZiPA4Gzknj810AWGLngyysQqJ9OWIHPwHJ+GsmLnsPuTxIWHckgvY6V5YxK0zRJJZcdIsP0+8ELBVHH+VAnyILd/E7nZquPhxtYt5iwmRQPUyzExR8fMhPPP3A0CvPtG1sGetVSjm6OPgrtHimdcdcrsisbEzyEFpOtiOVQntwO3GndmNBpm8IM1UmMtcxnAm0nS47dgiSa1z11inzFXG4W5ktpbdF2e5bVUyOPusrV6M0a9fnx2R0nmE8guVA46u5Hqw/D3wstZZos5mrtmVpFXi/dTzbUwA4BiSUEQp8mcNIR34T015vAvazZ69JmsyHn84R27YmYuXX1rVyW7lVVVlYH1/k8+h1oMcantC3KbN0g1zOtS7UsNiS4LxYpkNa+RitsHacfS1jERZCQD+pfdrLH95CeP24GpY2DtGRi8GFgoycdpKLNWcfvGV0T6mhr5z8j7wxct/iPaEjvnwwt4uc57A3LYsQgkXKcYW9COO5ZUAWynzHAk49C/+XS5qWLN2PJYncMVixBWpvmsnJUsl5twMrKISJeO0KqwPAHuhWPAI4GtO2kP47bZs4mzHmtvyS05+qW1SkrsUaCyFLzRqR6LKgZ+PTrjb/WdL2C2lxQacxyOtDHGCbdYw2LxvDMa1lhCymno4CHBbmx9K3haWYaVLFHz2laLyHXotQs3DHgt1Lz8VYclWOtTbBz35g27FalMYuRMYLQjPueYoHvL+lgVdf0uNZ7p4qrubbtrcE2B3LunJW65r0beRs9PMnHDSKqcJFBGSffdu57AevBR+GTMypKcVZcdflvTkHUD/ADK5BjPI7HmORl5HqIRrRtJsPMlXmSa6xphM1pENnuFp0J8qtcq4yHGK3xrzFTH+LWOu5LzDUo5OtJIEXqYrDAsgAH/dL/8AdKnP5TbebgcVNpy4vK2ZgRNFk5JYeXb3iY5ATyeTwQ2mD+JuhPLvB1hheSWezD0Ki8ljJAEUAfEkwkaovEPG75ytAbt3HjsVjFw1eCua8ciRzEdXucxAkhieTweOwPA7aQsN2llokyJEsZcqZznGG276nXABQHhPnXKHjhzLh/BjP5PGzNXs9F6aGRQOY/LLRR8fZYk4+2hbBw+JzeG9XfeP39LcmNI3JMddpxmNlUEsoYd+eAfl+2irBiTN+DGexmOjNmyUvQxIhHLmUtLGBz27rKn/ADoVxH+Ki+G9XYdDYvsD+yexyZK1fj6FQ8hmCjuDwT8/sdCt+b7Z71d6WHX4hZzy4y3aSnj0+YO8X4mYmXZeDz9uta83K15JhWrRGVk8oczN8PdXj1Pf09Tqs8X9z5Cl+SLeBycsNXJ5iBJGjA4nhcA8HkehB+h0P7s2BlKOC29tyCnkMrjMbjnWFqSxEjIFueuVZGXqhYFgV544J5HprncOB3xncPtF8jirDZGnuT2m7CpiEVWEMOBGQ3eILwB/d6868ttWcLC0kSmcTlWWuMe1u2goKCDOQwGdJx0+JdTfO3dwYKGv4j5R4s7ljVCCrGorKzcjp9ergHjvx6aLNzYPJ4bwzu/xjcFncFupbivRWbEKxsoSROUAXtxwHH+46+/GDA5fM53ZNjGUZLMWPzaWLTKyjyoxxyx5I7fbnVz4syJ+SbNQuEe9NDVTn9cqhj+y9TfYHUy9vpaAlPOQE8fQcIoGd0umsspk8PX1jKd3D71uY27jKa5S7gsVdmqxVkm6kBWQ8hIueX46gSQDx1d+NE34fHs4vevsdmCavYhyFdXhkQqyFkniYMp7g++P+NUdLxDahSupTxyNdlvWbUF9mVmjWaRWaLpKn+W6rwwBDHnsQOQSTwNms5/xAOTsrGs01+qOIl6UVYopm6VHJPAWNB8fvro7XeizOBxIA/yOfst2bQ2UKJMHv4oMDNaoV8rWVvMMJi5HqJIiZY+Puvnj7kaXVe1h9x7YWjhdtVamNxsQWW/nMsYasdmRfel6U48yZu/BYtwAOwHbWnd2YePPYC1jHfynkUNDLxyYpVIZH/ZgDx8fT46ylnIaG2vbdt7mw+QfEy3/AGuJaM6xy1LSp0SRcsCrIVYFT69BRh6kaL2W9etXfmSaamJ0hHaTV07eZKFdSMH3gjuKfa2TlwO4GSAwpFXtt5gZFTt7NZDDsYyrCIsOw/knsCeNCDjWQN4CerkaF8QyUdyWUr1sbg4QJRUohPLSOz1Dl3kBHufIksO4GmD4feK02Inbb+Wh9+pIYHoz2VE1dlPBSGZz0TIODwjsrj0DOONTt9gU99ZvE4jWXrh80sNuS19FeAwOs+/w/tTgaFq3iBtSQKLOUGOkI5KX4nrEf+YAP7EjX1Pv7aidq+WTIPxyI6Eb2WP/AKweP340LcOfifaGL5v8hBOePU6z/wDiF3sk0MlTHSmRIVmr1infrmKlJ5h+iJC0Yb0LyN/oOu7xK8XTNBYx9GOaCNUJlr1peq06/HzJI+VrJ378FpPh7nroOw+JylmDB7hxWUoVMzkVRa9ua9HFUhBZkXHRVgGZzwAG6h0jn7sWLBYi0Q8901/vU4E222B0FprrrX79GdwWFlrWmvbXqw7Wp45ZMZuLHziOSULEOhH9VmkeTkFSAy8nvwNE34X9vvEsWQmTgxwNZf6ST8LGPuIoy32mGlVFQo7r3NH7LgZMZFC3/VatSXqhknL9Kx11/saUjpC8kDlmHuqda02LgzgNvxVZvLNuVjPbaMcIZWA5C/pUBUX9KDV9pPFli6nU9u5xz6UiGzmg89eyoNcBhl1rF9oB8WfD+tuzHy2K8EbX/LCujN0Cwq8lR1cHodSSVfg8ckEFWI0famufadU0sLQaiHnWkupKVCkZExhj2ZcvPmMfMmRRZkp57y3knpTunAWxCW4DAdlbnt1dSlx6dex6WLWHa2IOHxGYyW4rTy32uKZTWqBukKCGHltwskhb17DWod1bTw+4k6rsJjtLGY0tQ8LIqn1U8gh1/QwK/TSd3B4IXqVp7mAkKSlWUS46YV5CGBDAxOeg8gkHpdAfkNdExtNp1JCzuqPtgZdJmcu0APbOdaIKBvAe+XfL5gX8Pdrw5SvE+Jze54qV3LWKkPsmQjgStAhBR2R+83KkE9A7cd++q7FYh8/+WqeQzu4bcOfhuoW9tJStLBIwEhQ9nQIoLL6nk8H0GrfGbY8QNsV4KtAu0NOR5Kwu7eeZqzuOHaN0WTo5+PS3Gq3G7D3vJTxVavayMceMlkmpNVxNhJInkILEO6x/FR6nt++td6kqUq8EsjXgfTl7e+W6VIJuzPMdR68/eJ7HQ21uLZ2XwstE4jKY9qeQewklWtaCEx2eoSDqAdCrDt3PBA9BqnxuOSDcM58P8rkFx8gapLlbFQKzdTHiOAAGRnK8DheHbufdUnhmYzwez+auLd3Pbt3JQf6uYtmYgfpgiYj9ml4+h029pbLw23eiaCM2biJ0LZmVQY1+KxqoCxr9EA5+PJ76yPbTbaHhO8ZS9MTLnLQjUzs1xwzUN0Y+uU+U9GBjwf8ADqHblWC7drGGaME1qzkM0RYcNLIR2aZh27e6i+6vPLMzM1NTXPPPLeWVrNYfaaS0kJThH//Z";
function DitLogo({ size = 40 }) {
  return (
    <img
      src={DIT_LOGO_B64}
      alt="D&IT Transmission & Distribution"
      style={{
        width:size, height:size, borderRadius:"50%",
        objectFit:"contain", flexShrink:0,
        background:"#fff",
      }}
    />
  );
}

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import axios from "axios";

const API = window._env_?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api";
const api = axios.create({ baseURL: API });

// Inject JWT token into every request
api.interceptors.request.use(cfg => {
  const { token } = loadAuth();
  if (token) cfg.headers["Authorization"] = "Bearer " + token;
  return cfg;
});
// On 401 \u2192 clear auth and force re-login
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      clearAuth();
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

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

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
  src==="live"?<span className="badge b-ok">\u25cf LIVE</span>
  :src==="stopped"?<span className="badge b-stop">◼ STOPPED</span>
  :src==="error"?<span className="badge b-error">\u2715 ERROR</span>
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

// \u2500\u2500 Promote VM to Host Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
              {vm?.name} \u00b7 {vm?.ip!=="N/A"?vm?.ip:"IP not detected"} \u00b7 {vm?.os||"Linux"}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>\u2715</button>
        </div>
        <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,
          padding:"10px 14px",marginBottom:14,fontSize:12,color:"#166534"}}>
          ℹ This will add <strong>{vm?.name}</strong> as an independently monitored host
          with its own metrics, logs, and patch data \u2014 separate from the parent hypervisor.
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

// \u2500\u2500 Add Host Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        : (typeof detail==="string" ? detail : e.message || "Save failed \u2014 check browser console");
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
          <button className="btn btn-ghost btn-sm" onClick={onClose}>\u2715</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Host Name *","name","text","prod-server-01"],["IP Address *","ip","text","192.168.1.100"]].map(([l,k,t,p])=>(
            <div key={k}><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4}}>OS / Hypervisor</label>
            <select value={form.os_type} onChange={e=>{set("os_type",e.target.value);set("username",e.target.value==="windows"?"Administrator":"root");}}>
              <option value="linux">🐧 Linux \u2014 KVM</option>
              <option value="windows">🪟 Windows \u2014 Hyper-V</option>
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
              {testResult.status==="ok"?"\u2705 Connection Successful":"\u26a0 Connection Diagnostics"}
            </div>
            {testResult.steps?.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:4,alignItems:"flex-start"}}>
                <span style={{color:s.status==="ok"?T.green:T.red,flexShrink:0}}>{s.status==="ok"?"\u2714":"\u2717"}</span>
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

// \u2500\u2500 Storage Table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function StorageTable({storage}) {
  if(!storage?.length) return <div style={{color:T.muted,padding:"16px 0",textAlign:"center",fontSize:12}}>No storage data \u2014 click \u21bb Refresh</div>;
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

// \u2500\u2500 Active Ports Table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function ActivePortsTable({ports, onExternalScan, scanBusy}) {
  if(!ports?.length) return (
    <div style={{padding:"16px 0"}}>
      <div style={{color:T.muted,textAlign:"center",fontSize:12,marginBottom:12}}>No active port data \u2014 click \u21bb Refresh to collect from host</div>
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
            <strong>:{p.port}</strong> {p.process}{RISKY[p.port]?" \u26a0":""}
          </span>
        ))}
      </div>
      {ports.some(p=>RISKY[p.port])&&(
        <div style={{padding:"8px 12px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:7,fontSize:12,color:"#9a3412"}}>
          \u26a0 Risky ports active: {ports.filter(p=>RISKY[p.port]).map(p=>`${RISKY[p.port]}(:${p.port})`).join(", ")} \u2014 review firewall rules
        </div>
      )}
    </div>
  );
}

// \u2500\u2500 External Port Scan Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
          <div><div style={{fontWeight:700,fontSize:15}}>External Port Scan \u2014 {target}</div>
            <div style={{color:T.muted,fontSize:12}}>Scanning {ip} from InfraCommand server</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-port btn-sm" onClick={scan} disabled={busy}>{busy?<><span className="spinner"/>Scanning...</>:"\u21bb Rescan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>\u2715</button>
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
                ?result.ports.map(p=><span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>:{p.port} {p.service}{p.risky?" \u26a0":""}</span>)
                :<div style={{color:T.muted,fontSize:12}}>No open ports detected</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// \u2500\u2500 Vuln Scan Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function VulnScanModal({target,hostId,vmId,ip,onClose}) {
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [filterSev,setFilterSev]=useState("ALL");
  const [filterPkg,setFilterPkg]=useState("");
  const [page,setPage]=useState(0);
  const PAGE=20;
  const timerRef=useRef(null);

  const startTimer=()=>{
    setElapsed(0);
    timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000);
  };
  const stopTimer=()=>{
    clearInterval(timerRef.current);
    timerRef.current=null;
  };

  const scan=async(force=false)=>{
    if(!hostId||hostId==="undefined"){
      setResult({error:"Host ID not available \u2014 try closing and reopening."});
      return;
    }
    setBusy(true);
    setPage(0);
    if(force){setResult(null);startTimer();}
    try{
      const path=vmId
        ?`/hosts/${hostId}/vms/${vmId}/scan${force?"?force=true":""}`
        :`/hosts/${hostId}/scan${force?"?force=true":""}`;
      const r=await api.post(path,null,{timeout:300000}); // 5 min timeout
      setResult(r.data);
    }catch(e){
      const msg=e.code==="ECONNABORTED"
        ?"Scan timed out \u2014 the RPM/dpkg database transfer takes 2-3 min. Try again."
        :(e.response?.data?.detail||"Scan failed");
      setResult({error:msg});
    }
    stopTimer();
    setBusy(false);
  };

  useEffect(()=>{
    if(hostId&&hostId!=="undefined") scan(false);
    return ()=>stopTimer();
  },[hostId]); // eslint-disable-line

  // Filter + paginate
  const allVulns = result?.vulns||[];
  const filtered = allVulns.filter(v=>{
    if(filterSev==="PORT") return v.port_exposed===true;
    if(filterSev!=="ALL"&&v.severity!==filterSev) return false;
    if(filterPkg&&!v.pkg?.toLowerCase().includes(filterPkg.toLowerCase())) return false;
    return true;
  });
  const pages=Math.ceil(filtered.length/PAGE);
  const shown=filtered.slice(page*PAGE,(page+1)*PAGE);

  const dl=()=>{
    if(!result||result.error) return;
    const lines=allVulns.map(v=>v.id+" ["+v.severity+"] CVSS:"+v.cvss+" "+v.pkg+"@"+v.version+": "+v.desc);
    const txt="InfraCommand Vulnerability Report\nTarget: "+result.target+" ("+result.ip+")\n"
      +"Date: "+result.scanned_at+"\n\n"
      +"CRITICAL:"+result.summary?.critical+" HIGH:"+result.summary?.high
      +" MEDIUM:"+result.summary?.medium+" LOW:"+result.summary?.low+"\n\n"
      +lines.join("\n");
    const a=document.createElement("a");a.href="data:text/plain,"+encodeURIComponent(txt);
    a.download="vuln-"+result.target+"-"+Date.now()+".txt";a.click();
  };

  const fmtTime=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const SEV_COLORS={"CRITICAL":T.red,"HIGH":T.amber,"MEDIUM":T.purple,"LOW":T.muted};

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:860,maxWidth:"98vw",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>

        {/* \u2500\u2500 Header \u2500\u2500 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexShrink:0}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Vulnerability Scan \u2014 {target}</div>
            <div style={{color:T.muted,fontSize:12}}>IP: {ip}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {result&&!result.error&&<button className="btn btn-ghost btn-sm" onClick={dl}>\u2193 Export</button>}
            <button className="btn btn-scan btn-sm" onClick={()=>scan(true)} disabled={busy}>
              {busy?<><span className="spinner"/>Scanning\u2026</>:"\u21bb Rescan"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>\u2715</button>
          </div>
        </div>

        {/* \u2500\u2500 Loading state \u2500\u2500 */}
        {busy&&(
          <div style={{flexShrink:0,marginBottom:12}}>
            <div className="scan-bar"/>
            <div style={{marginTop:8,padding:"12px 16px",background:"#f8fafc",borderRadius:8,
              border:"1px solid #e2e8f0",fontSize:13,color:T.sub}}>
              <div style={{fontWeight:600,marginBottom:4}}>
                🔍 Scanning {target}\u2026 {elapsed>0&&<span style={{color:T.muted,fontWeight:400}}>({fmtTime(elapsed)})</span>}
              </div>
              <div style={{fontSize:12,color:T.muted}}>
                {elapsed<10&&"Connecting via SSH\u2026"}
                {elapsed>=10&&elapsed<30&&"Fetching package database from host\u2026"}
                {elapsed>=30&&elapsed<60&&"Transferring RPM/dpkg database (may take 1-2 min)\u2026"}
                {elapsed>=60&&elapsed<120&&"Analysing packages against CVE database\u2026"}
                {elapsed>=120&&"Almost done \u2014 large package database detected\u2026"}
              </div>
            </div>
          </div>
        )}

        {/* \u2500\u2500 Error \u2500\u2500 */}
        {result?.error&&(
          <div style={{color:T.red,padding:"10px 14px",background:"#fee2e2",borderRadius:7,fontSize:13}}>
            {result.error}
          </div>
        )}

        {/* \u2500\u2500 Results \u2500\u2500 */}
        {result&&!result.error&&(
          <div style={{display:"flex",flexDirection:"column",minHeight:0,flex:1}}>

            {/* Scanner + timestamp */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:11,color:T.muted,flexShrink:0}}>
              <span style={{background:"#f0fdf4",color:T.green,border:"1px solid #bbf7d0",
                borderRadius:5,padding:"2px 8px",fontWeight:700}}>🔍 Trivy</span>
              <span>Scanned: {result.scanned_at?toIST(result.scanned_at):"\u2014"}</span>
            </div>

            {/* Scan error banner */}
            {result.scan_error&&(
              <div style={{padding:"10px 14px",marginBottom:10,background:"#fffbeb",
                border:"1px solid #fde68a",borderRadius:7,fontSize:12,color:"#92400e",flexShrink:0}}>
                \u26a0 <strong>Scan warning:</strong> {result.scan_error}
              </div>
            )}

            {/* KPI row \u2014 clickable to filter */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:12,flexShrink:0}}>
              {[["Total",result.summary?.total,"ALL",T.blue],
                ["🔴 Critical",result.summary?.critical,"CRITICAL",T.red],
                ["🟠 High",result.summary?.high,"HIGH",T.amber],
                ["🟡 Medium",result.summary?.medium,"MEDIUM",T.purple],
                ["\u26aa Low",result.summary?.low,"LOW",T.muted],
                ["\u26a1 Port Exposed",result.summary?.port_exposed,"PORT",T.red]].map(([l,v,sev,c])=>(
                <div key={l} onClick={()=>{setFilterSev(filterSev===sev?"ALL":sev);setPage(0);}}
                  style={{padding:"8px 6px",borderRadius:8,textAlign:"center",cursor:"pointer",
                    border:`2px solid ${filterSev===sev?c:"transparent"}`,
                    background:filterSev===sev?"#fff7ed":"transparent",transition:"all .15s"}}>
                  <div style={{fontSize:18,fontWeight:800,color:c}}>{v??0}</div>
                  <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
                </div>
              ))}
            </div>

            {/* Open ports */}
            {result.open_ports?.length>0&&(
              <div style={{marginBottom:10,flexShrink:0}}>
                <div className="section-hd">Open Ports</div>
                {result.open_ports.map(p=>(
                  <span key={p.port} className={`port-chip ${p.risky?"port-risky":"port-open"}`}>
                    :{p.port} {p.service}
                  </span>
                ))}
              </div>
            )}

            {/* No vulns */}
            {allVulns.length===0&&!result.scan_error&&(
              <div style={{padding:24,textAlign:"center",color:T.green,fontWeight:600,fontSize:13}}>
                \u2705 No vulnerabilities found.
              </div>
            )}

            {/* Filter bar */}
            {allVulns.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexShrink:0}}>
                <input
                  placeholder="Filter by package\u2026"
                  value={filterPkg}
                  onChange={e=>{setFilterPkg(e.target.value);setPage(0);}}
                  style={{flex:1,padding:"5px 10px",borderRadius:6,border:"1px solid #e2e8f0",
                    fontSize:12,outline:"none"}}
                />
                <select value={filterSev} onChange={e=>{setFilterSev(e.target.value);setPage(0);}}
                  style={{padding:"5px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:12}}>
                  {["ALL","CRITICAL","HIGH","MEDIUM","LOW"].map(s=>(
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>
                  {filtered.length} of {allVulns.length}
                </span>
              </div>
            )}

            {/* Vuln table \u2014 scrollable */}
            {shown.length>0&&(
              <div style={{overflowY:"auto",flex:1,minHeight:0}}>
                <table style={{fontSize:12}}>
                  <thead style={{position:"sticky",top:0,background:"#fff",zIndex:1}}>
                    <tr>
                      <th style={{width:130}}>CVE ID</th>
                      <th style={{width:80}}>Severity</th>
                      <th style={{width:55}}>CVSS</th>
                      <th style={{width:120}}>Package</th>
                      <th style={{width:100}}>Installed</th>
                      <th style={{width:100}}>Fixed In</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((v,i)=>(
                      <tr key={`${v.id}-${i}`}>
                        <td style={{fontFamily:"IBM Plex Mono",fontSize:11}}>
                          <a href={v.url} target="_blank" rel="noreferrer"
                            style={{color:T.blue,textDecoration:"none"}}>{v.id||"\u2014"}</a>
                        </td>
                        <td>
                          <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700,
                            background:SEV_COLORS[v.severity]+"22",color:SEV_COLORS[v.severity]||T.muted}}>
                            {v.severity}
                          </span>
                        </td>
                        <td style={{fontFamily:"IBM Plex Mono",fontWeight:700,
                          color:v.cvss>=9?T.red:v.cvss>=7?T.amber:T.muted}}>
                          {v.cvss||"\u2014"}
                        </td>
                        <td>
                          <code style={{background:"#f1f5f9",padding:"1px 5px",
                            borderRadius:4,fontSize:11}}>{v.pkg}</code>
                          {v.port_exposed&&(
                            <span title={"Exposed via port "+v.exposed_port}
                              style={{marginLeft:4,fontSize:9,background:"#fee2e2",
                              color:T.red,borderRadius:3,padding:"1px 4px",fontWeight:700}}>
                              :{v.exposed_port}
                            </span>
                          )}
                        </td>
                        <td style={{fontFamily:"IBM Plex Mono",fontSize:11,color:T.muted}}>
                          {v.version||"\u2014"}
                        </td>
                        <td style={{fontFamily:"IBM Plex Mono",fontSize:11,
                          color:v.fixed_in?T.green:T.muted,fontWeight:v.fixed_in?700:400}}>
                          {v.fixed_in||"no fix"}
                        </td>
                        <td style={{color:T.sub,maxWidth:200,overflow:"hidden",
                          textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v.desc}>
                          {v.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pages>1&&(
              <div style={{display:"flex",gap:6,justifyContent:"center",
                alignItems:"center",paddingTop:10,flexShrink:0}}>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>\u2190 Prev</button>
                <span style={{fontSize:12,color:T.muted}}>
                  Page {page+1} of {pages} ({filtered.length} results)
                </span>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}>Next \u2192</button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

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

  // Safe clamped display values \u2014 guard against stale DB values > 100
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

  const tabLabel={metrics:"📊 Metrics",hardware:"🖥 Hardware",nics:"🌐 NICs",storage:"💾 Storage",
                  ports:"🔌 Ports",patch:"🔧 Patches",os:"💻 OS Info",logs:"📋 Logs"};

  // \u2500\u2500 NIC sparkline mini-bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const NicBar=({val,max,color})=>{
    const pct=max>0?Math.min(100,val/max*100):0;
    return <div style={{height:4,background:"#f1f5f9",borderRadius:2,marginTop:3}}>
      <div style={{height:4,width:`${pct}%`,background:color,borderRadius:2,transition:"width .3s"}}/>
    </div>;
  };

  // \u2500\u2500 NIC table row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
            <div style={{fontWeight:600,color:T.blue}}>{n.ipv4||"\u2014"}</div>
            {n.ipv6&&<div style={{color:T.muted,fontSize:10}}>{n.ipv6.slice(0,30)}</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>RX</div>
            <div style={{fontWeight:600,color:T.green}}>{n.rx_mb?.toFixed?.(1)||0} MB</div>
            <NicBar val={n.rx_mb||0} max={maxMB} color={T.green}/>
            {(n.rx_err>0)&&<div style={{color:T.red,fontSize:10}}>\u26a0 {n.rx_err} errors</div>}
          </div>
          <div>
            <div style={{color:T.muted}}>TX</div>
            <div style={{fontWeight:600,color:T.amber}}>{n.tx_mb?.toFixed?.(1)||0} MB</div>
            <NicBar val={n.tx_mb||0} max={maxMB} color={T.amber}/>
            {(n.tx_err>0)&&<div style={{color:T.red,fontSize:10}}>\u26a0 {n.tx_err} errors</div>}
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
                {isVM&&<span>{fmtRAM(target.ram_mb)} \u00b7 {target.vcpu} vCPU \u00b7 {target.disk_gb}GB</span>}
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
              {refreshing?<><span className="spinner"/>...</>:"\u21bb Refresh"}</button>
            <button className="btn btn-port btn-sm" onClick={()=>setPortModal(true)}>🔌 Port Scan</button>
            <button className="btn btn-scan btn-sm" onClick={()=>setVulnModal(true)}>🔍 Vuln Scan</button>
          </div>
        </div>
        {msg&&<div style={{marginTop:8,padding:"7px 12px",borderRadius:6,fontSize:12,
          background:msg.t==="ok"?"#dcfce7":"#fee2e2",color:msg.t==="ok"?"#166534":"#991b1b"}}>{msg.text}</div>}
        {m.source==="error"&&<div style={{marginTop:8,padding:"7px 12px",borderRadius:6,fontSize:12,
          background:"#fff7ed",color:"#9a3412"}}>\u26a0 Connection error: {m.reason}</div>}
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
              {m.source==="error"&&<div style={{fontSize:10,color:T.red,marginTop:4}}>\u26a0 Last collection failed</div>}
              {(!m.cpu && !m.ram)&&<div style={{fontSize:10,color:T.amber,marginTop:4}}>Click \u21bb Refresh to collect live data</div>}
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
                \u26a0 Hardware data not yet collected. Click <strong>\u21bb Refresh</strong> to collect hardware inventory.
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>

              {/* CPU Card */}
              <HwCard title="CPU / Processor" icon="\u26a1">
                <HwRow label="Model" value={hw.cpu_model} />
                <HwRow label="Architecture" value={hw.cpu_arch} />
                <HwRow label="Sockets" value={hw.cpu_sockets} />
                <HwRow label="Physical Cores" value={hw.cpu_physical_cores}
                  sub={hw.cpu_sockets&&hw.cpu_cores_per_socket ? `${hw.cpu_sockets} socket \u00d7 ${hw.cpu_cores_per_socket} cores` : null} color={T.blue}/>
                <HwRow label="Threads per Core" value={hw.cpu_threads_per_core}
                  sub="Hyper-Threading multiplier"/>
                <HwRow label="Total vCPU Capacity" value={hw.cpu_vcpu_capacity}
                  sub={`Physical cores \u00d7 threads = ${hw.cpu_physical_cores||0} \u00d7 ${hw.cpu_threads_per_core||1}`}
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
              <HwCard title="Memory / RAM" icon="🧠">
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
              <HwCard title="Local Storage" icon="💾">
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
              <HwCard title="System Summary" icon="🖧">
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
            <div className="section-hd" style={{margin:0}}>Network Interfaces ({nics.length})</div>
            <div style={{fontSize:11,color:T.muted}}>RX/TX bars show relative utilization vs peak</div>
          </div>
          {nics.length===0
            ?<div style={{textAlign:"center",color:T.muted,padding:"30px 0"}}>
               No NIC data \u2014 click \u21bb Refresh to collect
             </div>
            :nics.map(n=><NicRow key={n.name} n={n}/>)}
        </div>
      )}

      {/* Storage Tab */}
      {tab==="storage"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Storage \u2014 Local, SAN, NFS, LVM</div>
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
            }}>\u21bb Check Now</button>
          </div>
          {patch.status?(
            <>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16,
                padding:"8px 14px",borderRadius:8,background:patchColor(patch.status)+"18",
                border:`1px solid ${patchColor(patch.status)}44`}}>
                <span style={{fontSize:16}}>{patch.status==="UP TO DATE"?"\u2705":patch.status==="CRITICAL UPDATE"?"🚨":"\u26a0"}</span>
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
          ):<div style={{color:T.muted,textAlign:"center",padding:"20px 0"}}>Click \u21bb Refresh to detect OS info</div>}
        </div>
      )}

      {/* Logs Tab */}
      {tab==="logs"&&(
        <div className="card shadow" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="section-hd" style={{margin:0}}>Event Logs \u2014 {target.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={loadLogs}>\u21bb Refresh</button>
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
                    {l.level==="ERROR"?"\u2715":l.level==="WARN"?"\u26a0":"\u2713"}
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

  // \u2500\u2500 Data helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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


  // \u2500\u2500 Derived data \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  // \u2500\u2500 Resource summary (total across all hosts with live metrics) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const liveHosts = rawHosts.filter(h=>{
    const m=(hostCache[h.id]||h).metrics||{};
    return m.source==="live";
  });
  const summary = liveHosts.reduce((acc,h)=>{
    const m=(hostCache[h.id]||h).metrics||{};
    const det=hostCache[h.id]||h;
    // CPU cores \u2014 try to derive from vCPU count or default to 1
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

  // \u2500\u2500 Resource summary from overview endpoint \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [resSummary,setResSummary]=useState(null);
  useEffect(()=>{
    api.get("/overview").then(r=>setResSummary(r.data)).catch(()=>{});
  },[rawHosts.length]);

  // \u2500\u2500 UI helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const SummaryBar=({pct,color})=>(
    <div style={{height:6,background:"#f1f5f9",borderRadius:3,marginTop:4}}>
      <div style={{height:6,width:`${Math.min(100,pct||0)}%`,background:color,borderRadius:3,transition:"width .4s"}}/>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* \u2500\u2500 Resource Summary Bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      {resSummary&&(
        <div className="card shadow" style={{padding:"12px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13}}>Cluster Resource Summary</div>
            <div style={{fontSize:11,color:T.muted}}>{resSummary.total_hosts} hosts \u00b7 {allVMs.length} VMs</div>
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

      {/* \u2500\u2500 Main layout: tree + detail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
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

            {/* \u2500\u2500 PHYSICAL HOSTS TAB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
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
                            onClick={e=>refreshVMs(h.id,e)} title="Discover VMs">\u27f3</button>}
                          <span style={{fontSize:10,color:T.muted,cursor:"pointer",padding:"0 2px"}}
                            onClick={e=>{e.stopPropagation();setExpanded(ex=>({...ex,[h.id]:!ex[h.id]}));}}>{isExp?"\u25be":"\u25b8"}</span>
                          <button className="btn btn-ghost btn-sm" style={{padding:"2px 4px",fontSize:9,color:T.red}}
                            onClick={e=>deleteHost(h.id,e)}>\u2715</button>
                        </div>
                      </div>

                      {/* Hosted VMs under physical host */}
                      {isExp&&(
                        <div style={{marginLeft:14,borderLeft:`2px solid ${T.border}`,paddingLeft:8,marginBottom:2}}>
                          {vms.length===0
                            ?<div style={{padding:"5px 8px",color:T.muted,fontSize:10}}>
                                {loading===h.id+"_vms"?"Discovering...":"No VMs \u2014 click \u27f3 to discover"}
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
                                            padding:"1px 4px",border:`1px solid ${T.green}44`,borderRadius:3}}>\u2713</span>
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

            {/* \u2500\u2500 VM GROUPS TAB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
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
                        <span>{isExp?"\u25be":"\u25b8"}</span>
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
                                  <button title="Edit VM IP" onClick={()=>editVmIp(vm,h.id)}
                                    style={{fontSize:9,padding:"1px 5px",border:`1px solid ${T.muted}44`,
                                      borderRadius:3,background:"transparent",color:T.muted,cursor:"pointer"}}>✎</button>
                                  {alreadyAdded
                                    ?<span title="Already in Physical Hosts" style={{fontSize:9,color:T.green,
                                        padding:"1px 4px",border:`1px solid ${T.green}44`,borderRadius:3}}>\u2713</span>
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
                    <div style={{fontSize:11,marginTop:4}}>Click \u27f3 on a physical host to discover</div>
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
                    <td style={{fontWeight:600}}>🖥 {vm.name}</td>
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
  const [err,setErr]           = useState("");           // FIX 1: was missing \u2014 caused crash on load
  const [sel,setSel]           = useState(null);         // selected host_id for drill-down
  const [hostFilter,setHostFilter] = useState("all");

  // FIX 2: selectedHost derived from sel + data (was never declared before)
  const selectedHost = sel ? data.find(h=>h.host_id===sel) || null : null;

  // FIX 3: helper functions missing from this scope
  const gb = v => { const x=Number(v); return Number.isFinite(x)&&x>0?`${x} GB`:"\u2014"; };
  const txt = v => (v==null||v===""||v===undefined) ? "\u2014" : String(v);

  // FIX 4: StatCard was used but never defined anywhere in the file
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

  const hostOptions  = data.map(h=>({ id:h.host_id, name:h.host_name }));
  const filteredData = hostFilter==="all" ? data : data.filter(h=>h.host_id===hostFilter);

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

      {/* \u2500\u2500 Header \u2500\u2500 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:700,fontSize:16}}>Capacity Planning</div>
          <div style={{fontSize:12,color:T.muted,marginTop:2}}>
            Snapshot data from last Refresh on each host. Run \u21bb Refresh per host to update.
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={hostFilter} onChange={e=>{ setHostFilter(e.target.value); setSel(null); }} style={{minWidth:200}}>
            <option value="all">All Hosts</option>
            {hostOptions.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>
            {busy?<><span className="spinner"/>Loading...</>:"\u21bb Refresh"}
          </button>
        </div>
      </div>

      {/* \u2500\u2500 Error banner \u2500\u2500 */}
      {err&&(
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"10px 14px",color:"#b91c1c",fontSize:13}}>
          \u26a0 {err}
        </div>
      )}

      {/* \u2500\u2500 Summary cards \u2500\u2500 */}
      {filteredData.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          {[
            ["Total vCPUs",       `${totals.vcpus}`,                                                   `${totals.vcpu_alloc} allocated`,                                                  T.blue],
            ["Free vCPUs",        `${totals.vcpus-totals.vcpu_alloc}`,                                 `${totals.vcpus?Math.round((totals.vcpus-totals.vcpu_alloc)/totals.vcpus*100):0}% available`, T.green],
            ["Total RAM",         `${totals.ram.toFixed(0)} GB`,                                        `${totals.ram_alloc.toFixed(1)} GB allocated`,                                      T.blue],
            ["Free RAM",          `${(totals.ram-totals.ram_alloc).toFixed(1)} GB`,                    `${totals.ram?Math.round((totals.ram-totals.ram_alloc)/totals.ram*100):0}% available`,T.green],
            ["Local Storage",     `${totals.disk.toFixed(0)} GB`,                                       `${totals.disk_used.toFixed(1)} GB used \u00b7 ${totals.disk_free.toFixed(1)} GB free`,  T.blue],
            ["Total VMs",         `${totals.vms}`,                                                      `across ${filteredData.length} host(s)`,                                            T.purple],
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
            {filteredData.map((h,i)=>{
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
                        \u26a0 <strong>{h.host_name}</strong> \u2014 hardware inventory not yet collected.
                        Go to <strong>Infrastructure</strong> tab \u2192 select this host \u2192 click <strong>\u21bb Refresh</strong>.
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
                      {h.cpu_model||<span style={{color:T.amber,fontSize:10}}>\u21bb Refresh needed</span>}
                      {h.cpu_model&&<div style={{fontSize:9,color:T.muted}}>{h.cpu_sockets} socket{h.cpu_sockets!==1?"s":""} \u00b7 {h.cpu_pcores} cores \u00b7 {h.threads_per_core}t</div>}
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
                              No VMs found for this host. Run \u21bb Refresh on the host to discover VMs.
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
        {filteredData.length===0&&!busy&&(
          <div style={{padding:40,textAlign:"center",color:T.muted}}>
            <div style={{fontSize:28,marginBottom:8}}>📊</div>
            <div style={{fontWeight:600,marginBottom:6}}>
              {data.length===0?"No capacity data yet":"No hosts match the selected filter"}
            </div>
            <div style={{fontSize:12}}>
              {data.length===0?(
                <>Go to <strong>Infrastructure</strong> tab \u2192 select each host \u2192 click <strong>\u21bb Refresh</strong> to collect hardware inventory.</>
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
              <div style={{fontSize:12,color:T.muted}}>{selectedHost.host_ip} \u00b7 {selectedHost.cpu_model||"CPU model unknown"}</div>
            </div>
            <div style={{fontSize:11,color:T.muted}}>
              {selectedHost.hw_missing
                ? "\u26a0 Hardware snapshot incomplete \u2014 refresh host for full totals."
                : `${n(selectedHost.vm_running)} running VM(s) of ${n(selectedHost.vm_count)} total`}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:16}}>
            <StatCard label="CPU Capacity"     value={`${n(selectedHost.cpu_vcpus)} vCPU`}      sub={`${n(selectedHost.vm_vcpu_alloc)} used \u00b7 ${n(selectedHost.free_vcpus)} free`}        color={T.blue}/>
            <StatCard label="Memory Capacity"  value={gb(selectedHost.ram_total_gb)}             sub={`${gb(selectedHost.vm_ram_alloc_gb)} used \u00b7 ${gb(selectedHost.free_ram_gb)} free`}   color={T.amber}/>
            <StatCard label="Storage Capacity" value={gb(selectedHost.disk_total_gb)}            sub={`${gb(selectedHost.disk_used_gb)} host used \u00b7 ${gb(selectedHost.free_disk_gb)} free`} color={T.green}/>
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
                    No VMs in DB for this host \u2014 run \u21bb Refresh on the host to discover VMs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

  const typeIcon={Connection:"🔌","CPU":"🔥","RAM":"🧠","Disk":"💾","Storage":"💽",
                  NIC:"🌐","NIC Error":"🌐","Security Patch":"🔐","Patch":"🔧"};

  const AlertCard=({a})=>(
    <div className="card shadow" style={{padding:"12px 18px",borderLeft:`4px solid ${a.severity==="critical"?T.red:T.amber}`,
      background:a.severity==="critical"?"#fff8f8":"#fffdf0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <span style={{fontSize:18}}>{typeIcon[a.type]||"\u26a0"}</span>
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
        <button className="btn btn-ghost" onClick={load} disabled={busy}>{busy?<span className="spinner"/>:"\u21bb"} Refresh</button>
      </div>
      {alerts.length===0&&<div className="card shadow" style={{padding:40,textAlign:"center",color:T.green,fontSize:15}}>\u2705 No active alerts \u2014 all systems healthy</div>}
      {crit.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.red,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>🚨 Critical ({crit.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{crit.map(a=><AlertCard key={a.id} a={a}/>)}</div>
        </div>
      )}
      {warn.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.amber,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>\u26a0 Warnings ({warn.length})</div>
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
        <button className="btn btn-ghost" onClick={fetch}>{busy?<span className="spinner"/>:"\u21bb"} Refresh</button>
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
          {busy?<><span className="spinner"/>Running diagnostics...</>:"\u25b6 Run Full Diagnostics"}</button>
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

// \u2500\u2500 App Shell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const VIEWS=[{id:"overview",icon:"📊",label:"Overview"},{id:"infra",icon:"🖧",label:"Infrastructure"},
             {id:"logs",icon:"📋",label:"Logs"},{id:"alerts",icon:"🔔",label:"Alerts"},
             {id:"patches",icon:"🔧",label:"Patches"},{id:"capacity",icon:"📊",label:"Capacity"},{id:"scans",icon:"🔐",label:"Vuln Scans"},{id:"users",icon:"👥",label:"Users"},{id:"vmip",icon:"🔬",label:"VM IP Debug"},{id:"debug",icon:"🛠",label:"Debug"}];

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// LOGIN PAGE
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
function LoginPage({ onLogin }) {
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await axios.post(API + "/auth/login", form);
      saveAuth(r.data.access_token, r.data.user);
      // Inject token immediately
      api.defaults.headers.common["Authorization"] = "Bearer " + r.data.access_token;
      onLogin(r.data.user, r.data.must_change_pw);
    } catch (e) {
      setError(e.response?.data?.detail || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#0f1f2e",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        background:"#fff", borderRadius:16, padding:40,
        width:380, boxShadow:"0 20px 60px rgba(0,0,0,.4)",
      }}>
        {/* Logo */}
        <div style={{textAlign:"center", marginBottom:32}}>
          <div style={{textAlign:"center", marginBottom:32}}>
          <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}>
            <DitLogo size={72} />
          </div>
          <div style={{fontWeight:800, fontSize:22, color:"#0f172a"}}>InfraCommand</div>
          <div style={{color:"#64748b", fontSize:13, marginTop:4}}>Infrastructure Monitoring Platform</div>
        </div>

        <form onSubmit={submit}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block", fontSize:12, fontWeight:600,
              color:"#374151", marginBottom:6}}>Username</label>
            <input
              type="text" required autoFocus
              value={form.username}
              onChange={e => setForm(f => ({...f, username: e.target.value}))}
              style={{
                width:"100%", padding:"10px 14px", borderRadius:8,
                border:"1.5px solid #e2e8f0", fontSize:14, outline:"none",
                boxSizing:"border-box",
              }}
              onFocus={e => e.target.style.borderColor="#0369a1"}
              onBlur={e => e.target.style.borderColor="#e2e8f0"}
            />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block", fontSize:12, fontWeight:600,
              color:"#374151", marginBottom:6}}>Password</label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              style={{
                width:"100%", padding:"10px 14px", borderRadius:8,
                border:"1.5px solid #e2e8f0", fontSize:14, outline:"none",
                boxSizing:"border-box",
              }}
              onFocus={e => e.target.style.borderColor="#0369a1"}
              onBlur={e => e.target.style.borderColor="#e2e8f0"}
            />
          </div>
          {error && (
            <div style={{
              padding:"10px 14px", borderRadius:8, marginBottom:16,
              background:"#fee2e2", color:"#991b1b", fontSize:13,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width:"100%", padding:"12px", borderRadius:8, border:"none",
            background: loading ? "#94a3b8" : "#0f1f2e",
            color:"#fff", fontWeight:700, fontSize:15, cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Signing in\u2026" : "Sign In"}
          </button>
        </form>

        <div style={{textAlign:"center", marginTop:24, fontSize:11, color:"#94a3b8"}}>
          InfraCommand v3.0 \u00b7 Secured by JWT
        </div>
      </div>
    </div>
  );
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// CHANGE PASSWORD PAGE (forced on first login)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
function ChangePasswordPage({ user, onDone }) {
  const [form, setForm]   = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState("");
  const [ok, setOk]       = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError("");
    if (form.new_password !== form.confirm) {
      setError("Passwords do not match"); return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      // Update stored token if returned
      if (r.data.access_token) {
        const { user: storedUser } = loadAuth();
        saveAuth(r.data.access_token, {...storedUser, must_change_pw: false});
        api.defaults.headers.common["Authorization"] = "Bearer " + r.data.access_token;
      }
      setOk(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to change password");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#0f1f2e",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        background:"#fff", borderRadius:16, padding:40,
        width:400, boxShadow:"0 20px 60px rgba(0,0,0,.4)",
      }}>
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{fontSize:36, marginBottom:8}}>🔐</div>
          <div style={{fontWeight:800, fontSize:20, color:"#0f172a"}}>Change Your Password</div>
          <div style={{
            marginTop:10, padding:"8px 14px", background:"#fffbeb",
            border:"1px solid #fde68a", borderRadius:8, fontSize:13, color:"#92400e",
          }}>
            Welcome, <strong>{user?.full_name || user?.username}</strong>!
            You must set a new password before continuing.
          </div>
        </div>

        {ok ? (
          <div style={{
            padding:20, textAlign:"center", background:"#f0fdf4",
            borderRadius:10, color:"#059669", fontWeight:600,
          }}>
            \u2705 Password changed successfully! Redirecting\u2026
          </div>
        ) : (
          <form onSubmit={submit}>
            {[
              ["Current Password (from welcome email)", "current_password", "password"],
              ["New Password (min 8 characters)", "new_password", "password"],
              ["Confirm New Password", "confirm", "password"],
            ].map(([label, key, type]) => (
              <div key={key} style={{marginBottom:16}}>
                <label style={{display:"block", fontSize:12, fontWeight:600,
                  color:"#374151", marginBottom:6}}>{label}</label>
                <input
                  type={type} required
                  value={form[key]}
                  onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                  style={{
                    width:"100%", padding:"10px 14px", borderRadius:8,
                    border:"1.5px solid #e2e8f0", fontSize:14, outline:"none",
                    boxSizing:"border-box",
                  }}
                />
              </div>
            ))}
            {error && (
              <div style={{
                padding:"10px 14px", borderRadius:8, marginBottom:16,
                background:"#fee2e2", color:"#991b1b", fontSize:13,
              }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{
              width:"100%", padding:"12px", borderRadius:8, border:"none",
              background: loading ? "#94a3b8" : "#059669",
              color:"#fff", fontWeight:700, fontSize:15,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Saving\u2026" : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// USER MANAGEMENT PAGE (admin only)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
const PERM_LABELS = {
  view:"View Dashboard", scan:"Run Scans", refresh:"Refresh Hosts",
  patch:"Patch Management", logs:"View Logs",
  add_host:"Add Hosts", delete_host:"Delete Hosts", manage_users:"Manage Users",
};
const ROLE_COLORS = {
  admin:"#dc2626", operator:"#d97706", viewer:"#0369a1", custom:"#7c3aed",
};

function UserManagementPage({ currentUser }) {
  const [users, setUsers]         = useState([]);
  const [roles, setRoles]         = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get("/users"), api.get("/roles")]);
      setUsers(u.data); setRoles(r.data);
    } catch(e) { setError("Failed to load users"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetPw = async uid => {
    if (!window.confirm("Reset this user\'s password? They will receive a new hex password.")) return;
    try {
      const r = await api.post(`/users/${uid}/reset-password`);
      setResetResult(r.data);
    } catch(e) { alert(e.response?.data?.detail || "Reset failed"); }
  };

  const toggleActive = async (uid, current) => {
    try {
      await api.patch(`/users/${uid}`, { is_active: !current });
      load();
    } catch(e) { alert(e.response?.data?.detail || "Failed"); }
  };

  const deleteUser = async (uid, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${uid}`);
      load();
    } catch(e) { alert(e.response?.data?.detail || "Delete failed"); }
  };

  if (loading) return <div style={{padding:40, color:"#64748b"}}>Loading users\u2026</div>;

  return (
    <div style={{padding:24, maxWidth:1100}}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
        <div>
          <div style={{fontWeight:800, fontSize:20, color:"#0f172a"}}>User Management</div>
          <div style={{color:"#64748b", fontSize:13, marginTop:2}}>
            {users.length} user{users.length!==1?"s":""} \u00b7 Manage access and permissions
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          padding:"9px 18px", borderRadius:8, border:"none",
          background:"#0f1f2e", color:"#fff", fontWeight:600,
          fontSize:13, cursor:"pointer",
        }}>+ Create User</button>
      </div>

      {error && <div style={{padding:12, background:"#fee2e2", borderRadius:8,
        color:"#991b1b", marginBottom:16, fontSize:13}}>{error}</div>}

      {/* Reset password result banner */}
      {resetResult && (
        <div style={{padding:14, background:"#f0fdf4", border:"1px solid #bbf7d0",
          borderRadius:8, marginBottom:16, fontSize:13}}>
          <strong>Password Reset.</strong>{" "}
          {resetResult.email_sent
            ? `Email sent to user.`
            : <>Share this password manually: <code style={{
                background:"#1e293b", color:"#e2e8f0", padding:"3px 10px",
                borderRadius:5, fontFamily:"monospace", letterSpacing:2,
              }}>{resetResult.temp_password}</code></>
          }
          <button onClick={() => setResetResult(null)}
            style={{float:"right", background:"none", border:"none",
              cursor:"pointer", color:"#64748b"}}>\u2715</button>
        </div>
      )}

      {/* Users table */}
      <div style={{background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden"}}>
        <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
          <thead>
            <tr style={{background:"#f8fafc", borderBottom:"1px solid #e2e8f0"}}>
              {["User","Email","Role","Permissions","Status","Last Login","Actions"].map(h => (
                <th key={h} style={{padding:"12px 16px", textAlign:"left",
                  fontWeight:600, color:"#374151", fontSize:12}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{
                borderBottom: i < users.length-1 ? "1px solid #f1f5f9" : "none",
                background: !u.is_active ? "#fafafa" : "#fff",
              }}>
                <td style={{padding:"14px 16px"}}>
                  <div style={{fontWeight:600, color:"#0f172a"}}>{u.full_name||u.username}</div>
                  <div style={{color:"#64748b", fontSize:11, fontFamily:"monospace"}}>@{u.username}</div>
                  {u.must_change_pw && (
                    <span style={{fontSize:10, background:"#fef3c7", color:"#92400e",
                      borderRadius:3, padding:"1px 5px", marginTop:3, display:"inline-block"}}>
                      pw change pending
                    </span>
                  )}
                </td>
                <td style={{padding:"14px 16px", color:"#475569", fontSize:12}}>{u.email}</td>
                <td style={{padding:"14px 16px"}}>
                  <span style={{
                    padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700,
                    background:(ROLE_COLORS[u.role]||"#64748b")+"18",
                    color: ROLE_COLORS[u.role]||"#64748b",
                  }}>{u.role.toUpperCase()}</span>
                </td>
                <td style={{padding:"14px 16px", maxWidth:200}}>
                  <div style={{display:"flex", flexWrap:"wrap", gap:3}}>
                    {u.perms?.map(p => (
                      <span key={p} style={{
                        fontSize:10, background:"#f1f5f9", color:"#475569",
                        borderRadius:3, padding:"1px 5px",
                      }}>{p}</span>
                    ))}
                  </div>
                </td>
                <td style={{padding:"14px 16px"}}>
                  <span style={{
                    padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:600,
                    background: u.is_active ? "#f0fdf4" : "#f1f5f9",
                    color: u.is_active ? "#059669" : "#94a3b8",
                  }}>{u.is_active ? "Active" : "Disabled"}</span>
                </td>
                <td style={{padding:"14px 16px", color:"#64748b", fontSize:11}}>
                  {u.last_login ? toISTShort(u.last_login) : "Never"}
                </td>
                <td style={{padding:"14px 16px"}}>
                  <div style={{display:"flex", gap:6}}>
                    <button onClick={() => setEditUser(u)}
                      title="Edit" style={{
                        padding:"5px 10px", borderRadius:6, border:"1px solid #e2e8f0",
                        background:"#fff", cursor:"pointer", fontSize:12,
                      }}>✏</button>
                    <button onClick={() => resetPw(u.id)}
                      title="Reset Password" style={{
                        padding:"5px 10px", borderRadius:6, border:"1px solid #e2e8f0",
                        background:"#fff", cursor:"pointer", fontSize:12,
                      }}>🔑</button>
                    {u.id !== currentUser?.id && (
                      <>
                        <button onClick={() => toggleActive(u.id, u.is_active)}
                          title={u.is_active?"Disable":"Enable"} style={{
                            padding:"5px 10px", borderRadius:6,
                            border:"1px solid #e2e8f0",
                            background:"#fff", cursor:"pointer", fontSize:12,
                          }}>{u.is_active ? "🚫" : "\u2705"}</button>
                        <button onClick={() => deleteUser(u.id, u.username)}
                          title="Delete" style={{
                            padding:"5px 10px", borderRadius:6,
                            border:"1px solid #fee2e2",
                            background:"#fff", color:"#dc2626",
                            cursor:"pointer", fontSize:12,
                          }}>🗑</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      {(showCreate || editUser) && (
        <UserFormModal
          user={editUser}
          roles={roles}
          onClose={() => { setShowCreate(false); setEditUser(null); }}
          onSaved={result => {
            setShowCreate(false); setEditUser(null);
            if (result?.temp_password) setResetResult(result);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username:     user?.username || "",
    email:        user?.email || "",
    full_name:    user?.full_name || "",
    role:         user?.role || "viewer",
    custom_perms: user?.custom_perms || [],
    is_active:    user?.is_active ?? true,
  });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const allPerms = Object.keys(PERM_LABELS);

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let r;
      if (isEdit) {
        r = await api.patch(`/users/${user.id}`, {
          full_name:    form.full_name,
          role:         form.role,
          custom_perms: form.role === "custom" ? form.custom_perms : undefined,
          is_active:    form.is_active,
        });
        onSaved({ user: r.data });
      } else {
        r = await api.post("/users", {
          username:     form.username,
          email:        form.email,
          full_name:    form.full_name,
          role:         form.role,
          custom_perms: form.role === "custom" ? form.custom_perms : [],
        });
        onSaved(r.data);
      }
    } catch(e) { setError(e.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const togglePerm = perm => {
    setForm(f => ({
      ...f,
      custom_perms: f.custom_perms.includes(perm)
        ? f.custom_perms.filter(p => p !== perm)
        : [...f.custom_perms, perm],
    }));
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:480, maxWidth:"95vw"}}>
        <div style={{display:"flex", justifyContent:"space-between", marginBottom:20}}>
          <div style={{fontWeight:700, fontSize:16}}>
            {isEdit ? `Edit User \u2014 ${user.username}` : "Create New User"}
          </div>
          <button onClick={onClose} style={{background:"none", border:"none",
            cursor:"pointer", fontSize:18, color:"#64748b"}}>\u2715</button>
        </div>

        <form onSubmit={submit}>
          {!isEdit && (
            <>
              {[["Username","username","text"],["Email","email","email"]].map(([l,k,t])=>(
                <div key={k} style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,
                    color:"#374151",marginBottom:5}}>{l}</label>
                  <input type={t} required value={form[k]}
                    onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    style={{width:"100%",padding:"9px 12px",borderRadius:7,
                      border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}}/>
                </div>
              ))}
            </>
          )}

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,
              color:"#374151",marginBottom:5}}>Full Name</label>
            <input value={form.full_name}
              onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}
              style={{width:"100%",padding:"9px 12px",borderRadius:7,
                border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}}/>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:600,
              color:"#374151",marginBottom:5}}>Role</label>
            <select value={form.role}
              onChange={e=>setForm(f=>({...f,role:e.target.value}))}
              style={{width:"100%",padding:"9px 12px",borderRadius:7,
                border:"1px solid #e2e8f0",fontSize:13}}>
              {roles.map(r=>(
                <option key={r.role} value={r.role}>
                  {r.role.charAt(0).toUpperCase()+r.role.slice(1)} \u2014 {r.description}
                </option>
              ))}
            </select>
          </div>

          {/* Custom permissions grid */}
          {form.role === "custom" && (
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,
                color:"#374151",marginBottom:8}}>Permissions</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {allPerms.map(p=>(
                  <label key={p} style={{
                    display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                    borderRadius:7,border:"1.5px solid",cursor:"pointer",
                    borderColor: form.custom_perms.includes(p)?"#0369a1":"#e2e8f0",
                    background: form.custom_perms.includes(p)?"#eff6ff":"#fff",
                    fontSize:12,
                  }}>
                    <input type="checkbox" checked={form.custom_perms.includes(p)}
                      onChange={()=>togglePerm(p)}
                      style={{accentColor:"#0369a1"}}/>
                    {PERM_LABELS[p]||p}
                  </label>
                ))}
              </div>
            </div>
          )}

          {isEdit && (
            <div style={{marginBottom:14}}>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))}
                  style={{accentColor:"#059669",width:16,height:16}}/>
                <span style={{fontSize:13,fontWeight:500}}>Account Active</span>
              </label>
            </div>
          )}

          {error && <div style={{padding:"9px 12px",background:"#fee2e2",borderRadius:7,
            color:"#991b1b",fontSize:13,marginBottom:12}}>{error}</div>}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button type="button" onClick={onClose}
              style={{padding:"9px 18px",borderRadius:7,border:"1px solid #e2e8f0",
                background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>
            <button type="submit" disabled={loading}
              style={{padding:"9px 18px",borderRadius:7,border:"none",
                background:loading?"#94a3b8":"#0f1f2e",color:"#fff",
                fontWeight:600,fontSize:13,cursor:loading?"not-allowed":"pointer"}}>
              {loading?"Saving\u2026":(isEdit?"Save Changes":"Create User")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function AllScans() {
  const [scans,   setScans]   = useState([]);
  const [hosts,   setHosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/scans"), api.get("/hosts")])
      .then(([s, h]) => {
        setScans(s.data || []);
        setHosts(h.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build set of valid IDs (hosts + their VMs) to filter out orphaned scan records
  const validIds = new Set();
  hosts.forEach(h => {
    validIds.add(h.id);
    // VMs are stored in metrics \u2014 add them from scans that reference a host
  });
  // For scans of type "host" check host still exists
  // For scans of type "vm" we keep them (VMs are harder to cross-ref here)
  const activeScans = scans.filter(s =>
    s.target_type !== "host" || validIds.has(s.target_id)
  );
  const SEV_COLORS = {"CRITICAL":T.red,"HIGH":T.amber,"MEDIUM":T.purple,"LOW":T.muted};
  if (loading) return <div style={{padding:40,color:T.muted}}>Loading scans\u2026</div>;
  return (
    <div>
      <div style={{fontWeight:700,fontSize:18,marginBottom:16}}>Vulnerability Scan Results</div>
      {activeScans.length === 0 && (
        <div style={{padding:40,textAlign:"center",color:T.muted}}>
          No scan results yet. Click the scan icon on any host.
        </div>
      )}
      {activeScans.map(s => (
        <div key={s.target_id} style={{
          background:T.card,borderRadius:10,padding:16,
          marginBottom:12,border:`1px solid ${T.border}`
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <span style={{fontWeight:700}}>{s.target}</span>
              <span style={{color:T.muted,fontSize:12,marginLeft:8}}>{s.ip}</span>
              <span style={{
                marginLeft:8,fontSize:10,padding:"2px 7px",borderRadius:4,
                background:s.target_type==="host"?"#dbeafe":"#f3e8ff",
                color:s.target_type==="host"?"#1d4ed8":"#7c3aed",fontWeight:600
              }}>{s.target_type}</span>
            </div>
            <span style={{fontSize:11,color:T.muted}}>
              {s.scanned_at ? toIST(s.scanned_at) : "\u2014"}
            </span>
          </div>
          {s.scan_error && (
            <div style={{padding:"6px 10px",background:"#fffbeb",borderRadius:6,
              fontSize:12,color:"#92400e",marginBottom:8}}>\u26a0 {s.scan_error}</div>
          )}
          <div style={{display:"flex",gap:10}}>
            {[["CRITICAL",s.summary?.critical],["HIGH",s.summary?.high],
              ["MEDIUM",s.summary?.medium],["LOW",s.summary?.low]].map(([sev,count])=>(
              <span key={sev} style={{
                padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,
                background:(SEV_COLORS[sev]||T.muted)+"18",
                color:SEV_COLORS[sev]||T.muted,
              }}>{sev}: {count||0}</span>
            ))}
            {s.summary?.port_exposed > 0 && (
              <span style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,
                background:"#fee2e2",color:T.red}}>
                \u26a1 {s.summary.port_exposed} Port Exposed
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


export default function App() {
  // \u2500\u2500 ALL hooks must be declared before any conditional returns \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const { token: storedToken, user: storedUser } = loadAuth();
  const [authUser,     setAuthUser]    = useState(storedUser);
  const [mustChangePw, setMustChangePw] = useState(storedUser?.must_change_pw ?? false);
  const [view,         setView]        = useState("overview");
  const [hosts,        setHosts]       = useState([]);
  const [summary,      setSummary]     = useState({});
  const [history,      setHistory]     = useState([]);
  const [lastUpd,      setLastUpd]     = useState(null);

  // Restore token into axios on first mount
  useEffect(() => {
    if (storedToken) {
      api.defaults.headers.common["Authorization"] = "Bearer " + storedToken;
    }
  }, []); // eslint-disable-line

  const loadData = useCallback(async () => {
    try {
      const [h,s,hist] = await Promise.all([
        api.get("/hosts"),
        api.get("/summary"),
        api.get("/metrics/history"),
      ]);
      setHosts(h.data);
      setSummary(s.data);
      setHistory(hist.data);
      setLastUpd(new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'}));
    } catch(e) {}
  }, []); // eslint-disable-line

  useEffect(() => { if (authUser && !mustChangePw) loadData(); }, [authUser, mustChangePw, loadData]);

  // \u2500\u2500 Auth handlers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const handleLogin = (user, mustChange) => {
    setAuthUser(user);
    setMustChangePw(mustChange);
  };
  const handleLogout = () => {
    clearAuth();
    delete api.defaults.headers.common["Authorization"];
    setAuthUser(null);
    setMustChangePw(false);
  };
  const handlePasswordChanged = () => {
    const { user } = loadAuth();
    const updated = { ...(user || {}), must_change_pw: false };
    setAuthUser(updated);
    setMustChangePw(false);
  };

  // \u2500\u2500 Auth gate (AFTER all hooks) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (!authUser) return <LoginPage onLogin={handleLogin} />;
  if (mustChangePw) return (
    <ChangePasswordPage user={authUser} onDone={handlePasswordChanged} />
  );

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <div style={{width:210,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"14px 14px 12px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #1e3347"}}>
            <DitLogo size={36} />
            <div>
              <div style={{color:"#f0f9ff",fontWeight:800,fontSize:13,lineHeight:1.2}}>InfraCommand</div>
              <div style={{color:"#5b8fad",fontSize:10}}>D&IT Monitor</div>
            </div>
          </div>
          <div style={{padding:"0 8px",flex:1,overflowY:"auto"}}>
            {VIEWS.filter(v => v.id !== "users" || hasPerm(authUser,"manage_users")).map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)} style={{
                borderRadius:7,border:"none",cursor:"pointer",fontFamily:"IBM Plex Sans",
                width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 12px",
                background:view===v.id?"rgba(14,165,233,.18)":"transparent",
                color:view===v.id?"#7dd3fc":"#7a9db5",marginBottom:2,
                borderLeft:view===v.id?"3px solid #0ea5e9":"3px solid transparent",transition:"all .15s",
              }}><span>{v.icon}</span>{v.label}</button>
            ))}
          </div>
          <div style={{padding:"12px 14px",borderTop:"1px solid #1e3347",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{
                width:32,height:32,borderRadius:"50%",background:"#1e3347",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:800,color:"#7dd3fc",flexShrink:0,
              }}>
                {authUser?.username?.[0]?.toUpperCase()||"U"}
              </div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{
                  color:"#e2e8f0",fontSize:12,fontWeight:600,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                }}>
                  {authUser?.full_name||authUser?.username}
                </div>
                <span style={{
                  fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,
                  background:authUser?.role==="admin"?"#7f1d1d":
                             authUser?.role==="operator"?"#78350f":"#1e3a5f",
                  color:authUser?.role==="admin"?"#fca5a5":
                        authUser?.role==="operator"?"#fcd34d":"#93c5fd",
                }}>
                  {authUser?.role?.toUpperCase()}
                </span>
              </div>
            </div>
            <div style={{fontSize:10,color:"#3d6177",marginBottom:8}}>
              <div>{hosts.length} hosts \u00b7 {summary.total_vms||0} VMs</div>
              <div style={{color:"#2d7a4f"}}>
                {hosts.filter(h=>h.metrics?.source==="live").length} live
              </div>
              {lastUpd&&<div style={{marginTop:1}}>Updated: {lastUpd}</div>}
            </div>
            <button
              onClick={handleLogout}
              style={{
                width:"100%",padding:"7px 12px",borderRadius:7,cursor:"pointer",
                border:"1px solid #1e3347",background:"transparent",
                color:"#5b8fad",fontSize:11,fontWeight:500,
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                transition:"all .15s",
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.background="#1e3347";
                e.currentTarget.style.color="#e2e8f0";
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.background="transparent";
                e.currentTarget.style.color="#5b8fad";
              }}
            >
              \u238b Sign Out
            </button>
          </div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"11px 22px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{VIEWS.find(v=>v.id===view)?.label}</div>
              <div style={{color:T.muted,fontSize:11}}>Data persisted in DB \u00b7 use \u21bb Refresh per host to update</div>
            </div>
              <div style={{color:T.muted,fontSize:11}}>Data persisted in DB \u00b7 use \u21bb Refresh per host</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:view==="infra"?"14px":"22px"}}>
            {view==="overview" && <Overview hosts={hosts} summary={summary} history={history}/>}
            {view==="infra"    && <InfraView rawHosts={hosts} onGlobalReload={loadData}/>}
            {view==="logs"     && <Logs hosts={hosts}/>}
            {view==="alerts"   && <Alerts/>}
            {view==="patches"  && <Patches/>}
            {view==="capacity"  && <CapacityPlanning/>}
            {view==="vmip"     && <VMIPDebug hosts={hosts}/>}
            {view==="debug"    && <DebugConsole/>}
            {view==="scans"    && <AllScans/>}
            {view==="users"    && hasPerm(authUser,"manage_users") && <UserManagementPage currentUser={authUser}/>}
            {view==="users"    && !hasPerm(authUser,"manage_users") && (
              <div style={{padding:40,textAlign:"center",color:T.muted}}>
                🚫 You do not have permission to manage users.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
