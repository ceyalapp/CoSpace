// CollabBuy responsive web client.
// Bundled with esbuild (see `npm run build`). Supabase Auth + Realtime; data via /api/*.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

if (!window.__SB_CONFIG || !window.__SB_CONFIG.url || !window.__SB_CONFIG.anonKey) {
  throw new Error('config.js did not set window.__SB_CONFIG — check the server is running');
}

const sb = createClient(
  window.__SB_CONFIG.url,
  window.__SB_CONFIG.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

// ─── API client (attaches Bearer token from supabase session) ─
async function authHeaders() {
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const api = {
  async get(path) {
    const r = await fetch('/api' + path, { headers: await authHeaders() });
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  },
  async send(path, method, body) {
    const r = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${path}`);
    return r.status === 204 ? null : r.json();
  },
  post(p, b)   { return this.send(p, 'POST', b); },
  patch(p, b)  { return this.send(p, 'PATCH', b); },
  del(p)       { return this.send(p, 'DELETE'); },
};

// ─── Viewport hook ───────────────────────────────────────────
function useViewport() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return { w, isDesktop: w >= 960 };
}

// ─── Icon (subset of design's lucide-ish set) ────────────────
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.6, style }) {
  const paths = {
    home: <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></>,
    store: <><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11h18V9"/></>,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h4"/></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 7 2 7H4s2-2 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    arrowRight: <path d="M5 12h14M13 5l7 7-7 7"/>,
    arrowLeft:  <path d="M19 12H5M11 5l-7 7 7 7"/>,
    chevronRight: <path d="M9 6l6 6-6 6"/>,
    chevronDown:  <path d="M6 9l6 6 6-6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="M5 12l4 4 10-10"/>,
    close: <path d="M6 6l12 12M6 18L18 6"/>,
    star: <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3z"/>,
    starFill: <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3z" fill="currentColor"/>,
    users: <><circle cx="9" cy="9" r="3.5"/><path d="M3 19c.8-3 3.4-5 6-5s5.2 2 6 5"/><path d="M15 9a3 3 0 1 0 0-6"/><path d="M21 19a5 5 0 0 0-4-5"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/></>,
    flame: <path d="M12 3s-5 4-5 9a5 5 0 0 0 10 0c0-2-1-4-2-5 0 2-1 3-2 3 0-3 0-5-1-7z"/>,
    pin: <><path d="M12 17v5"/><path d="M9 2h6l-1 5 3 3v3H7v-3l3-3-1-5z"/></>,
    heart: <path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z"/>,
    reply: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 0 1 7-13 8 8 0 0 1 8 8z"/>,
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>,
    sparkles: <><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></>,
  };
  const isFilled = name === 'starFill';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={isFilled ? color : 'none'}
         stroke={isFilled ? 'none' : color} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ flex: 'none', display: 'block', ...style }}>
      {paths[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

function Avatar({ name, color = '#6E8FB5', size = 32 }) {
  return (
    <div className="avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name}
    </div>
  );
}

function Heat({ heat }) {
  return <span className={`heat-dot heat-${heat}`} title={heat} />;
}

function Progress({ value }) {
  return <div className="progress"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}

function Toast({ msg }) {
  return msg ? <div className="toast">{msg}</div> : null;
}

// ─── BottomSheet / Modal primitive ───────────────────────────
function BottomSheet({ open, onClose, title, children, isDesktop }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${isDesktop ? 'sheet-desktop' : 'sheet-mobile'}`} onClick={e => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ─── NewRequirementSheet ─────────────────────────────────────
function NewRequirementSheet({ open, onClose, onCreated, isDesktop }) {
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('home');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { if (open) { setTitle(''); setCat('home'); setErr(null); setBusy(false); } }, [open]);

  const cats = [
    { id: 'home',    label: 'Home setup',        emoji: '🏠' },
    { id: 'service', label: 'Recurring service', emoji: '🔧' },
    { id: 'admin',   label: 'RWA / admin',       emoji: '📋' },
    { id: 'event',   label: 'Community event',   emoji: '🎉' },
  ];

  const submit = async () => {
    const t = title.trim();
    if (t.length < 3) { setErr('Give it a name (3+ chars).'); return; }
    setBusy(true); setErr(null);
    try {
      const emoji = cats.find(c => c.id === cat)?.emoji;
      const created = await api.post('/requirements', { title: t, category: cat, emoji });
      onCreated?.(created);
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not create. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Start a new requirement" isDesktop={isDesktop}>
      <p className="sheet-blurb">Before you create one — search to see if a neighbour already started this. Duplicate spaces split the knowledge.</p>

      <label className="form-label">What are you trying to do?</label>
      <input
        className="form-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Install soundproof windows"
        autoFocus
        maxLength={80}
      />

      <label className="form-label" style={{ marginTop: 16 }}>Category</label>
      <div className="cat-pick-grid">
        {cats.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`cat-pick ${cat === c.id ? 'is-active' : ''}`}>
            <span style={{ marginRight: 6 }}>{c.emoji}</span>{c.label}
          </button>
        ))}
      </div>

      <div className="sheet-hint">
        <Icon name="sparkles" size={16} color="#7B5A0E" style={{ marginTop: 2, flex: 'none' }} />
        <span>We'll add this to your active list — neighbours can join and share knowledge as it grows.</span>
      </div>

      {err && <div className="form-err">{err}</div>}

      <button className="btn btn-primary btn-full" disabled={busy} onClick={submit}>
        {busy ? 'Creating…' : 'Create requirement'} {!busy && <Icon name="arrowRight" size={14} />}
      </button>
    </BottomSheet>
  );
}

// ─── NotificationsSheet ──────────────────────────────────────
function NotificationsSheet({ open, onClose, onOpenReq, onOpenVendor, onRead, isDesktop }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications').then(r => {
      setItems(r.items || []);
      setLoading(false);
      // Opening the sheet marks everything read; clear the bell badge.
      if ((r.unread || 0) > 0) {
        api.post('/notifications/read').then(() => onRead?.()).catch(() => {});
      }
    }).catch(() => { setItems([]); setLoading(false); });
  }, [open]);

  const filtered = filter === 'unread' ? items.filter(i => i.unread) : items;
  const unreadCount = items.filter(i => i.unread).length;

  return (
    <BottomSheet open={open} onClose={onClose} title="Notifications" isDesktop={isDesktop}>
      <div className="notif-chips">
        <button className={`chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`chip ${filter === 'unread' ? 'is-active' : ''}`} onClick={() => setFilter('unread')}>Unread · {unreadCount}</button>
      </div>

      {loading && <div className="notif-empty">Loading…</div>}
      {!loading && filtered.length === 0 && <div className="notif-empty">Nothing new yet.</div>}

      <div className="notif-list">
        {filtered.map((it) => {
          const onClick = () => {
            if (it.link?.kind === 'req') { onOpenReq?.(it.link.id); }
            else if (it.link?.kind === 'vendor') { onOpenVendor?.(it.link.id); }
            onClose();
          };
          return (
            <button key={it.id} className={`notif-item ${it.unread ? 'is-unread' : ''}`} onClick={onClick}>
              {it.unread && <span className="notif-dot" />}
              <div className={`notif-ico notif-${it.tone}`}>
                <Icon name={it.icon} size={18} />
              </div>
              <div className="notif-body">
                <div className="notif-row1">
                  <span className="notif-title">{it.title}</span>
                  <span className="notif-time">{it.time}</span>
                </div>
                <div className="notif-sub">{it.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// ─── Top-level App ───────────────────────────────────────────
const TABS = [
  { id: 'home',    label: 'Explore', icon: 'home' },
  { id: 'vendors', label: 'Vendors', icon: 'store' },
  { id: 'plans',   label: 'Plans',   icon: 'grid' },
  { id: 'me',      label: 'Me',      icon: 'user' },
];

// ─── Onboarding (new members: pick/create community + profile) ─
function OnboardingScreen({ onDone }) {
  const [communities, setCommunities] = useState(null);
  const [mode, setMode]   = useState('join');   // 'join' | 'create'
  const [name, setName]   = useState('');
  const [flat, setFlat]   = useState('');
  const [block, setBlock] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [newName, setNewName] = useState('');
  const [status, setStatus]   = useState('idle');
  const [err, setErr]         = useState('');

  useEffect(() => {
    api.get('/communities')
      .then(list => { setCommunities(list); if (list[0]) setCommunityId(list[0].id); })
      .catch(() => setCommunities([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('Please enter your name.'); return; }
    if (mode === 'join' && !communityId) { setErr('Pick a community.'); return; }
    if (mode === 'create' && newName.trim().length < 2) { setErr('Name your community.'); return; }
    setStatus('busy'); setErr('');
    try {
      await api.post('/me/onboard', {
        name: name.trim(), flat: flat.trim(), block: block.trim(),
        ...(mode === 'join' ? { communityId } : { newCommunityName: newName.trim() }),
      });
      onDone();
    } catch (e2) { setStatus('idle'); setErr('Something went wrong. Try again.'); }
  };

  const inputStyle = { padding: 12, borderRadius: 12, border: '1px solid var(--cb-border)', font: 'inherit', width: '100%' };

  return (
    <div className="boot" style={{ padding: 24, alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="card card-pad" style={{ maxWidth: 440, width: '100%', margin: '32px auto' }}>
        <div className="text-display font-bold" style={{ fontSize: 22 }}>Welcome to CollabBuy</div>
        <div className="text-sm muted mt-2">Tell your neighbours who you are, and join your community.</div>

        <form onSubmit={submit} className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="text-xs muted">Your name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Menon" style={inputStyle} />

          <div className="flex gap-2">
            <div style={{ flex: 1 }}>
              <label className="text-xs muted">Flat</label>
              <input value={flat} onChange={e => setFlat(e.target.value)} placeholder="C-0807" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-xs muted">Block</label>
              <input value={block} onChange={e => setBlock(e.target.value)} placeholder="C" style={inputStyle} />
            </div>
          </div>

          <div className="flex gap-2 mt-2" role="tablist">
            <button type="button" role="tab"
              className={`chip ${mode === 'join' ? 'chip-sage' : ''}`}
              onClick={() => setMode('join')}>Join a community</button>
            <button type="button" role="tab"
              className={`chip ${mode === 'create' ? 'chip-sage' : ''}`}
              onClick={() => setMode('create')}>Create new</button>
          </div>

          {mode === 'join' && (
            communities === null
              ? <div className="text-sm muted">Loading communities…</div>
              : communities.length === 0
                ? <div className="text-sm muted">No communities yet — create the first one.</div>
                : <select value={communityId} onChange={e => setCommunityId(e.target.value)} style={inputStyle}>
                    {communities.map(c => (
                      <option key={c.id} value={c.id}>{c.name} · {c.members} {c.members === 1 ? 'member' : 'members'}</option>
                    ))}
                  </select>
          )}

          {mode === 'create' && (
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Prestige Lakeside Habitat" style={inputStyle} />
          )}

          <button className="btn btn-primary mt-2" disabled={status === 'busy'}>
            {status === 'busy' ? 'Setting up…' : 'Enter CollabBuy'}
          </button>
          {err && <div className="text-xs" style={{ color: '#A6586A' }}>{err}</div>}
        </form>
      </div>
    </div>
  );
}

function App() {
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]); // back-stack of routes
  const [me, setMe] = useState(null);
  const [meErr, setMeErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [sheet, setSheet] = useState(null); // 'newRequirement' | 'notifications' | null
  const [meBump, setMeBump] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  useEffect(() => {
    api.get('/me').then(setMe).catch(err => setMeErr(err.message || 'Failed to load'));
  }, [meBump]);

  const refreshNotif = useCallback(() => {
    api.get('/notifications').then(r => setNotifUnread(r.unread || 0)).catch(() => {});
  }, []);
  useEffect(() => { refreshNotif(); }, [meBump, refreshNotif]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const route = stack[stack.length - 1] || { kind: 'tab' };
  const navigate = useCallback((next) => setStack(s => [...s, next]), []);
  const goBack = useCallback(() => setStack(s => s.slice(0, -1)), []);
  const goTab = useCallback((t) => { setTab(t); setStack([]); }, []);
  const openSheet = useCallback((s) => setSheet(s), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const refreshMe = useCallback(() => setMeBump(b => b + 1), []);

  if (meErr) return (
    <div className="boot"><div className="boot-label">Couldn't reach the server.</div>
      <button className="btn btn-primary" onClick={() => { setMeErr(null); api.get('/me').then(setMe).catch(err => setMeErr(err.message || 'Failed to load')); }}>Retry</button></div>
  );
  if (!me) return null;
  if (me.needsOnboarding) return <OnboardingScreen onDone={refreshMe} />;

  const ctx = { me, navigate, goBack, goTab, tab, showToast, isDesktop, openSheet, refreshMe, notifUnread, refreshNotif };

  const screen = (() => {
    if (route.kind === 'req')     return <RequirementScreen ctx={ctx} reqId={route.id} />;
    if (route.kind === 'vendor')  return <VendorScreen ctx={ctx} vendorId={route.id} />;
    if (route.kind === 'search')  return <SearchScreen ctx={ctx} />;
    switch (tab) {
      case 'vendors': return <VendorsScreen ctx={ctx} />;
      case 'plans':   return <PlansScreen ctx={ctx} />;
      case 'me':      return <MeScreen ctx={ctx} />;
      default:        return <HomeScreen ctx={ctx} />;
    }
  })();

  return (
    <div className="app">
      {isDesktop
        ? <DesktopShell tab={tab} onTab={goTab} me={me} onOpenSheet={openSheet} notifUnread={notifUnread}>{screen}</DesktopShell>
        : <MobileShell tab={tab} onTab={goTab}>{screen}</MobileShell>}
      <Toast msg={toast} />
      <NewRequirementSheet
        open={sheet === 'newRequirement'}
        onClose={closeSheet}
        isDesktop={isDesktop}
        onCreated={(req) => {
          showToast(`Started "${req.title}"`);
          refreshMe();
          navigate({ kind: 'req', id: req.id });
        }}
      />
      <NotificationsSheet
        open={sheet === 'notifications'}
        onClose={closeSheet}
        isDesktop={isDesktop}
        onOpenReq={(id) => navigate({ kind: 'req', id })}
        onOpenVendor={(id) => navigate({ kind: 'vendor', id })}
        onRead={refreshNotif}
      />
    </div>
  );
}

// ─── Shells ─────────────────────────────────────────────────
function MobileShell({ tab, onTab, children }) {
  return (
    <div className="shell-mobile">
      <div style={{ flex: 1 }}>{children}</div>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>
            <span className="tab-icon"><Icon name={t.icon} size={20} /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function DesktopShell({ tab, onTab, me, onOpenSheet, notifUnread = 0, children }) {
  return (
    <div className="shell-desktop">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">cb</div>
          <div className="brand-name">CollabBuy</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--cb-muted)', padding: '0 10px 12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {me.communityShort}
        </div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary" style={{ justifyContent: 'flex-start' }} onClick={() => onOpenSheet?.('newRequirement')}>
            <Icon name="plus" size={14} /> New requirement
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => onOpenSheet?.('notifications')}>
            <Icon name="bell" size={14} /> Notifications
            {notifUnread > 0 && <span className="bell-badge" style={{ position: 'static', marginLeft: 'auto' }}>{notifUnread}</span>}
          </button>
        </div>
        <div className="me-block">
          <Avatar name={me.avatar} color={me.avatarColor} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className="me-name">{me.name}</div>
            <div className="me-flat">{me.flat} · {me.block}</div>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

// ─── Home (Explore) ─────────────────────────────────────────
function HomeScreen({ ctx }) {
  const { me, navigate, goTab, isDesktop, openSheet, notifUnread } = ctx;
  const [reqs, setReqs] = useState([]);
  const [solar, setSolar] = useState(null);

  useEffect(() => {
    api.get('/requirements').then(setReqs);
    api.get('/requirements/solar').then(setSolar);
  }, []);

  const featured = reqs.slice(0, 3);
  const activeReq = me.activeReqs?.[0];

  return (
    <div style={{ paddingBottom: isDesktop ? 0 : 12 }}>
      {!isDesktop && (
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar name={me.avatar} color={me.avatarColor} size={44} />
            <div style={{ minWidth: 0 }}>
              <div className="greet-name">Hi, {me.name.split(' ')[0]}</div>
              <div className="greet-community">
                <span>{me.communityShort}</span>
                <Icon name="chevronDown" size={14} color="var(--cb-muted)" />
              </div>
            </div>
          </div>
          <button className="bell" onClick={() => openSheet('notifications')} aria-label="Notifications">
            <Icon name="bell" size={18} />
            {notifUnread > 0 && <span className="bell-badge">{notifUnread}</span>}
          </button>
        </div>
      )}

      {isDesktop && (
        <div className="row-between" style={{ marginBottom: 24 }}>
          <div>
            <div className="text-display muted" style={{ fontSize: 13, fontWeight: 500 }}>Hi, {me.name.split(' ')[0]}</div>
            <h1 className="text-display" style={{ margin: '4px 0 0', fontSize: 30 }}>What's the community planning?</h1>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate({ kind: 'search' })}>
            <Icon name="search" size={16} /> Search community
          </button>
        </div>
      )}

      <div className={isDesktop ? '' : 'home-pad'} style={{ padding: isDesktop ? 0 : '0 20px 20px' }}>
        <div className="hero">
          <div className="sun-blob" />
          <div className="sun-emoji">☀</div>
          <span className="label">This month in {me.communityShort}</span>
          <h1>47 flats are planning rooftop solar.</h1>
          <p>A 5kW group buy is open. 4 spots left before May 24.</p>
          <button className="btn btn-accent" onClick={() => navigate({ kind: 'req', id: 'solar' })}>
            Join the conversation <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </div>

      {!isDesktop && (
        <div style={{ padding: '20px 20px 24px' }}>
          <button className="search-prompt" onClick={() => navigate({ kind: 'search' })}>
            <Icon name="search" size={18} color="var(--cb-muted)" />
            <span>Search requirements, vendors, plans…</span>
          </button>
        </div>
      )}

      {activeReq ? (
        <>
          <div className="section-head"><h3>Pick up where you left off</h3></div>
          <div style={{ padding: isDesktop ? 0 : '0 20px 28px' }}>
            <button className="card card-pad" onClick={() => navigate({ kind: 'req', id: activeReq.id })}
                    style={{ width: '100%', textAlign: 'left' }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <div className="flex gap-3 center" style={{ minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cb-accent-soft)', display: 'grid', placeItems: 'center', fontSize: 22 }}>
                    {activeReq.meta?.emoji || '☀'}
                  </div>
                  <div>
                    <div className="text-display font-semibold text-lg">{activeReq.title}</div>
                    <div className="text-sm muted">{activeReq.stage}</div>
                  </div>
                </div>
                <Icon name="chevronRight" size={20} color="var(--cb-muted)" />
              </div>
              <Progress value={activeReq.progress} />
              <div className="row-between mt-3 text-sm muted">
                <span><span className="text-primary font-semibold">Next:</span> {activeReq.nextStep}</span>
                <span>{Math.round(activeReq.progress * 100)}%</span>
              </div>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="section-head"><h3>Start planning</h3></div>
          <div style={{ padding: isDesktop ? 0 : '0 20px 28px' }}>
            <button className="card card-pad empty-cta" onClick={() => openSheet('newRequirement')}>
              <div className="empty-cta-ico"><Icon name="plus" size={22} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="text-display font-semibold text-lg">Add your first requirement</div>
                <div className="text-sm muted mt-1">Track a home project, service, or community event — and pull neighbours in.</div>
              </div>
              <Icon name="chevronRight" size={20} color="var(--cb-muted)" />
            </button>
          </div>
        </>
      )}

      <div className="section-head"><h3>Hot in your community</h3><button className="action" onClick={() => goTab('vendors')}>See all</button></div>
      <div className="cat-rail no-scrollbar" style={isDesktop ? { paddingLeft: 0, paddingRight: 0 } : {}}>
        {featured.map(r => (
          <button key={r.id} className="cat-card" onClick={() => navigate({ kind: 'req', id: r.id })}
                  style={{ background: r.tint, color: 'var(--cb-ink)', textAlign: 'left' }}>
            <div className="row-between">
              <span className="emoji">{r.emoji}</span>
              <Heat heat={r.heat} />
            </div>
            <h4>{r.title}</h4>
            <div className="meta">{r.active} active · {r.vendors} vendors</div>
            <div className="text-sm font-semibold mt-3">{r.cost}</div>
          </button>
        ))}
      </div>

      <div className="section-head">
        <h3>All requirements</h3>
        <button className="action" onClick={() => openSheet('newRequirement')}>
          <Icon name="plus" size={14} /> Create new
        </button>
      </div>
      <div className="cat-grid">
        {reqs.map(r => (
          <button key={r.id} className="cat-tile" onClick={() => navigate({ kind: 'req', id: r.id })}>
            <div className="row-between">
              <span className="emoji">{r.emoji}</span>
              <Heat heat={r.heat} />
            </div>
            <h5>{r.title}</h5>
            <div className="stat">{r.active} active · {r.plans} plans</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Requirement detail ─────────────────────────────────────
function RequirementScreen({ ctx, reqId }) {
  const { me, navigate, goBack, showToast, isDesktop, refreshMe } = ctx;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [trackBusy, setTrackBusy] = useState(false);

  const isTracking = (me.activeReqs || []).some(r => r.id === reqId);

  useEffect(() => {
    setData(null); setErr(null);
    const load = () => api.get(`/requirements/${reqId}`).then(setData).catch(e => setErr(e.message));
    load();

    let timer;
    const refetch = () => { clearTimeout(timer); timer = setTimeout(load, 200); };
    const ch = sb.channel(`req:${reqId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads',     filter: `requirement_id=eq.${reqId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls',       filter: `requirement_id=eq.${reqId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' },                                       refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_buys',  filter: `requirement_id=eq.${reqId}` }, refetch)
      .subscribe();
    return () => { clearTimeout(timer); sb.removeChannel(ch); };
  }, [reqId]);

  const toggleTracking = async () => {
    if (trackBusy) return;
    setTrackBusy(true);
    try {
      if (isTracking) {
        await api.del(`/me/active-requirements/${reqId}`);
        showToast('Removed from My active');
      } else {
        await api.post(`/me/active-requirements/${reqId}`, {});
        showToast('Added to My active');
      }
      refreshMe?.();
    } catch (e) {
      showToast('Could not update');
    } finally {
      setTrackBusy(false);
    }
  };

  if (err) return <div><BackBar onBack={goBack} title="Couldn't load" /><div style={{ padding: '0 20px' }} className="text-sm muted">{err}</div></div>;
  if (!data) return <BackBar onBack={goBack} title="Loading…" />;

  const ws = data.workspace;
  const collaborators = ws?.threads?.slice(0, 5) || [];

  return (
    <div>
      <BackBar onBack={goBack} title={data.title} subtitle={`${data.active} active · ${data.vendors.length} vendors`} />

      <div style={{ padding: isDesktop ? '0 0 16px' : '0 20px 16px' }}>
        <button
          className={`btn ${isTracking ? 'btn-ghost' : 'btn-primary'}`}
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={trackBusy}
          onClick={toggleTracking}>
          <Icon name={isTracking ? 'check' : 'plus'} size={16} />
          {trackBusy ? '…' : (isTracking ? 'Tracking · tap to remove' : 'Add to My active')}
        </button>
      </div>

      <div style={{ padding: isDesktop ? 0 : '0 20px', maxWidth: '100%' }}>
        <div className="detail-grid">
          {/* Left column */}
          <div className="stack">
            {!ws && (
              <section className="card card-pad">
                <h3 className="text-display" style={{ margin: 0, fontSize: 17 }}>Workspace coming soon</h3>
                <p className="text-sm muted mt-2">
                  This category is active with {data.active} flats, but the community is still building shared plans,
                  threads, and group buys. In the meantime, browse vendors on the right.
                </p>
              </section>
            )}
            {ws && (
              <>
                <div className="kpis">
                  <Kpi label="Active" value={ws.summary.activeResidents} />
                  <Kpi label="Installed" value={ws.summary.installedFlats} />
                  <Kpi label="Avg cost" value={ws.summary.avgCost} />
                  <Kpi label="Payback" value={ws.summary.avgPayback} />
                </div>

                <section className="card card-pad">
                  <div className="row-between mb-3">
                    <h3 className="text-display" style={{ margin: 0, fontSize: 17 }}>Plans the community is using</h3>
                    <span className="text-sm muted">{ws.plans.length}</span>
                  </div>
                  {ws.plans.map(p => (
                    <div key={p.id} className="plan-row">
                      <div style={{ flex: 1 }}>
                        <div className="plan-tier">{p.tier}{p.featured ? ' · Featured' : ''}</div>
                        <div className="text-display font-semibold mt-2" style={{ fontSize: 16 }}>{p.title}</div>
                        <div className="text-sm muted mt-2">{p.subtitle}</div>
                        <div className="flex gap-3 mt-3 text-xs muted wrap">
                          <span>{p.panels}</span>
                          <span>·</span>
                          <span>{p.inverter}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="price">{p.cost}</div>
                        <div className="text-xs muted mt-2">{p.payback} payback</div>
                        <div className="chip chip-sage mt-3" style={{ fontSize: 11 }}>
                          {p.usedBy} flats use this
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="card card-pad">
                  <div className="row-between mb-3">
                    <h3 className="text-display" style={{ margin: 0, fontSize: 17 }}>Discussion</h3>
                    <span className="text-sm muted">{ws.threads.length} threads</span>
                  </div>
                  {ws.threads.map(t => (
                    <ThreadRow key={t.id} t={t} onLike={() => showToast('Liked')} />
                  ))}
                </section>

                <section>
                  <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Open polls</h3>
                  {ws.polls.map(p => <Poll key={p.id} poll={p} onVoted={showToast} />)}
                </section>

                <section className="card card-pad">
                  <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Shared resources</h3>
                  {ws.resources.map(r => (
                    <div key={r.id} className="thread-row">
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cb-cream)', display: 'grid', placeItems: 'center' }}>
                        <Icon name="file" size={18} color="var(--cb-muted)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="title">{r.title}</div>
                        <div className="meta">
                          <span>{r.type.toUpperCase()}</span>
                          <span>·</span>
                          <span>{r.size}</span>
                          <span>·</span>
                          <span>shared by {r.byInfo?.name || r.by}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>

          {/* Right rail */}
          <aside className="stack">
            {ws?.groupBuy && <GroupBuy reqId={reqId} gb={ws.groupBuy} onJoin={() => showToast('Joined the group buy')} />}

            <section className="card card-pad">
              <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Vendors in this category</h3>
              {data.vendors.slice(0, 5).map(v => (
                <button key={v.id} className="vendor-row" style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => navigate({ kind: 'vendor', id: v.id })}>
                  <div className="vendor-logo" style={{ background: v.color }}>{v.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-display font-semibold" style={{ fontSize: 14 }}>{v.name}</div>
                    <div className="text-xs muted mt-2 flex gap-2 wrap">
                      <span>★ {v.rating}</span>
                      <span>·</span>
                      <span>{v.jobs} jobs</span>
                      <span>·</span>
                      <span>{v.price}</span>
                    </div>
                  </div>
                  <span className="score-badge">{v.score}</span>
                </button>
              ))}
            </section>

            <section className="card card-pad">
              <h3 className="text-display" style={{ margin: '0 0 8px', fontSize: 17 }}>Who's collaborating</h3>
              <p className="text-sm muted mb-3">Residents actively planning this in {ctx.me.communityShort}.</p>
              <div className="flex" style={{ marginLeft: 6 }}>
                {collaborators.map((t, i) => (
                  <div key={i} style={{ marginLeft: -8 }}>
                    <Avatar name={t.authorInfo?.avatar || '?'} color={t.authorInfo?.color || '#6E8FB5'} size={32} />
                  </div>
                ))}
                {collaborators.length > 0 && (
                  <div style={{ marginLeft: -8, width: 32, height: 32, borderRadius: 16, background: 'var(--cb-cream)', border: '2px solid var(--cb-paper)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--cb-muted)' }}>
                    +{Math.max(0, (data.active || 0) - collaborators.length)}
                  </div>
                )}
                {collaborators.length === 0 && (
                  <div className="text-sm muted" style={{ marginLeft: 0 }}>No collaborators yet — be the first to start a thread.</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ThreadRow({ t, onLike }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(t.likes);
  const like = async (e) => {
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes(n => n + 1);
    try { await api.post(`/threads/${t.id}/like`); onLike?.(); }
    catch { setLiked(false); setLikes(n => n - 1); }
  };
  return (
    <div className="thread-row" style={{ alignItems: 'flex-start' }}>
      <Avatar name={t.authorInfo?.avatar || '?'} color={t.authorInfo?.color || '#6E8FB5'} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title">
          {t.pinned && <Icon name="pin" size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} color="var(--cb-terra)" />}
          {t.title}
        </div>
        <div className="meta">
          <span className="tag">{t.tag}</span>
          <span>{t.authorInfo?.name || t.author}</span>
          <span>·</span>
          <span>{t.replies} replies</span>
          <span>·</span>
          <span>{t.time}</span>
        </div>
      </div>
      <button onClick={like} aria-label={liked ? 'Liked' : 'Like'}
              className="flex gap-2 center" style={{ padding: '6px 10px', borderRadius: 999, background: liked ? 'var(--cb-primary-soft)' : 'transparent', color: liked ? 'var(--cb-primary)' : 'var(--cb-muted)', fontSize: 12, fontWeight: 600 }}>
        <Icon name="heart" size={14} color="currentColor" />
        <span>{likes}</span>
      </button>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function Poll({ poll: initial, onVoted }) {
  const [poll, setPoll] = useState(initial);
  const [voted, setVoted] = useState(false);
  const vote = async (i) => {
    if (voted) return;
    setVoted(true);
    try {
      const fresh = await api.post(`/polls/${poll.id}/vote`, { optionIndex: i });
      setPoll(fresh);
      onVoted?.('Vote recorded');
    } catch (e) {
      setVoted(false);
    }
  };
  return (
    <div className="poll">
      <div className="q">{poll.q}</div>
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        return (
          <div key={i} className="poll-opt" onClick={() => vote(i)}>
            <div className="bar" style={{ width: `${pct}%` }} />
            <span>{o.label}</span>
            <span className="font-semibold">{pct}%</span>
          </div>
        );
      })}
      <div className="text-xs muted mt-2">{poll.total} votes</div>
    </div>
  );
}

function GroupBuy({ reqId, gb: initial, onJoin }) {
  const [gb, setGb] = useState(initial);
  const [joined, setJoined] = useState(false);
  const pct = Math.min(100, Math.round((gb.joined / gb.target) * 100));
  const join = async () => {
    if (joined) return;
    setJoined(true);
    try {
      const fresh = await api.post(`/group-buys/${reqId}/join`);
      setGb(fresh);
      onJoin?.();
    } catch (e) {
      setJoined(false);
    }
  };
  return (
    <div className="group-buy">
      <div className="sun-blob" />
      <div style={{ position: 'relative' }}>
        <div className="text-xs font-bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
          Active group buy
        </div>
        <h4 className="mt-2">{gb.title}</h4>
        <div className="joined">{gb.joined}<span style={{ fontSize: 14, opacity: 0.7 }}> / {gb.target} flats</span></div>
        <div className="progress mt-2" style={{ background: 'rgba(255,255,255,0.18)' }}>
          <div style={{ width: `${pct}%`, background: 'var(--cb-accent)' }} />
        </div>
        <div className="row"><span>Vendor</span><span>{gb.vendor}</span></div>
        <div className="row"><span>Per flat</span><span>{gb.perFlat}</span></div>
        <div className="row"><span>Closes</span><span>{gb.closes}</span></div>
        <button className="btn btn-accent btn-block mt-4" onClick={join} disabled={joined}>
          {joined ? 'Joined ✓' : 'Join group buy'}
        </button>
      </div>
    </div>
  );
}

// ─── Vendors list ───────────────────────────────────────────
function VendorsScreen({ ctx }) {
  const { navigate, isDesktop } = ctx;
  const [vendors, setVendors] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat !== 'all') qs.set('cat', cat);
    if (q) qs.set('q', q);
    api.get('/vendors' + (qs.toString() ? `?${qs}` : '')).then(setVendors);
  }, [cat, q]);

  const cats = ['all', 'solar', 'ev', 'interior', 'furniture', 'grill'];

  return (
    <div>
      {!isDesktop && (
        <div className="topbar"><h2 className="text-display" style={{ margin: 0, fontSize: 22 }}>Vendors</h2></div>
      )}
      {isDesktop && <h1 className="text-display" style={{ margin: '0 0 6px', fontSize: 28 }}>Vendors</h1>}
      <p className="text-sm muted" style={{ padding: isDesktop ? 0 : '0 20px', marginTop: 0, marginBottom: 16 }}>
        Verified by your community.
      </p>

      <div className="flex gap-2 wrap" style={{ padding: isDesktop ? 0 : '0 20px', marginBottom: 16 }}>
        {cats.map(c => (
          <button key={c} className={`chip ${cat === c ? 'chip-sage' : ''}`}
                  onClick={() => setCat(c)} style={{ cursor: 'pointer' }}>
            {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: isDesktop ? 0 : '0 20px 12px' }}>
        <input className="search-prompt" placeholder="Search vendors…"
               value={q} onChange={e => setQ(e.target.value)}
               style={{ width: '100%', font: 'inherit' }} />
      </div>

      <div className="card card-pad" style={{ margin: isDesktop ? '8px 0 0' : '0 20px' }}>
        {vendors.length === 0 && <div className="text-sm muted">No vendors yet.</div>}
        {vendors.map(v => (
          <button key={v.id} className="vendor-row" style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => navigate({ kind: 'vendor', id: v.id })}>
            <div className="vendor-logo" style={{ background: v.color }}>{v.logo}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap-2 center">
                <div className="text-display font-semibold" style={{ fontSize: 15 }}>{v.name}</div>
                {v.verified && <Icon name="shield" size={13} color="var(--cb-primary)" />}
              </div>
              <div className="text-xs muted mt-2 flex gap-2 wrap">
                <span>★ {v.rating}</span>
                <span>·</span>
                <span>{v.jobs} jobs in community</span>
                <span>·</span>
                <span>{v.price}</span>
              </div>
              <div className="chip mt-3" style={{ fontSize: 10 }}>{v.tag}</div>
            </div>
            <span className="score-badge">{v.score}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Vendor detail ──────────────────────────────────────────
function VendorScreen({ ctx, vendorId }) {
  const { goBack, showToast } = ctx;
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState({ rating: 5, text: '' });

  useEffect(() => {
    setV(null); setErr(null); setDraft({ rating: 5, text: '' });
    const load = () => api.get(`/vendors/${vendorId}`).then(setV).catch(e => setErr(e.message));
    load();
    const ch = sb.channel(`vendor:${vendorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendor_reviews', filter: `vendor_id=eq.${vendorId}` }, load)
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [vendorId]);

  if (err) return <div><BackBar onBack={goBack} title="Couldn't load" /><div style={{ padding: '0 20px' }} className="text-sm muted">{err}</div></div>;
  if (!v) return <BackBar onBack={goBack} title="Loading…" />;

  const submitReview = async (e) => {
    e.preventDefault();
    if (!draft.text.trim()) return;
    try {
      const fresh = await api.post(`/vendors/${vendorId}/reviews`, draft);
      setV(prev => ({ ...prev, reviews: [fresh, ...prev.reviews] }));
      setDraft({ rating: 5, text: '' });
      showToast('Review posted');
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <BackBar onBack={goBack} title={v.name} subtitle={v.tag} />

      <div style={{ padding: ctx.isDesktop ? 0 : '0 20px' }}>
        <div className="card card-pad mb-4">
          <div className="flex gap-3 center" style={{ marginBottom: 14 }}>
            <div className="vendor-logo" style={{ background: v.color, width: 56, height: 56, fontSize: 24 }}>{v.logo}</div>
            <div style={{ flex: 1 }}>
              <div className="text-display font-bold" style={{ fontSize: 22 }}>{v.name}</div>
              <div className="text-sm muted mt-2">
                {v.cat} · {v.est} in business · responds {v.resp}
              </div>
            </div>
            <span className="score-badge" style={{ fontSize: 14, padding: '6px 12px' }}>{v.score}</span>
          </div>

          <div className="flex gap-3 wrap">
            <Kpi label="Rating" value={`★ ${v.rating}`} />
            <Kpi label="Jobs" value={v.jobs} />
            <Kpi label="Price" value={v.price} />
            <Kpi label="Avg resp" value={v.resp} />
          </div>

          <div className="mt-4 flex gap-2 wrap">
            {(v.services || []).map(s => <span key={s} className="chip chip-sage">{s}</span>)}
          </div>
        </div>

        {v.jobsInCommunity?.length > 0 && (
          <section className="card card-pad mb-4">
            <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Recent work in {ctx.me.communityShort}</h3>
            {v.jobsInCommunity.map((j, i) => (
              <div key={i} className="row-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--cb-border)' }}>
                <span className="text-sm font-semibold">{j.flat}</span>
                <span className="text-sm muted">{j.size} · {j.when}</span>
              </div>
            ))}
          </section>
        )}

        <section className="card card-pad mb-4">
          <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Reviews</h3>
          {v.reviews?.map(r => (
            <div key={r.id} className="thread-row">
              <Avatar name={r.authorInfo?.avatar || '?'} color={r.authorInfo?.color || '#6E8FB5'} size={36} />
              <div style={{ flex: 1 }}>
                <div className="flex gap-2 center">
                  <span className="text-sm font-semibold">{r.authorInfo?.name || r.author}</span>
                  <span className="text-xs muted">· {r.time}</span>
                </div>
                <div className="flex gap-2" style={{ marginTop: 2 }}>
                  {Array.from({ length: 5 }, (_, i) =>
                    <Icon key={i} name={i < r.rating ? 'starFill' : 'star'} size={12} color="var(--cb-accent)" />
                  )}
                </div>
                <p className="text-sm mt-2" style={{ lineHeight: 1.5 }}>{r.text}</p>
              </div>
            </div>
          ))}

          <form onSubmit={submitReview} className="mt-4" style={{ borderTop: '1px solid var(--cb-border)', paddingTop: 16 }}>
            <div className="text-sm font-semibold mb-2">Write a review</div>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} onClick={() => setDraft(d => ({ ...d, rating: n }))}>
                  <Icon name={n <= draft.rating ? 'starFill' : 'star'} size={20} color="var(--cb-accent)" />
                </button>
              ))}
            </div>
            <textarea value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
              placeholder="Share what worked, what didn't…"
              style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 12, border: '1px solid var(--cb-border)', resize: 'vertical', font: 'inherit' }} />
            <button type="submit" className="btn btn-primary mt-3">Post review</button>
          </form>
        </section>
      </div>
    </div>
  );
}

