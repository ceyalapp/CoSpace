// CollabBuy REST API — Supabase backend.
// Run: npm install && npm start  →  http://localhost:3000
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PORT          = process.env.PORT || 3000;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const ADMIN_TOKEN   = process.env.ADMIN_TOKEN || null; // gates /api/admin/* regardless of NODE_ENV
// Treat an unset OR placeholder (e.g. "PASTE_…") service key as absent, so we never
// build a service client with an invalid key (its writes fail silently under RLS).
const RAW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SERVICE_KEY   = (RAW_SERVICE_KEY.startsWith('PASTE_') || RAW_SERVICE_KEY.length < 60) ? null : RAW_SERVICE_KEY;
const PRIYA_EMAIL   = (process.env.PRIYA_EMAIL || 'balabesimple@gmail.com').toLowerCase();
const COMMUNITY_ID  = 'lakeside_habitat'; // default community for the seeded demo user (Priya)

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in env. See .env.example.');
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed.json'), 'utf8'));

const anonOnly = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

function clientFor(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

const app = express();
app.set('trust proxy', 1); // Cloud Run / Fly / Render sit behind a proxy — needed for correct client IPs

// ─── Security headers (helmet + CSP) ─────────────────────────
// Scripts are same-origin (esbuild bundle) so script-src can be 'self' with no unsafe-eval.
// React inline styles + Google Fonts CSS need style-src 'unsafe-inline'. Supabase REST + Realtime
// (wss) are derived from SUPABASE_URL for connect-src.
const sbHost = (() => { try { return new URL(SUPABASE_URL).host; } catch { return ''; } })();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", `https://${sbHost}`, `wss://${sbHost}`],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // we load Google Fonts cross-origin
}));

app.use(express.json({ limit: '256kb' }));

// ─── Rate limiting ───────────────────────────────────────────
// Broad limit on the whole API, plus a tighter one on community creation (spam guard).
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const onboardLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'too many onboarding attempts, try again later' } });
app.use('/api', apiLimiter);

// Structured request logging: one line per request with status + duration. API only
// (static asset noise is skipped). Swap console.* for a real logger/transport when needed.
function log(level, msg, fields) {
  const rec = { t: new Date().toISOString(), level, msg, ...fields };
  (level === 'error' ? console.error : console.log)(JSON.stringify(rec));
}
app.use((req, res, next) => {
  if (!req.url.startsWith('/api')) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log(res.statusCode >= 500 ? 'error' : 'info', 'request', {
      method: req.method, path: req.originalUrl, status: res.statusCode, ms: Math.round(ms),
    });
  });
  next();
});

// ─── Auth middleware ─────────────────────────────────────────
async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });
  const { data, error } = await anonOnly.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'invalid_token' });
  req.user = data.user;
  req.sb = clientFor(token);
  next();
}

// ─── Helpers ─────────────────────────────────────────────────
const handleErr = (res, e, status = 500) =>
  res.status(status).json({ error: e?.message || String(e) });

function authorInfo(a) {
  if (!a) return null;
  return { id: a.id, name: a.name, flat: a.flat, avatar: a.avatar, color: a.color };
}

function vendorOut(v) {
  return {
    id: v.id, name: v.name, cat: v.requirement_id, rating: v.rating, jobs: v.jobs, score: v.score,
    price: v.price_label, tag: v.tag, logo: v.logo, color: v.color,
    resp: v.resp_label, est: v.est_label, verified: v.verified, photos: v.photos,
    services: v.services || [], jobsInCommunity: v.jobs_in_community || [],
  };
}

function reviewOut(r) {
  return {
    id: r.id, author: r.author_id, rating: r.rating, text: r.text, time: r.time_label,
    authorInfo: authorInfo(r.authors),
  };
}

