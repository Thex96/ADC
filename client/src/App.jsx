import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleHelp, Clock3, Compass, Copy, Cpu, Crosshair, ExternalLink, Gauge, LayoutDashboard, LogOut, MapPin, Menu, Plus, Radio, RefreshCw, Satellite, Settings, ShieldCheck, Signal, Trash2, Wifi, X } from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { api, getError } from "./api";

function useAuth() {
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem("trackpoint_token")) return null;
    try { return JSON.parse(localStorage.getItem("trackpoint_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("trackpoint_token")));
  useEffect(() => {
    const token = localStorage.getItem("trackpoint_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then(({ data }) => {
      setUser(data.user);
      localStorage.setItem("trackpoint_user", JSON.stringify(data.user));
    }).catch(() => {
      localStorage.removeItem("trackpoint_token");
      localStorage.removeItem("trackpoint_user");
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);
  const signIn = (payload) => {
    localStorage.setItem("trackpoint_token", payload.token || "");
    localStorage.setItem("trackpoint_user", JSON.stringify(payload.user));
    setUser(payload.user);
  };
  const signOut = () => {
    localStorage.removeItem("trackpoint_token");
    localStorage.removeItem("trackpoint_user");
    setUser(null);
  };
  return { user, loading, signIn, signOut };
}

function App() {
  const auth = useAuth();
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  useEffect(() => { setMobileNav(false); }, [location.pathname]);
  const notify = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }, []);
  const protectedPage = (element) => auth.loading ? <Loading /> : auth.user ? element : <Navigate to="/login" replace />;
  return (
    <>
      {auth.user ? (
        <div className="app-shell">
          <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
            <Link to="/" className="brand"><span className="brand-mark"><Crosshair size={22} /></span><span>TRACK<span>POINT</span><small>PRECISION TRACKING</small></span></Link>
            <div className="side-caption">WORKSPACE</div>
            <nav className="side-nav">
              <NavLink to="/" end><LayoutDashboard size={18} />Overview</NavLink>
              <NavLink to="/devices"><Cpu size={18} />My devices</NavLink>
              <NavLink to="/settings"><Settings size={18} />Settings</NavLink>
            </nav>
            <div className="sidebar-bottom">
              <div className="help-card"><CircleHelp size={19}/><div><span>Need a hand?</span><small>Read the setup guide</small></div><ExternalLink size={14}/></div>
              <div className="profile-row"><div className="avatar">{(auth.user.name || "U").slice(0,1).toUpperCase()}</div><div className="profile-copy"><span>{auth.user.name}</span><small>{auth.user.email}</small></div><button className="icon-button" aria-label="Sign out" onClick={auth.signOut}><LogOut size={17}/></button></div>
            </div>
          </aside>
          {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
          <main className="main-area">
            <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <span className="breadcrumb-current">{location.pathname === "/" ? "Overview" : location.pathname.split("/")[1]?.replace(/^./, c => c.toUpperCase())}</span></div><div className="topbar-right"><span className="environment"><span/> Personal workspace</span><div className="top-avatar">{(auth.user.name || "U").slice(0,1).toUpperCase()}</div></div></header>
            <div className="page-wrap">
              <Routes>
                <Route path="/" element={protectedPage(<Dashboard notify={notify} />)} />
                <Route path="/devices" element={protectedPage(<Devices notify={notify} />)} />
                <Route path="/devices/:id" element={protectedPage(<DeviceDetails notify={notify} />)} />
                <Route path="/settings" element={protectedPage(<SettingsPage notify={notify} />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" signIn={auth.signIn} notify={notify} />} />
          <Route path="/register" element={<AuthPage mode="register" signIn={auth.signIn} notify={notify} />} />
          <Route path="*" element={auth.loading ? <Loading/> : <Navigate to="/login" replace />} />
        </Routes>
      )}
      {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    </>
  );
}

function Loading() {
  return <div className="loading-screen"><div className="spinner"/><span>Loading your workspace</span></div>;
}

function AuthPage({ mode, signIn, notify }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const register = mode === "register";
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/${register ? "register" : "login"}`, form);
      signIn(data);
      navigate("/");
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-layout">
    <div className="auth-art"><div className="auth-art-grid"/><Link to="/login" className="brand brand-light"><span className="brand-mark"><Crosshair size={22}/></span><span>TRACK<span>POINT</span><small>PRECISION TRACKING</small></span></Link><div className="auth-art-copy"><div className="eyebrow"><span/> GPS TELEMETRY PLATFORM</div><h1>Know where<br/>everything is.</h1><p>A clear view of your devices, their location, and the data that keeps them moving.</p><div className="art-stat-row"><div><Satellite size={18}/><span>Live positioning</span></div><div><ShieldCheck size={18}/><span>Private by design</span></div></div></div></div>
    <div className="auth-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><Crosshair size={22}/> TRACKPOINT</div><div className="eyebrow muted">{register ? "GET STARTED" : "WELCOME BACK"}</div><h2>{register ? "Create your account" : "Sign in to TrackPoint"}</h2><p className="auth-subtitle">{register ? "Set up your workspace and register your first tracker." : "Enter your details to access your tracking workspace."}</p>
      <form onSubmit={submit} className="form-stack">
        {register && <label>Full name<input autoComplete="name" value={form.name} onChange={update("name")} placeholder="Your name" required minLength={2} maxLength={80}/></label>}
        <label>Email address<input type="email" autoComplete="email" value={form.email} onChange={update("email")} placeholder="you@example.com" required/></label>
        <label>Password<input type="password" autoComplete={register ? "new-password" : "current-password"} value={form.password} onChange={update("password")} placeholder={register ? "At least 8 characters" : "Enter your password"} minLength={register ? 8 : 1} required/></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button full-button" disabled={busy}>{busy ? "Please wait..." : register ? "Create account" : "Sign in"}<ArrowUpRight size={17}/></button>
      </form>
      <div className="auth-switch">{register ? "Already have an account?" : "New to TrackPoint?"} <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></div>
      <p className="auth-footnote"><ShieldCheck size={14}/> Your tracking data stays associated with your account.</p>
    </div><div className="auth-copyright">TRACKPOINT © 2026 <span>BUILT FOR CLARITY</span></div></div>
  </div>;
}

function useDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/devices");
      setDevices(data.devices || []);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { devices, setDevices, loading, error, refresh };
}

function statusOf(device) {
  const latest = device.latest;
  if (!latest?.fixAt) return { label: "No telemetry", tone: "neutral" };
  const age = Date.now() - new Date(device.lastSeenAt || latest.receivedAt || latest.fixAt).getTime();
  if (age < 90000 && Date.now() - new Date(latest.fixAt).getTime() < 120000) return { label: "Online", tone: "online" };
  return { label: "Offline", tone: "offline" };
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow muted">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Dashboard({ notify }) {
  const { devices, loading, error, refresh } = useDevices();
  const online = devices.filter(d => statusOf(d).tone === "online").length;
  const latestDevice = [...devices].filter(d => d.latest?.fixAt && Number.isFinite(Number(d.latest.latitude)) && Math.abs(Number(d.latest.latitude)) <= 90 && Number.isFinite(Number(d.latest.longitude)) && Math.abs(Number(d.latest.longitude)) <= 180).sort((a,b) => new Date(b.latest.fixAt) - new Date(a.latest.fixAt))[0];
  return <div className="page-content">
    <PageHeading eyebrow="YOUR WORKSPACE" title="Overview" subtitle="A live view of your registered tracking devices." action={<button className="secondary-button" onClick={refresh}><RefreshCw size={16}/> Refresh data</button>}/>
    {error && <div className="inline-error">{error} <button onClick={refresh}>Retry</button></div>}
    <div className="metric-grid">
      <Metric icon={<Cpu size={18}/>} label="Registered devices" value={loading || error ? "—" : String(devices.length).padStart(2,"0")} note="Across your workspace" tone="gold"/>
      <Metric icon={<Wifi size={18}/>} label="Online now" value={loading || error ? "—" : String(online).padStart(2,"0")} note="Updated in the last 90 seconds" tone="green"/>
      <Metric icon={<MapPin size={18}/>} label="Latest position" value={latestDevice ? `${Number(latestDevice.latest.latitude).toFixed(4)}°, ${Number(latestDevice.latest.longitude).toFixed(4)}°` : "No fix"} note={latestDevice ? latestDevice.name : "Waiting for GPS data"} tone="blue"/>
      <Metric icon={<Activity size={18}/>} label="Tracking status" value={loading || error ? "—" : !devices.length ? "No devices" : online === devices.length ? "All active" : online ? "In progress" : devices.some(d => d.latest?.fixAt) ? "Offline" : "No GPS fix"} note="Based on recent GPS updates" tone="purple"/>
    </div>
    <div className="content-grid">
      <section className="panel map-panel"><div className="panel-header"><div><h3>Location overview</h3><p>Latest valid coordinates from your devices</p></div><span className="panel-icon"><MapPin size={18}/></span></div><div className="dashboard-map">{latestDevice ? <LocationMap device={latestDevice} /> : <EmptyMap/>}</div><div className="map-footer"><span><span className="legend-dot"/> Latest known position</span><span>{latestDevice ? `Updated ${timeAgo(latestDevice.latest.fixAt)}` : "No location available"}</span></div></section>
      <section className="panel device-panel"><div className="panel-header"><div><h3>Your devices</h3><p>Connection and signal status</p></div><Link className="text-link" to="/devices">View all <ArrowUpRight size={14}/></Link></div>
        {loading ? <div className="empty-state compact">Loading devices...</div> : error && !devices.length ? <div className="empty-state"><h4>Devices unavailable</h4><p>TrackPoint could not load your registered devices. Retry the request above.</p></div> : devices.length ? <div className="device-list">{devices.slice(0,5).map(device => <DeviceListItem key={device.id || device._id} device={device}/>)}</div> : <div className="empty-state"><div className="empty-icon"><Cpu size={22}/></div><h4>No devices yet</h4><p>Register your ESP32 tracker to start seeing location data here.</p><Link className="primary-button small-button" to="/devices"><Plus size={16}/> Add a device</Link></div>}
      </section>
    </div>
    <section className="panel activity-panel"><div className="panel-header"><div><h3>Latest telemetry</h3><p>Most recent GPS readings received by your workspace</p></div><span className="subtle-label">{devices.length} DEVICE{devices.length === 1 ? "" : "S"}</span></div>
      {devices.filter(d => d.latest?.fixAt).length ? <div className="table-wrap"><table><thead><tr><th>DEVICE</th><th>COORDINATES</th><th>SPEED</th><th>SATELLITES</th><th>ACCURACY EST.</th><th>LAST FIX</th></tr></thead><tbody>{devices.filter(d => d.latest?.fixAt).map(d => <tr key={d.id || d._id}><td><Link className="table-device" to={`/devices/${d.id || d._id}`}><span className="table-device-icon"><Cpu size={16}/></span><span>{d.name}<small>{d.deviceId}</small></span></Link></td><td className="mono">{Number(d.latest.latitude).toFixed(6)}, {Number(d.latest.longitude).toFixed(6)}</td><td>{formatNumber(d.latest.speedKmph,1," km/h")}</td><td>{formatNumber(d.latest.satellites,0,"")}</td><td>{d.latest.estimatedAccuracyM != null ? `~${formatNumber(d.latest.estimatedAccuracyM,1," m")}` : "Unavailable"}</td><td>{timeAgo(d.latest.fixAt)}</td></tr>)}</tbody></table></div> : <div className="empty-table">GPS readings will appear here once your tracker sends its first valid fix.</div>}
    </section>
    <div className="accuracy-note"><ShieldCheck size={17}/><p>Accuracy matters. TrackPoint displays receiver-reported accuracy estimates when available. Satellite count and decimal places alone do not establish positional accuracy.</p><Link to="/settings">Learn more <ArrowUpRight size={14}/></Link></div>
  </div>;
}

function Metric({ icon, label, value, note, tone }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-period">LIVE DATA</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function EmptyMap() {
  return <div className="empty-map"><div className="map-grid-art"><div className="map-road road-one"/><div className="map-road road-two"/><div className="map-road road-three"/><div className="map-road road-four"/></div><div className="map-empty-message"><span><MapPin size={23}/></span><h4>No coordinates yet</h4><p>Your device's latest position will appear on this map.</p></div><div className="map-scale">GPS / POSITIONING</div></div>;
}

function LocationMap({ device, history = [] }) {
  const point = [Number(device.latest.latitude), Number(device.latest.longitude)];
  const valid = point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
  if (!valid) return <EmptyMap/>;
  return <MapContainer center={point} zoom={16} scrollWheelZoom={true} className="leaflet-map" key={`${point[0]}-${point[1]}`}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    {history.filter(h => Number.isFinite(Number(h.latitude)) && Number.isFinite(Number(h.longitude))).slice(0,100).map((h,i) => <CircleMarker key={h._id || `${h.fixAt}-${i}`} center={[Number(h.latitude),Number(h.longitude)]} radius={i === 0 ? 8 : 4} pathOptions={{ color: i === 0 ? "#b9954b" : "#477b78", fillColor: i === 0 ? "#d7bd78" : "#477b78", fillOpacity: 0.85, weight: 2 }}><Tooltip>{new Date(h.fixAt).toLocaleString()}</Tooltip></CircleMarker>)}
  </MapContainer>;
}

function timeAgo(value) {
  if (!value) return "Never";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
  return `${Math.floor(sec/86400)}d ago`;
}
function formatNumber(value, decimals = 1, suffix = "") {
  return value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(decimals)}${suffix}`;
}

function DeviceListItem({ device }) {
  const status = statusOf(device);
  return <Link className="device-list-item" to={`/devices/${device.id || device._id}`}><span className="device-symbol"><Cpu size={18}/></span><span className="device-list-copy"><span>{device.name}</span><small>{device.deviceId}</small></span><span className={`status-pill ${status.tone}`}><i/>{status.label}</span><ArrowUpRight size={15} className="device-arrow"/></Link>;
}

function Devices({ notify }) {
  const { devices, loading, error, refresh } = useDevices();
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [newToken, setNewToken] = useState("");
  const [createdDevice, setCreatedDevice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState("");
  async function createDevice(event) {
    event.preventDefault();
    setBusy(true); setFormError("");
    try {
      const { data } = await api.post("/devices", { name, deviceId });
      setCreatedDevice(data.device); setNewToken(data.deviceToken); await refresh();
    } catch (err) {
      setFormError(getError(err));
    } finally { setBusy(false); }
  }
  async function removeDevice(device) {
    if (!window.confirm(`Delete "${device.name}" and its location history?`)) return;
    setDeleting(device.id || device._id);
    try {
      await api.delete(`/devices/${device.id || device._id}`);
      await refresh(); notify("Device deleted.");
    } catch (err) { notify(getError(err)); }
    finally { setDeleting(""); }
  }
  function closeModal() {
    setModal(false); setName(""); setDeviceId(""); setFormError(""); setNewToken(""); setCreatedDevice(null); setCopied(false);
  }
  return <div className="page-content">
    <PageHeading eyebrow="DEVICE MANAGEMENT" title="My devices" subtitle="Register, pair, and manage the trackers connected to your account." action={<button className="primary-button" onClick={() => setModal(true)}><Plus size={17}/> Add device</button>}/>
    {error && <div className="inline-error">{error} <button onClick={refresh}>Retry</button></div>}
    <div className="devices-summary"><div><span className="summary-number">{loading ? "—" : String(devices.length).padStart(2,"0")}</span><span>Registered devices</span></div><div><span className="summary-number">{loading ? "—" : String(devices.filter(d=>statusOf(d).tone==="online").length).padStart(2,"0")}</span><span>Online now</span></div><div><span className="summary-number">{loading ? "—" : String(devices.filter(d=>d.latest?.fixAt).length).padStart(2,"0")}</span><span>With GPS fixes</span></div><div className="summary-help"><Radio size={19}/><span>Devices are private to your account.</span></div></div>
    <section className="panel devices-panel"><div className="panel-header"><div><h3>Registered trackers</h3><p>Manage your hardware and review the latest connection state.</p></div><button className="icon-button bordered" onClick={refresh} aria-label="Refresh devices"><RefreshCw size={17}/></button></div>
      {loading ? <div className="empty-state compact">Loading devices...</div> : error && !devices.length ? <div className="empty-state"><h4>Devices unavailable</h4><p>TrackPoint could not load your registered devices. Retry the request above.</p></div> : devices.length ? <div className="managed-device-list">{devices.map(device => <div className="managed-device" key={device.id || device._id}><Link to={`/devices/${device.id || device._id}`} className="managed-device-main"><span className="device-symbol large"><Cpu size={21}/></span><span className="managed-device-copy"><span>{device.name}</span><small>{device.deviceId} <span className="dot-separator"/> Added {new Date(device.createdAt).toLocaleDateString()}</small><span className={`status-pill ${statusOf(device).tone}`}><i/>{statusOf(device).label}</span></span></Link><div className="managed-device-data"><span>LAST LOCATION</span><p>{device.latest ? `${Number(device.latest.latitude).toFixed(5)}, ${Number(device.latest.longitude).toFixed(5)}` : "Waiting for first fix"}</p><small>{device.latest ? `Updated ${timeAgo(device.latest.fixAt)}` : "No telemetry received"}</small></div><div className="managed-actions"><Link to={`/devices/${device.id || device._id}`} className="secondary-button small-button">Details <ArrowUpRight size={14}/></Link><button className="icon-button danger-button" aria-label={`Delete ${device.name}`} disabled={deleting === (device.id || device._id)} onClick={() => removeDevice(device)}><Trash2 size={17}/></button></div></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Cpu size={24}/></div><h4>Nothing registered yet</h4><p>Give your tracker a name and device ID to connect it to this workspace.</p><button className="primary-button" onClick={() => setModal(true)}><Plus size={16}/> Register your first device</button></div>}
    </section>
    <div className="setup-hint"><div className="hint-icon"><Signal size={19}/></div><div><h4>Ready to connect your ESP32?</h4><p>After registering, copy the device token and add it to the firmware configuration. The token is shown only once.</p></div><Link to="/settings" className="text-link">Setup guide <ArrowUpRight size={14}/></Link></div>
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !newToken) closeModal(); }}><div className="modal-card"><div className="modal-header"><div><div className="eyebrow muted">{newToken ? "DEVICE REGISTERED" : "NEW TRACKER"}</div><h2>{newToken ? "Your device is ready" : "Register a device"}</h2></div><button className="icon-button" onClick={closeModal} aria-label="Close dialog"><X size={19}/></button></div>
      {newToken ? <div className="token-result"><div className="success-mark"><Check size={22}/></div><p>Save this device token now. It will not be shown again.</p><label>DEVICE ID<div className="copy-field"><code>{createdDevice?.deviceId}</code><button className="icon-button" onClick={() => { navigator.clipboard?.writeText(createdDevice?.deviceId || ""); setCopied(true); }} aria-label="Copy device ID"><Copy size={16}/></button></div></label><label>DEVICE API TOKEN<div className="copy-field token-copy"><code>{newToken}</code><button className="icon-button" onClick={() => { navigator.clipboard?.writeText(newToken); setCopied(true); }} aria-label="Copy device token"><Copy size={16}/></button></div></label>{copied && <span className="copy-confirm">Copied to clipboard</span>}<div className="token-warning"><ShieldCheck size={17}/><span>Treat this token like a password. Anyone who has it can submit data as this device.</span></div><button className="primary-button full-button" onClick={closeModal}>Done <Check size={16}/></button></div> : <form className="form-stack modal-form" onSubmit={createDevice}><p className="modal-description">Give the hardware a recognizable name and a unique ID. You will connect it using the token generated after registration.</p><label>Device name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Campus GPS Tracker" minLength={2} maxLength={80} required/></label><label>Unique device ID<input value={deviceId} onChange={e=>setDeviceId(e.target.value.toUpperCase().replace(/\s/g,"-"))} placeholder="e.g. your-device-id" minLength={3} maxLength={48} pattern="[A-Za-z0-9_-]{3,48}" required/><small className="field-help">Use 3–48 letters, numbers, hyphens, or underscores.</small></label>{formError && <div className="form-error">{formError}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Registering..." : "Register device"}<ArrowUpRight size={16}/></button></div></form>}
    </div></div>}
  </div>;
}

function DeviceDetails({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get(`/devices/${id}`);
      setDevice(data.device); setHistory(data.history || []);
    } catch (err) { setError(getError(err)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const visibleHistory = useMemo(() => {
    if (range === "all") return history;
    const cutoff = Date.now() - Number(range) * 3600000;
    return history.filter(item => new Date(item.fixAt).getTime() >= cutoff);
  }, [history, range]);
  if (loading) return <Loading/>;
  if (error || !device) return <div className="page-content"><button className="back-link" onClick={() => navigate("/devices")}><ArrowLeft size={16}/> Back to devices</button><div className="inline-error">{error || "Device not found."}</div></div>;
  const status = statusOf(device);
  return <div className="page-content">
    <button className="back-link" onClick={() => navigate("/devices")}><ArrowLeft size={16}/> All devices</button>
    <PageHeading eyebrow={`DEVICE / ${device.deviceId}`} title={device.name} subtitle="Position details, incoming telemetry, and recent GPS history." action={<button className="secondary-button" onClick={refresh}><RefreshCw size={16}/> Refresh</button>}/>
    <div className="device-detail-status"><span className={`status-pill ${status.tone}`}><i/>{status.label}</span><span>Last received: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}</span><span>Registered: {new Date(device.createdAt).toLocaleDateString()}</span></div>
    <div className="detail-metrics"><Metric icon={<MapPin size={18}/>} label="Latitude" value={device.latest ? Number(device.latest.latitude).toFixed(7) : "—"} note="Decimal degrees" tone="gold"/><Metric icon={<Compass size={18}/>} label="Longitude" value={device.latest ? Number(device.latest.longitude).toFixed(7) : "—"} note="Decimal degrees" tone="blue"/><Metric icon={<Gauge size={18}/>} label="Speed" value={formatNumber(device.latest?.speedKmph,1," km/h")} note="Latest receiver reading" tone="green"/><Metric icon={<Crosshair size={18}/>} label="Estimated accuracy" value={device.latest?.estimatedAccuracyM != null ? `~${formatNumber(device.latest.estimatedAccuracyM,1," m")}` : "—"} note="Receiver-derived estimate, if supplied" tone="purple"/></div>
    <div className="content-grid detail-grid"><section className="panel map-panel"><div className="panel-header"><div><h3>Current location</h3><p>{device.latest ? `GPS fix ${new Date(device.latest.fixAt).toLocaleString()}` : "Waiting for first GPS fix"}</p></div><span className="panel-icon"><MapPin size={18}/></span></div><div className="detail-map">{device.latest ? <LocationMap device={device} history={visibleHistory}/> : <EmptyMap/>}</div><div className="map-footer"><span><span className="legend-dot"/> Latest fix</span><span>{device.latest?.satellites != null ? `${device.latest.satellites} satellites` : "Satellite count unavailable"}</span></div></section>
      <section className="panel telemetry-panel"><div className="panel-header"><div><h3>Signal diagnostics</h3><p>Available receiver metadata</p></div><Satellite size={19} className="muted-icon"/></div><Diagnostic label="Satellites used/reported" value={formatNumber(device.latest?.satellites,0,"")} /><Diagnostic label="HDOP" value={formatNumber(device.latest?.hdop,2,"")} /><Diagnostic label="Altitude" value={formatNumber(device.latest?.altitudeM,1," m")} /><Diagnostic label="GPS fix time" value={device.latest?.fixAt ? new Date(device.latest.fixAt).toLocaleTimeString() : "No fix"} /><Diagnostic label="Server received" value={device.latest?.receivedAt ? new Date(device.latest.receivedAt).toLocaleTimeString() : "No data"} /><div className="diagnostic-note">HDOP describes satellite geometry; it is not a guaranteed distance-error measurement. Accuracy depends on receiver support and conditions.</div></section></div>
    <section className="panel history-panel"><div className="panel-header"><div><h3>Location history</h3><p>Recent GPS fixes received by the server</p></div><select value={range} onChange={e=>setRange(e.target.value)} className="select-control"><option value="all">All recent fixes</option><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option></select></div>
      {visibleHistory.length ? <div className="table-wrap"><table><thead><tr><th>FIX TIME</th><th>LATITUDE</th><th>LONGITUDE</th><th>SPEED</th><th>SATELLITES</th><th>ACCURACY EST.</th></tr></thead><tbody>{visibleHistory.map((item,i)=><tr key={item._id || `${item.fixAt}-${i}`}><td>{new Date(item.fixAt).toLocaleString()}</td><td className="mono">{Number(item.latitude).toFixed(7)}</td><td className="mono">{Number(item.longitude).toFixed(7)}</td><td>{formatNumber(item.speedKmph,1," km/h")}</td><td>{formatNumber(item.satellites,0,"")}</td><td>{item.estimatedAccuracyM != null ? `~${formatNumber(item.estimatedAccuracyM,1," m")}` : "Unavailable"}</td></tr>)}</tbody></table></div> : <div className="empty-table">No fixes found in this time range.</div>}
    </section>
  </div>;
}

function Diagnostic({ label, value }) {
  return <div className="diagnostic-row"><span>{label}</span><span>{value}</span></div>;
}

function SettingsPage() {
  const [copied, setCopied] = useState(false);
  const firmware = `const char* WIFI_SSID = "YOUR_WIFI_NAME";\nconst char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";\nconst char* API_BASE_URL = "https://your-domain.example/api";\nconst char* DEVICE_ID = "YOUR_REGISTERED_DEVICE_ID";\nconst char* DEVICE_TOKEN = "YOUR_DEVICE_TOKEN";`;
  return <div className="page-content"><PageHeading eyebrow="WORKSPACE" title="Settings & setup" subtitle="Connect your ESP32 GPS tracker and understand how TrackPoint handles location data."/>
    <div className="settings-layout"><section className="panel settings-panel"><div className="settings-section-title"><div className="settings-icon"><Wifi size={19}/></div><div><h3>Connect your ESP32</h3><p>Follow these steps to send GPS readings to your dashboard.</p></div></div><div className="setup-steps"><div className="setup-step"><span>01</span><div><h4>Register your device</h4><p>Go to My devices and create a device name and unique ID. Save the generated token securely.</p><Link to="/devices" className="text-link">Open device management <ArrowUpRight size={14}/></Link></div></div><div className="setup-step"><span>02</span><div><h4>Configure the firmware</h4><p>Open <code>firmware/trackpoint_esp32.ino</code> and fill in your Wi-Fi credentials, public API URL, device ID, and token.</p><div className="code-panel"><div className="code-panel-head"><span>CONFIGURATION EXAMPLE</span><button className="icon-button" onClick={() => {navigator.clipboard?.writeText(firmware);setCopied(true);}} aria-label="Copy configuration"><Copy size={15}/></button></div><pre>{firmware}</pre></div>{copied && <small className="copy-confirm">Configuration copied</small>}</div></div><div className="setup-step"><span>03</span><div><h4>Upload and test</h4><p>Flash the sketch, place the GPS antenna outdoors, and wait for a valid fix. New telemetry should appear after the ESP32 posts it to your API.</p></div></div></div></section>
      <section className="panel settings-panel"><div className="settings-section-title"><div className="settings-icon"><Crosshair size={19}/></div><div><h3>Location accuracy</h3><p>How to get the most reliable position.</p></div></div><div className="accuracy-list"><div><Check size={16}/><p><span>Use a clear sky view</span><small>Mount the antenna away from metal, walls, and electrical noise.</small></p></div><div><Check size={16}/><p><span>Wait for a valid fix</span><small>Do not treat coordinates as live until the receiver reports a fresh fix.</small></p></div><div><Check size={16}/><p><span>Use a capable receiver</span><small>Multi-constellation or multi-band GNSS can improve availability and performance.</small></p></div><div><Check size={16}/><p><span>Interpret accuracy honestly</span><small>HDOP is a geometry indicator, not a guaranteed error radius. RTK needs compatible hardware and correction data.</small></p></div></div><div className="settings-callout"><ShieldCheck size={18}/><p>Location history can reveal sensitive movement patterns. Protect your device token and deploy the API over HTTPS before using it outside your local network.</p></div></section></div>
    <div className="footer-note">TRACKPOINT <span>GPS TELEMETRY & DEVICE MANAGEMENT</span><span>VERSION 1.0.0</span></div>
  </div>;
}

export default App;