// ─── Plans ──────────────────────────────────────────────────
function PlansScreen({ ctx }) {
  const { navigate, isDesktop } = ctx;
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.get('/plans').then(setPlans); }, []);

  return (
    <div>
      {!isDesktop && <div className="topbar"><h2 className="text-display" style={{ margin: 0, fontSize: 22 }}>Plans</h2></div>}
      {isDesktop && <h1 className="text-display" style={{ margin: '0 0 6px', fontSize: 28 }}>Plans</h1>}
      <p className="text-sm muted" style={{ padding: isDesktop ? 0 : '0 20px', marginTop: 0, marginBottom: 16 }}>
        Battle-tested plans from neighbours.
      </p>

      <div className="cat-grid" style={{ padding: isDesktop ? 0 : '0 20px' }}>
        {plans.map(p => (
          <button key={p.id} className="cat-tile" onClick={() => navigate({ kind: 'req', id: p.cat })}
                  style={{ textAlign: 'left' }}>
            <div className="row-between">
              <span className="plan-tier">{p.tier}</span>
              {p.featured && <span className="chip chip-sun" style={{ fontSize: 9, padding: '3px 8px' }}>Featured</span>}
            </div>
            <h5 style={{ marginTop: 8, fontSize: 15 }}>{p.title}</h5>
            <div className="text-display font-semibold" style={{ fontSize: 16, marginTop: 8 }}>{p.cost}</div>
            <div className="flex gap-2 center mt-3">
              {p.authorInfo && <Avatar name={p.authorInfo.avatar} color={p.authorInfo.color} size={22} />}
              <span className="text-xs muted">{p.authorInfo?.name?.split(' ')[0] || p.author} · {p.usedBy} flats use this</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Me ─────────────────────────────────────────────────────
function MeScreen({ ctx }) {
  const { me, navigate, showToast, isDesktop } = ctx;
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => { api.get('/me/checklist').then(setChecklist); }, []);

  const toggle = async (item) => {
    setChecklist(cs => cs.map(c => c.id === item.id ? { ...c, done: !c.done } : c));
    try { await api.patch(`/me/checklist/${item.id}`, { done: !item.done }); }
    catch (e) { setChecklist(cs => cs.map(c => c.id === item.id ? { ...c, done: item.done } : c)); }
  };

  const addItem = async (e) => {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    try {
      const created = await api.post('/me/checklist', { text });
      setChecklist(cs => [...cs, created]);
    } catch (err) { showToast('Failed to add'); }
  };

  const removeItem = async (item) => {
    setChecklist(cs => cs.filter(c => c.id !== item.id));
    try { await api.del(`/me/checklist/${item.id}`); } catch {}
  };

  const done = checklist.filter(c => c.done).length;
  const total = checklist.length;
  const pct = total ? done / total : 0;

  return (
    <div>
      {!isDesktop && <div className="topbar"><h2 className="text-display" style={{ margin: 0, fontSize: 22 }}>Me</h2></div>}
      {isDesktop && <h1 className="text-display" style={{ margin: '0 0 16px', fontSize: 28 }}>My planning</h1>}

      <div style={{ padding: isDesktop ? 0 : '0 20px' }}>
        <div className="card card-pad mb-4 flex gap-3 center">
          <Avatar name={me.avatar} color={me.avatarColor} size={48} />
          <div style={{ flex: 1 }}>
            <div className="text-display font-bold" style={{ fontSize: 18 }}>{me.name}</div>
            <div className="text-sm muted">{me.flat} · {me.community}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>

        <section className="card card-pad mb-4">
          <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Active requirements</h3>
          {me.activeReqs.length === 0 && (
            <div className="text-sm muted">Nothing in progress yet. Explore what your community is planning and add a requirement to track it here.</div>
          )}
          {me.activeReqs.map(r => (
            <button key={r.id} className="row-between" style={{ width: '100%', padding: '12px 0', borderBottom: '1px solid var(--cb-border)', textAlign: 'left' }}
              onClick={() => navigate({ kind: 'req', id: r.id })}>
              <div style={{ flex: 1 }}>
                <div className="text-display font-semibold" style={{ fontSize: 15 }}>{r.title}</div>
                <div className="text-xs muted mt-2">{r.stage} · updated {r.updated}</div>
                <div style={{ marginTop: 8, maxWidth: 240 }}><Progress value={r.progress} /></div>
              </div>
              <span className="text-sm muted">{Math.round(r.progress * 100)}%</span>
            </button>
          ))}
        </section>

        <section className="card card-pad mb-4">
          <div className="row-between mb-3">
            <h3 className="text-display" style={{ margin: 0, fontSize: 17 }}>My checklist</h3>
            <span className="chip chip-sage">{done}/{total}</span>
          </div>
          {total > 0 && <Progress value={pct} />}
          {total === 0 && <div className="text-sm muted">No steps yet — add the first thing you need to do below.</div>}
          <div className="mt-4">
            {checklist.map(c => (
              <div key={c.id} className="checklist-item">
                <button className={`checkbox ${c.done ? 'done' : ''}`} onClick={() => toggle(c)}>
                  {c.done && <Icon name="check" size={14} color="#fff" />}
                </button>
                <span className={`checklist-text ${c.done ? 'done' : ''}`}>{c.text}</span>
                <button className="checklist-del" onClick={() => removeItem(c)}>Remove</button>
              </div>
            ))}
          </div>
          <form onSubmit={addItem} className="add-checklist">
            <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add a step…" maxLength={200} />
            <button className="btn btn-primary">Add</button>
          </form>
        </section>

        <section className="card card-pad mb-4">
          <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Shortlist</h3>
          {me.shortlistVendors.length === 0 && (
            <div className="text-sm muted">No saved vendors yet. Tap the bookmark on any vendor to shortlist them for comparison.</div>
          )}
          {me.shortlistVendors.map(v => (
            <button key={v.id} className="vendor-row" style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => navigate({ kind: 'vendor', id: v.id })}>
              <div className="vendor-logo" style={{ background: v.color }}>{v.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-display font-semibold" style={{ fontSize: 14 }}>{v.name}</div>
                <div className="text-xs muted mt-2">★ {v.rating} · {v.price}</div>
              </div>
              <Icon name="chevronRight" size={20} color="var(--cb-muted)" />
            </button>
          ))}
        </section>

        <section className="card card-pad mb-4">
          <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Quotations</h3>
          {me.quotations.length === 0 && (
            <div className="text-sm muted">No quotes logged yet. Once vendors send estimates, track and compare them here.</div>
          )}
          {me.quotations.map((q, i) => (
            <div key={i} className="row-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--cb-border)' }}>
              <div>
                <div className="text-sm font-semibold">{q.vendor}</div>
                <div className="text-xs muted mt-2">{q.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-display font-semibold" style={{ fontSize: 16 }}>{q.amount}</div>
                {q.best && <span className="chip chip-sage mt-2" style={{ fontSize: 10 }}>Best</span>}
              </div>
            </div>
          ))}
        </section>

        <section className="card card-pad mb-4">
          <h3 className="text-display" style={{ margin: '0 0 12px', fontSize: 17 }}>Budget</h3>
          {me.budget.planned === 0 && me.budget.items.length === 0 ? (
            <div className="text-sm muted">No budget set yet. As you plan a requirement, your planned and spent amounts will show up here.</div>
          ) : (
          <>
          <div className="row-between">
            <span className="text-sm muted">Planned</span>
            <span className="text-display font-semibold" style={{ fontSize: 16 }}>₹{(me.budget.planned / 1000).toFixed(0)}K</span>
          </div>
          <div className="row-between mt-2">
            <span className="text-sm muted">Spent so far</span>
            <span className="text-display font-semibold" style={{ fontSize: 16 }}>₹{(me.budget.spent / 1000).toFixed(0)}K</span>
          </div>
          <div className="mt-3"><Progress value={me.budget.planned ? me.budget.spent / me.budget.planned : 0} /></div>
          <div className="mt-4">
            {me.budget.items.map((it, i) => (
              <div key={i} className="row-between" style={{ padding: '8px 0', fontSize: 13 }}>
                <span style={{ textDecoration: it.paid ? 'none' : 'none' }}>{it.label}</span>
                <span className={it.paid ? 'muted' : 'font-semibold'}>
                  ₹{(it.amount / 1000).toFixed(0)}K {it.paid && '✓'}
                </span>
              </div>
            ))}
          </div>
          </>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Search ─────────────────────────────────────────────────
function SearchScreen({ ctx }) {
  const { navigate, goBack, isDesktop } = ctx;
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ requirements: [], vendors: [], plans: [], threads: [] });
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!q.trim()) { setResults({ requirements: [], vendors: [], plans: [], threads: [] }); return; }
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q)}`).then(setResults);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <BackBar onBack={goBack} title="Search" />

      <div style={{ padding: isDesktop ? 0 : '0 20px' }}>
        <input ref={inputRef} className="search-prompt" placeholder="Try 'solar', 'Sunkalp', 'kitchen'…"
               value={q} onChange={e => setQ(e.target.value)}
               style={{ width: '100%', font: 'inherit' }} />

        {results.requirements.length > 0 && (
          <section className="mt-4">
            <h4 className="text-display" style={{ fontSize: 13, color: 'var(--cb-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Requirements</h4>
            {results.requirements.map(r => (
              <button key={r.id} className="vendor-row" style={{ width: '100%', textAlign: 'left' }}
                onClick={() => navigate({ kind: 'req', id: r.id })}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: r.tint, display: 'grid', placeItems: 'center', fontSize: 20 }}>{r.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div className="text-display font-semibold" style={{ fontSize: 14 }}>{r.title}</div>
                  <div className="text-xs muted mt-2">{r.active} active · {r.cost}</div>
                </div>
              </button>
            ))}
          </section>
        )}

        {results.vendors.length > 0 && (
          <section className="mt-4">
            <h4 className="text-display" style={{ fontSize: 13, color: 'var(--cb-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Vendors</h4>
            {results.vendors.map(v => (
              <button key={v.id} className="vendor-row" style={{ width: '100%', textAlign: 'left' }}
                onClick={() => navigate({ kind: 'vendor', id: v.id })}>
                <div className="vendor-logo" style={{ background: v.color }}>{v.logo}</div>
                <div style={{ flex: 1 }}>
                  <div className="text-display font-semibold" style={{ fontSize: 14 }}>{v.name}</div>
                  <div className="text-xs muted mt-2">★ {v.rating} · {v.cat}</div>
                </div>
              </button>
            ))}
          </section>
        )}

        {results.threads.length > 0 && (
          <section className="mt-4">
            <h4 className="text-display" style={{ fontSize: 13, color: 'var(--cb-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Discussion</h4>
            {results.threads.map(t => (
              <div key={t.id} className="thread-row">
                <Avatar name={t.authorInfo?.avatar || '?'} color={t.authorInfo?.color || '#6E8FB5'} size={32} />
                <div style={{ flex: 1 }}>
                  <div className="title">{t.title}</div>
                  <div className="meta"><span>{t.replies} replies</span><span>·</span><span>{t.time}</span></div>
                </div>
              </div>
            ))}
          </section>
        )}

        {q && results.requirements.length === 0 && results.vendors.length === 0 && results.threads.length === 0 && (
          <div className="text-sm muted mt-4">No matches for "{q}".</div>
        )}
      </div>
    </div>
  );
}

// ─── Shared back bar ────────────────────────────────────────
function BackBar({ onBack, title, subtitle }) {
  return (
    <div className="back-row">
      <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
        {subtitle && <div className="text-xs muted mt-2">{subtitle}</div>}
      </div>
    </div>
  );
}

// ─── Login screen (email magic-link or phone OTP) ──────────
function LoginScreen() {
  const [mode, setMode]     = useState('email');   // 'email' | 'phone'
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [code, setCode]     = useState('');
  const [step, setStep]     = useState('input');   // 'input' | 'sent' (email) | 'otp' (phone) | 'done'
  const [status, setStatus] = useState('idle');    // 'idle' | 'busy' | 'error'
  const [err, setErr]       = useState('');

  const normalisePhone = (s) => s.replace(/[^\d+]/g, '');

  const sendEmail = async (e) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setStatus('busy'); setErr('');
    const { error } = await sb.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setStatus('error'); setErr(error.message); return; }
    setStatus('idle'); setStep('sent');
  };

  const sendSms = async (e) => {
    e.preventDefault();
    const num = normalisePhone(phone);
    if (!num.startsWith('+') || num.length < 8) {
      setStatus('error'); setErr('Use international format, e.g. +91 9876543210');
      return;
    }
    setStatus('busy'); setErr('');
    const { error } = await sb.auth.signInWithOtp({ phone: num });
    if (error) { setStatus('error'); setErr(error.message); return; }
    setStatus('idle'); setStep('otp');
  };

  const verifySms = async (e) => {
    e.preventDefault();
    const num = normalisePhone(phone);
    const token = code.trim();
    if (!token) return;
    setStatus('busy'); setErr('');
    const { error } = await sb.auth.verifyOtp({ phone: num, token, type: 'sms' });
    if (error) { setStatus('error'); setErr(error.message); return; }
    setStatus('idle'); // onAuthStateChange in Root will swap to <App />
  };

  const reset = () => { setStep('input'); setStatus('idle'); setErr(''); setCode(''); };

  const inputStyle = { padding: 12, borderRadius: 12, border: '1px solid var(--cb-border)', font: 'inherit' };

  return (
    <div className="boot" style={{ padding: 24 }}>
      <div className="card card-pad" style={{ maxWidth: 400, width: '100%' }}>
        <div className="text-display font-bold" style={{ fontSize: 22 }}>CollabBuy</div>
        <div className="text-sm muted mt-2">Sign in to your community workspace.</div>

        {step === 'input' && (
          <>
            <div className="flex gap-2 mt-4" role="tablist">
              <button type="button" role="tab"
                className={`chip ${mode === 'email' ? 'chip-sage' : ''}`}
                onClick={() => { setMode('email'); reset(); }}>Email</button>
              <button type="button" role="tab"
                className={`chip ${mode === 'phone' ? 'chip-sage' : ''}`}
                onClick={() => { setMode('phone'); reset(); }}>Phone</button>
            </div>

            {mode === 'email' && (
              <form onSubmit={sendEmail} className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="email" required autoFocus value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                <button className="btn btn-primary" disabled={status === 'busy'}>
                  {status === 'busy' ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            )}

            {mode === 'phone' && (
              <form onSubmit={sendSms} className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="tel" required autoFocus value={phone} inputMode="tel"
                  onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" style={inputStyle} />
                <div className="text-xs muted">Include your country code.</div>
                <button className="btn btn-primary" disabled={status === 'busy'}>
                  {status === 'busy' ? 'Sending…' : 'Send code'}
                </button>
              </form>
            )}
          </>
        )}

        {step === 'sent' && (
          <div className="mt-4">
            <div className="text-sm">Check <strong>{email}</strong> for a magic link.</div>
            <button className="btn btn-ghost mt-3" onClick={reset}>Use a different email</button>
          </div>
        )}

        {step === 'otp' && (
          <form onSubmit={verifySms} className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="text-sm">Enter the 6-digit code sent to <strong>{normalisePhone(phone)}</strong>.</div>
            <input type="text" required autoFocus value={code} inputMode="numeric" maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
              style={{ ...inputStyle, letterSpacing: '0.4em', textAlign: 'center', fontSize: 18 }} />
            <button className="btn btn-primary" disabled={status === 'busy' || code.length < 6}>
              {status === 'busy' ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Use a different number</button>
          </form>
        )}

        {err && <div className="text-xs mt-3" style={{ color: '#A6586A' }}>{err}</div>}
      </div>
    </div>
  );
}

// ─── Root: gate App behind a Supabase session ────────────────
function Root() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return null;
  return session ? <App /> : <LoginScreen />;
}

// ─── Error boundary: a render error shows a recoverable message, not a blank screen ─
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Render error:', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="boot" style={{ padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div className="text-display font-bold" style={{ fontSize: 20 }}>Something went wrong</div>
          <div className="text-sm muted mt-2">The app hit an unexpected error. Reloading usually fixes it.</div>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

// ─── Mount ──────────────────────────────────────────────────
const root = createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><Root /></ErrorBoundary>);