function planOut(p) {
  return {
    id: p.id, cat: p.requirement_id, tier: p.tier, title: p.title, subtitle: p.subtitle,
    cost: p.cost_label, payback: p.payback_label, usedBy: p.used_by,
    author: p.author_id, panels: p.panels, inverter: p.inverter, warranty: p.warranty,
    featured: p.featured, authorInfo: authorInfo(p.authors),
  };
}

function threadOut(t) {
  return {
    id: t.id, requirementId: t.requirement_id, author: t.author_id, title: t.title,
    likes: t.likes, replies: t.reply_count, tag: t.tag, pinned: t.pinned, time: t.time_label,
    authorInfo: authorInfo(t.authors),
  };
}

function pollOut(p, options) {
  return {
    id: p.id, q: p.question, total: p.total,
    options: (options || []).map(o => ({ label: o.label, votes: o.votes })),
  };
}

function gbOut(gb) {
  return {
    id: gb.id, title: gb.title,
    vendor: gb.vendors?.name || null,
    target: gb.target, joined: gb.joined,
    discount: gb.discount, closes: gb.closes, perFlat: gb.per_flat,
  };
}

function resourceOut(r) {
  return {
    id: r.id, title: r.title, type: r.type, size: r.size_label,
    by: r.author_id, byInfo: authorInfo(r.authors),
  };
}

function reqOut(r) {
  return {
    id: r.id, title: r.title, emoji: r.emoji, heat: r.heat, tint: r.tint,
    cost: r.cost_label, active: r.active, plans: r.plans_count, vendors: r.vendors_count,
  };
}

// ─── Lazy Priya init ─────────────────────────────────────────
// On Priya's first /api/me, ensure her authors row is linked and her per-user state is seeded.
async function ensurePriyaState(sb, user) {
  if ((user.email || '').toLowerCase() !== PRIYA_EMAIL) return;
  const uid = user.id;

  // 1) Ensure profile fields are populated (trigger may have missed metadata)
  const u = seed.user;
  await sb.from('profiles').update({
    community_id: COMMUNITY_ID,
    name: u.name, flat: u.flat, block: u.block,
    avatar: u.avatar, avatar_color: u.avatarColor,
  }).eq('id', uid);

  // 2) Link authors.priya.profile_id (idempotent)
  const { data: priyaAuthor } = await sb.from('authors')
    .select('id, profile_id').eq('id', 'priya').maybeSingle();
  if (priyaAuthor && priyaAuthor.profile_id !== uid) {
    await sb.from('authors').update({ profile_id: uid }).eq('id', 'priya');
  }

  // 3) Seed per-user state if empty
  const { count: arCount } = await sb.from('active_requirements')
    .select('user_id', { count: 'exact', head: true }).eq('user_id', uid);
  if (!arCount) {
    const rows = (seed.me.activeReqs || []).map(r => ({
      user_id: uid, requirement_id: r.id, stage: r.stage, progress: r.progress,
      next_step: r.nextStep, updated_label: r.updated,
    }));
    if (rows.length) await sb.from('active_requirements').insert(rows);
  }

  const { count: clCount } = await sb.from('checklist_items')
    .select('id', { count: 'exact', head: true }).eq('user_id', uid);
  if (!clCount) {
    const rows = (seed.me.checklist || []).map(c => ({
      id: c.id, user_id: uid, text: c.text, done: !!c.done,
    }));
    if (rows.length) await sb.from('checklist_items').insert(rows);
  }

  const { data: budgetRow } = await sb.from('budgets').select('user_id').eq('user_id', uid).maybeSingle();
  if (!budgetRow && seed.me.budget) {
    await sb.from('budgets').insert({ user_id: uid, planned: seed.me.budget.planned });
    const items = (seed.me.budget.items || []).map((it, i) => ({
      user_id: uid, label: it.label, amount: it.amount, paid: !!it.paid, sort_order: i,
    }));
    if (items.length) await sb.from('budget_items').insert(items);
  }

  const { count: slCount } = await sb.from('shortlist')
    .select('user_id', { count: 'exact', head: true }).eq('user_id', uid);
  if (!slCount) {
    const rows = (seed.me.shortlist || []).map(vid => ({ user_id: uid, vendor_id: vid }));
    if (rows.length) await sb.from('shortlist').insert(rows);
  }

  const { count: qCount } = await sb.from('quotations')
    .select('user_id', { count: 'exact', head: true }).eq('user_id', uid);
  if (!qCount) {
    const vendorIdByName = Object.fromEntries(seed.vendors.map(v => [v.name, v.id]));
    const rows = (seed.me.quotations || []).map(q => ({
      user_id: uid, vendor_id: vendorIdByName[q.vendor] || null,
      vendor_label: q.vendor, amount_label: q.amount, date_label: q.date, best: !!q.best,
    }));
    if (rows.length) await sb.from('quotations').insert(rows);
  }
}

// ─── Routes ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    await ensurePriyaState(req.sb, req.user);

    // Profile first — its community_id scopes everything else (and RLS).
    const profile = await req.sb.from('profiles').select('*').eq('id', req.user.id).maybeSingle();
    if (profile.error) throw profile.error;
    const p = profile.data;
    const communityId = p?.community_id || null;

    // No community yet → the client must run onboarding before the app is usable.
    if (!communityId) {
      return res.json({
        id: p?.id, name: p?.name, flat: p?.flat, block: p?.block,
        avatar: p?.avatar, avatarColor: p?.avatar_color,
        community: null, communityShort: null, members: 0,
        needsOnboarding: true,
        activeReqs: [], shortlistVendors: [], quotations: [],
        budget: { planned: 0, spent: 0, items: [] },
      });
    }

    const [community, activeReqs, shortlist, quotations, budget, budgetItems] = await Promise.all([
      req.sb.from('communities').select('*').eq('id', communityId).maybeSingle(),
      req.sb.from('active_requirements').select('*, requirements(*)').eq('user_id', req.user.id),
      req.sb.from('shortlist').select('vendor_id, vendors(*)').eq('user_id', req.user.id),
      req.sb.from('quotations').select('*').eq('user_id', req.user.id).order('id'),
      req.sb.from('budgets_v').select('*').eq('user_id', req.user.id).maybeSingle(),
      req.sb.from('budget_items').select('*').eq('user_id', req.user.id).order('sort_order'),
    ]);

    const c = community.data;

    res.json({
      id: p?.id,
      name: p?.name,
      flat: p?.flat,
      block: p?.block,
      avatar: p?.avatar,
      avatarColor: p?.avatar_color,
      needsOnboarding: false,
      community: c?.name,
      communityShort: c?.short_name,
      members: c?.members_count,
      activeReqs: (activeReqs.data || []).map(r => ({
        id: r.requirement_id, title: r.requirements?.title,
        stage: r.stage, progress: Number(r.progress), nextStep: r.next_step, updated: r.updated_label,
        meta: r.requirements ? reqOut(r.requirements) : null,
      })),
      shortlistVendors: (shortlist.data || []).map(s => s.vendors ? vendorOut(s.vendors) : null).filter(Boolean),
      quotations: (quotations.data || []).map(q => ({
        vendor: q.vendor_label, amount: q.amount_label, date: q.date_label, best: q.best,
      })),
      budget: budget.data ? {
        planned: Number(budget.data.planned),
        spent: Number(budget.data.spent),
        items: (budgetItems.data || []).map(it => ({ label: it.label, amount: Number(it.amount), paid: it.paid })),
      } : { planned: 0, spent: 0, items: [] },
    });
  } catch (e) { handleErr(res, e); }
});

// ─── Onboarding ──────────────────────────────────────────────
// List communities a new member can join (id, name, short name, size).
app.get('/api/communities', requireAuth, async (req, res) => {
  const { data, error } = await req.sb.from('communities')
    .select('id, name, short_name, members_count').order('name');
  if (error) return handleErr(res, error);
  res.json((data || []).map(c => ({
    id: c.id, name: c.name, shortName: c.short_name, members: c.members_count,
  })));
});

const AVATAR_COLORS = ['#2F5D4E', '#A6586A', '#C98A3B', '#3B6FA6', '#7A5BA6', '#4E8C6A'];
function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'NM';
}

// Complete onboarding: set the caller's name/flat + join or create a community,
// and ensure they have a linked author row so they can post content.
app.post('/api/me/onboard', onboardLimiter, requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim().slice(0, 60);
    const flat = (req.body?.flat || '').toString().trim().slice(0, 20) || null;
    const block = (req.body?.block || '').toString().trim().slice(0, 20) || null;
    const communityId = (req.body?.communityId || '').toString().trim();
    const newCommunityName = (req.body?.newCommunityName || '').toString().trim().slice(0, 60);
    if (name.length < 2) return res.status(400).json({ error: 'name (2+ chars) required' });
    if (!communityId && !newCommunityName) return res.status(400).json({ error: 'communityId or newCommunityName required' });

    // Resolve the community: join an existing one, or create a new one. Both go through
    // the user client (RLS: authenticated users may create communities; members_count is
    // maintained by a trigger on profiles).
    let community;
    if (communityId) {
      const { data, error } = await req.sb.from('communities').select('id, name, short_name').eq('id', communityId).maybeSingle();
      if (error) return handleErr(res, error);
      if (!data) return res.status(404).json({ error: 'community not found' });
      community = data;
    } else {
      const base = slugify(newCommunityName);
      let id = base;
      for (let n = 1; n <= 50; n++) {
        const { data: existing } = await req.sb.from('communities').select('id').eq('id', id).maybeSingle();
        if (!existing) break;
        id = `${base}-${n}`;
        if (n === 50) return res.status(500).json({ error: 'could not generate unique community id' });
      }
      const short = newCommunityName.split(/\s+/).slice(0, 2).join(' ');
      const { data, error } = await req.sb.from('communities')
        .insert({ id, name: newCommunityName, short_name: short, members_count: 0 }).select('id, name, short_name').single();
      if (error) return handleErr(res, error);
      community = data;
    }

    const avatar = initialsFrom(name);
    const color = AVATAR_COLORS[Math.abs(req.user.id.charCodeAt(0)) % AVATAR_COLORS.length];

    // Ensure a linked author row exists (RLS: a user may insert their own author).
    // Done before the profile update so the new member can post content immediately.
    const { data: existingAuthor } = await req.sb.from('authors').select('id').eq('profile_id', req.user.id).maybeSingle();
    if (!existingAuthor) {
      const authorId = 'u' + req.user.id.replace(/-/g, '').slice(0, 16);
      const { error: aErr } = await req.sb.from('authors').insert({ id: authorId, name, flat, avatar, color, profile_id: req.user.id });
      if (aErr) return handleErr(res, aErr);
    }

    // Update the caller's own profile (self-update RLS allows this; trigger bumps members_count).
    const { error: upErr } = await req.sb.from('profiles').update({
      name, flat, block, avatar, avatar_color: color, community_id: community.id,
    }).eq('id', req.user.id);
    if (upErr) return handleErr(res, upErr);

    res.status(200).json({ ok: true, community: { id: community.id, name: community.name, shortName: community.short_name } });
  } catch (e) { handleErr(res, e); }
});

app.get('/api/me/checklist', requireAuth, async (req, res) => {
  const { data, error } = await req.sb.from('checklist_items')
    .select('*').eq('user_id', req.user.id).order('created_at');
  if (error) return handleErr(res, error);
  res.json(data.map(c => ({ id: c.id, text: c.text, done: c.done })));
});

app.post('/api/me/checklist', requireAuth, async (req, res) => {
  const text = (req.body?.text || '').toString().trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'text required' });
  const id = 'c' + Date.now().toString(36);
  const { data, error } = await req.sb.from('checklist_items')
    .insert({ id, user_id: req.user.id, text, done: false }).select().single();
  if (error) return handleErr(res, error);
  res.status(201).json({ id: data.id, text: data.text, done: data.done });
});

app.patch('/api/me/checklist/:id', requireAuth, async (req, res) => {
  const patch = {};
  if (typeof req.body.done === 'boolean') patch.done = req.body.done;
  if (typeof req.body.text === 'string')  patch.text = req.body.text.slice(0, 200);
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
  const { data, error } = await req.sb.from('checklist_items')
    .update(patch).eq('id', req.params.id).eq('user_id', req.user.id).select().maybeSingle();
  if (error) return handleErr(res, error);
  if (!data) return res.status(404).json({ error: 'checklist item not found' });
  res.json({ id: data.id, text: data.text, done: data.done });
});

app.delete('/api/me/checklist/:id', requireAuth, async (req, res) => {
  const { error, count } = await req.sb.from('checklist_items')
    .delete({ count: 'exact' }).eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return handleErr(res, error);
  if (!count) return res.status(404).json({ error: 'checklist item not found' });
  res.status(204).end();
});

app.get('/api/requirements', requireAuth, async (req, res) => {
  const { data, error } = await req.sb.from('requirements').select('*').order('sort_order');
  if (error) return handleErr(res, error);
  res.json(data.map(reqOut));
});

// User-created requirement. Slug derived from title; auto-added to caller's active list.
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'req';
}

app.post('/api/requirements', requireAuth, async (req, res) => {
  const title = (req.body?.title || '').toString().trim().slice(0, 80);
  const category = (req.body?.category || 'home').toString();
  const emoji = (req.body?.emoji || '📋').toString().slice(0, 4);
  if (title.length < 3) return res.status(400).json({ error: 'title (3+ chars) required' });
  if (!['home', 'service', 'admin', 'event'].includes(category)) return res.status(400).json({ error: 'invalid category' });

  // Requirements belong to the caller's community; without one there is nowhere to put it.
  const { data: prof, error: pErr } = await req.sb.from('profiles').select('community_id').eq('id', req.user.id).maybeSingle();
  if (pErr) return handleErr(res, pErr);
  if (!prof?.community_id) return res.status(400).json({ error: 'join a community first' });
  const communityId = prof.community_id;

  const tints = { home: '#FAEDB6', service: '#DCE7E0', admin: '#EDE3D2', event: '#F0DAD5' };

  // Unique slug with -N collision suffix. Probe with the service client (or fall back to
  // the user client) so collisions in OTHER communities are still caught — requirement.id
  // is a global PK, so a same-slug row elsewhere would otherwise cause a hidden PK violation.
  const probe = service || req.sb;
  const base = slugify(title);
  let id = base;
  for (let n = 1; n <= 50; n++) {
    const { data: existing } = await probe.from('requirements').select('id').eq('id', id).maybeSingle();
    if (!existing) break;
    id = `${base}-${n}`;
    if (n === 50) return res.status(500).json({ error: 'could not generate unique id' });
  }

  const { data, error } = await req.sb.from('requirements')
    .insert({ id, title, emoji, heat: 'cool', tint: tints[category], cost_label: '—', active: 1, plans_count: 0, vendors_count: 0, sort_order: 1000, created_by: req.user.id, community_id: communityId })
    .select().single();
  if (error) return handleErr(res, error);

  await req.sb.from('active_requirements').upsert({
    user_id: req.user.id, requirement_id: id,
    stage: 'Discovery', progress: 0.05,
    next_step: 'Find similar requirements in the community',
    updated_label: 'just now',
  }, { onConflict: 'user_id,requirement_id' });

  res.status(201).json(reqOut(data));
});

app.post('/api/me/active-requirements/:id', requireAuth, async (req, res) => {
  const { data: reqRow, error: rErr } = await req.sb.from('requirements')
    .select('id').eq('id', req.params.id).maybeSingle();
  if (rErr) return handleErr(res, rErr);
  if (!reqRow) return res.status(404).json({ error: 'requirement not found' });

  const { data, error } = await req.sb.from('active_requirements').upsert({
    user_id: req.user.id,
    requirement_id: req.params.id,
    stage: (req.body?.stage || 'Discovery').toString().slice(0, 40),
    progress: Math.max(0, Math.min(1, Number(req.body?.progress) || 0.05)),
    next_step: (req.body?.next_step || 'Start exploring').toString().slice(0, 120),
    updated_label: 'just now',
  }, { onConflict: 'user_id,requirement_id' }).select('*, requirements(*)').single();
  if (error) return handleErr(res, error);
  res.status(201).json({
    id: data.requirement_id, title: data.requirements?.title,
    stage: data.stage, progress: Number(data.progress), nextStep: data.next_step, updated: data.updated_label,
    meta: data.requirements ? reqOut(data.requirements) : null,
  });
});

app.delete('/api/me/active-requirements/:id', requireAuth, async (req, res) => {
  const { error, count } = await req.sb.from('active_requirements')
    .delete({ count: 'exact' }).eq('user_id', req.user.id).eq('requirement_id', req.params.id);
  if (error) return handleErr(res, error);
  if (!count) return res.status(404).json({ error: 'not in active list' });
  res.status(204).end();
});

// Short relative-time label from a timestamp ("just now", "2h", "3d", "2w").
function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// Real, per-user notifications (created by DB triggers on group-buy joins / reviews).
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { data, error } = await req.sb.from('notifications')
    .select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  if (error) return handleErr(res, error);
  const items = (data || []).map(n => ({
    id: n.id, tone: n.tone, icon: n.icon, title: n.title, sub: n.sub,
    time: relTime(n.created_at), unread: !n.read,
    link: n.link_kind ? { kind: n.link_kind, id: n.link_id } : null,
  }));
  res.json({ items, unread: items.filter(i => i.unread).length });
});

// Mark all of the caller's notifications read (clears the bell badge).
app.post('/api/notifications/read', requireAuth, async (req, res) => {
  const { error } = await req.sb.from('notifications')
    .update({ read: true }).eq('user_id', req.user.id).eq('read', false);
  if (error) return handleErr(res, error);
  res.json({ ok: true, unread: 0 });
});

app.get('/api/requirements/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const [reqRow, summary, plans, threads, polls, options, gb, resources, vendors] = await Promise.all([
    req.sb.from('requirements').select('*').eq('id', id).maybeSingle(),
    req.sb.from('workspace_summary_v').select('*').eq('requirement_id', id).maybeSingle(),
    req.sb.from('plans').select('*, authors(*)').eq('requirement_id', id).order('sort_order'),
    req.sb.from('threads').select('*, authors(*)').eq('requirement_id', id).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    req.sb.from('polls_v').select('*').eq('requirement_id', id),
    req.sb.from('poll_options').select('*').order('poll_id').order('idx'),
    req.sb.from('group_buys').select('*, vendors(name)').eq('requirement_id', id).eq('status', 'active').maybeSingle(),
    req.sb.from('resources').select('*, authors(*)').eq('requirement_id', id).order('id'),
    req.sb.from('vendors').select('*').eq('requirement_id', id),
  ]);

  if (reqRow.error) return handleErr(res, reqRow.error);
  if (!reqRow.data)  return res.status(404).json({ error: 'requirement not found' });

  const r = reqRow.data;
  const s = summary.data;
  const pollOptionsByPoll = {};
  for (const o of (options.data || [])) {
    (pollOptionsByPoll[o.poll_id] ||= []).push(o);
  }
  const myPolls = (polls.data || []);

  const workspace = (s || (plans.data?.length) || (threads.data?.length)) ? {
    summary: {
      activeResidents: s?.active_residents || 0,
      installedFlats:  s?.installed_flats  || 0,
      avgCost:         s?.avg_cost         || '—',
      avgPayback:      s?.avg_payback      || '—',
      vendorsDiscussed: s?.vendors_discussed || 0,
      activePolls:     s?.active_polls     || 0,
      activeGroupBuy:  !!s?.active_group_buy,
    },
    plans:     (plans.data || []).map(planOut),
    threads:   (threads.data || []).map(threadOut),
    polls:     myPolls.map(p => pollOut(p, pollOptionsByPoll[p.id])),
    groupBuy:  gb.data ? gbOut(gb.data) : null,
    resources: (resources.data || []).map(resourceOut),
  } : null;

  res.json({
    ...reqOut(r),
    workspace,
    vendors: (vendors.data || []).map(vendorOut),
  });
});

app.get('/api/vendors', requireAuth, async (req, res) => {
  let q = req.sb.from('vendors').select('*');
  if (req.query.cat) q = q.eq('requirement_id', req.query.cat);
  if (req.query.q)   q = q.ilike('name', `%${req.query.q}%`);
  const { data, error } = await q;
  if (error) return handleErr(res, error);
  res.json(data.map(vendorOut));
});

app.get('/api/vendors/:id', requireAuth, async (req, res) => {
  const [vendor, reviews] = await Promise.all([
    req.sb.from('vendors').select('*').eq('id', req.params.id).maybeSingle(),
    req.sb.from('vendor_reviews').select('*, authors(*)').eq('vendor_id', req.params.id).order('created_at', { ascending: false }),
  ]);
  if (vendor.error) return handleErr(res, vendor.error);
  if (!vendor.data)  return res.status(404).json({ error: 'vendor not found' });
  const v = vendor.data;
  res.json({
    ...vendorOut(v),
    reviews: (reviews.data || []).map(reviewOut),
  });
});

app.post('/api/vendors/:id/reviews', requireAuth, async (req, res) => {
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));
  const text = (req.body.text || '').toString().trim().slice(0, 600);
  if (!rating || !text) return res.status(400).json({ error: 'rating (1-5) and text required' });

  const { data: a, error: aErr } = await req.sb.from('authors')
    .select('id').eq('profile_id', req.user.id).maybeSingle();
  if (aErr) return handleErr(res, aErr);
  if (!a)   return res.status(403).json({ error: 'no linked author' });

  const id = 'rv' + Date.now().toString(36);
  const { data, error } = await req.sb.from('vendor_reviews')
    .insert({ id, vendor_id: req.params.id, author_id: a.id, rating, text, time_label: 'just now' })
    .select('*, authors(*)').single();
  if (error) return handleErr(res, error);
  res.status(201).json(reviewOut(data));
});

app.get('/api/plans', requireAuth, async (req, res) => {
  let q = req.sb.from('plans').select('*, authors(*)').order('sort_order');
  if (req.query.cat) q = q.eq('requirement_id', req.query.cat);
  const { data, error } = await q;
  if (error) return handleErr(res, error);
  res.json(data.map(planOut));
});

app.get('/api/threads/:id', requireAuth, async (req, res) => {
  const { data, error } = await req.sb.from('threads')
    .select('*, authors(*)').eq('id', req.params.id).maybeSingle();
  if (error) return handleErr(res, error);
  if (!data) return res.status(404).json({ error: 'thread not found' });
  res.json(threadOut(data));
});

app.post('/api/threads/:id/like', requireAuth, async (req, res) => {
  const { error } = await req.sb.from('thread_likes')
    .insert({ thread_id: req.params.id, user_id: req.user.id });
  if (error && error.code !== '23505') return handleErr(res, error); // ignore "already liked"
  const { data, error: e2 } = await req.sb.from('threads')
    .select('*, authors(*)').eq('id', req.params.id).maybeSingle();
  if (e2) return handleErr(res, e2);
  if (!data) return res.status(404).json({ error: 'thread not found' });
  res.json(threadOut(data));
});

app.post('/api/polls/:id/vote', requireAuth, async (req, res) => {
  const optionIndex = parseInt(req.body.optionIndex, 10);
  if (Number.isNaN(optionIndex)) return res.status(400).json({ error: 'optionIndex required' });
  const pollId = req.params.id;

  const { data: opt, error: oErr } = await req.sb.from('poll_options')
    .select('id').eq('poll_id', pollId).eq('idx', optionIndex).maybeSingle();
  if (oErr) return handleErr(res, oErr);
  if (!opt) return res.status(400).json({ error: 'invalid optionIndex' });

  const { error } = await req.sb.from('poll_votes')
    .insert({ poll_id: pollId, user_id: req.user.id, option_id: opt.id });
  if (error && error.code !== '23505') return handleErr(res, error);

  const [poll, options] = await Promise.all([
    req.sb.from('polls_v').select('*').eq('id', pollId).maybeSingle(),
    req.sb.from('poll_options').select('*').eq('poll_id', pollId).order('idx'),
  ]);
  if (poll.error)   return handleErr(res, poll.error);
  if (!poll.data)   return res.status(404).json({ error: 'poll not found' });
  res.json(pollOut(poll.data, options.data));
});

app.post('/api/group-buys/:reqId/join', requireAuth, async (req, res) => {
  const { data: gb, error: gErr } = await req.sb.from('group_buys')
    .select('id').eq('requirement_id', req.params.reqId).eq('status', 'active').maybeSingle();
  if (gErr)  return handleErr(res, gErr);
  if (!gb)   return res.status(404).json({ error: 'group buy not found' });

  const { error } = await req.sb.from('group_buy_members')
    .insert({ group_buy_id: gb.id, user_id: req.user.id });
  if (error && error.code !== '23505') return handleErr(res, error);

  const { data: fresh, error: fErr } = await req.sb.from('group_buys')
    .select('*, vendors(name)').eq('id', gb.id).maybeSingle();
  if (fErr) return handleErr(res, fErr);
  res.json(gbOut(fresh));
});

app.get('/api/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ requirements: [], vendors: [], plans: [], threads: [] });
  const like = `%${q}%`;
  const [reqs, vendors, plans, threads] = await Promise.all([
    req.sb.from('requirements').select('*').ilike('title', like),
    req.sb.from('vendors').select('*').ilike('name', like),
    req.sb.from('plans').select('*, authors(*)').ilike('title', like),
    req.sb.from('threads').select('*, authors(*)').ilike('title', like),
  ]);
  res.json({
    requirements: (reqs.data || []).map(reqOut),
    vendors:      (vendors.data || []).map(vendorOut),
    plans:        (plans.data || []).map(planOut),
    threads:      (threads.data || []).map(threadOut),
  });
});

app.post('/api/admin/reset', async (req, res) => {
  // Gated by a shared admin token (header), independent of NODE_ENV. Disabled unless ADMIN_TOKEN is set.
  if (!ADMIN_TOKEN) return res.status(403).json({ error: 'admin endpoint disabled (set ADMIN_TOKEN)' });
  if (req.get('x-admin-token') !== ADMIN_TOKEN) return res.status(401).json({ error: 'invalid admin token' });
  if (!service) return res.status(500).json({ error: 'service role key required for reset' });
  try {
    // Truncate per-user state and reseed via the canonical script.
    const tables = ['poll_votes','thread_likes','group_buy_members','quotations','budget_items','budgets','shortlist','checklist_items','active_requirements'];
    for (const t of tables) {
      const { error } = await service.from(t).delete().not('user_id', 'is', null);
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch (e) { handleErr(res, e); }
});

// 404 for unknown /api routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// Runtime config served to the browser
app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.__SB_CONFIG = ${JSON.stringify({ url: SUPABASE_URL, anonKey: SUPABASE_ANON })};`
  );
});

// ─── Static client ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only listen when run directly (`node server.js`); when imported by tests, just export the app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CollabBuy listening on http://localhost:${PORT}`);
    if (!SERVICE_KEY) console.log('(SUPABASE_SERVICE_ROLE_KEY not set — /api/admin/reset disabled.)');
  });
}

module.exports = app;
