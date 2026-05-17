// CollabBuy REST API + static webapp host.
// Run: npm install && npm start  →  http://localhost:3000
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SEED_PATH  = path.join(__dirname, 'data', 'seed.json');
const STATE_PATH = path.join(__dirname, 'data', 'state.json');

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
    catch (e) { console.warn('state.json unreadable, reseeding:', e.message); }
  }
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  fs.writeFileSync(STATE_PATH, JSON.stringify(seed, null, 2));
  return seed;
}

let DB = loadState();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_PATH, JSON.stringify(DB, null, 2), err => {
      if (err) console.error('persist failed:', err);
    });
  }, 80);
}

app.use(express.json({ limit: '256kb' }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ─── helpers ─────────────────────────────────────────────────
const byId = (arr, id) => arr.find(x => x.id === id);
const notFound = (res, what) => res.status(404).json({ error: `${what} not found` });

function hydrateAuthor(item) {
  if (!item || !item.author) return item;
  const r = byId(DB.residents, item.author);
  return r ? { ...item, authorInfo: r } : item;
}

function workspace(reqId) {
  return DB.workspaces[reqId] || null;
}

// ─── routes ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/me', (_req, res) => {
  res.json({
    ...DB.user,
    activeReqs: DB.me.activeReqs.map(r => ({
      ...r,
      meta: byId(DB.requirements, r.id),
    })),
    shortlistVendors: DB.me.shortlist.map(id => byId(DB.vendors, id)).filter(Boolean),
    quotations: DB.me.quotations,
    budget: DB.me.budget,
  });
});

app.get('/api/me/checklist', (_req, res) => res.json(DB.me.checklist));

app.patch('/api/me/checklist/:id', (req, res) => {
  const item = byId(DB.me.checklist, req.params.id);
  if (!item) return notFound(res, 'checklist item');
  if (typeof req.body.done === 'boolean') item.done = req.body.done;
  if (typeof req.body.text === 'string')  item.text = req.body.text.slice(0, 200);
  persist();
  res.json(item);
});

app.post('/api/me/checklist', (req, res) => {
  const text = (req.body && req.body.text || '').toString().trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'text required' });
  const id = 'c' + Date.now().toString(36);
  const item = { id, text, done: false };
  DB.me.checklist.push(item);
  persist();
  res.status(201).json(item);
});

app.delete('/api/me/checklist/:id', (req, res) => {
  const i = DB.me.checklist.findIndex(c => c.id === req.params.id);
  if (i === -1) return notFound(res, 'checklist item');
  DB.me.checklist.splice(i, 1);
  persist();
  res.status(204).end();
});

app.get('/api/requirements', (_req, res) => res.json(DB.requirements));

app.get('/api/requirements/:id', (req, res) => {
  const r = byId(DB.requirements, req.params.id);
  if (!r) return notFound(res, 'requirement');
  const ws = workspace(req.params.id);
  const vendors = DB.vendors.filter(v => v.cat === req.params.id);
  res.json({
    ...r,
    workspace: ws ? {
      ...ws,
      threads: ws.threads.map(hydrateAuthor),
      plans:   ws.plans.map(hydrateAuthor),
      resources: ws.resources.map(x => ({ ...x, byInfo: byId(DB.residents, x.by) })),
    } : null,
    vendors,
  });
});

app.get('/api/vendors', (req, res) => {
  let out = DB.vendors;
  if (req.query.cat) out = out.filter(v => v.cat === req.query.cat);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    out = out.filter(v => v.name.toLowerCase().includes(q));
  }
  res.json(out);
});

app.get('/api/vendors/:id', (req, res) => {
  const v = byId(DB.vendors, req.params.id);
  if (!v) return notFound(res, 'vendor');
  const detail = DB.vendorDetail[req.params.id] || { reviews: [], services: [], jobsInCommunity: [] };
  res.json({
    ...v,
    ...detail,
    reviews: detail.reviews.map(hydrateAuthor),
  });
});

app.post('/api/vendors/:id/reviews', (req, res) => {
  const v = byId(DB.vendors, req.params.id);
  if (!v) return notFound(res, 'vendor');
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));
  const text = (req.body.text || '').toString().trim().slice(0, 600);
  if (!rating || !text) return res.status(400).json({ error: 'rating (1-5) and text required' });
  if (!DB.vendorDetail[req.params.id]) DB.vendorDetail[req.params.id] = { reviews: [], services: [], jobsInCommunity: [] };
  const review = { id: 'rv' + Date.now().toString(36), author: DB.user.id || 'priya', rating, time: 'just now', text };
  DB.vendorDetail[req.params.id].reviews.unshift(review);
  persist();
  res.status(201).json(hydrateAuthor(review));
});

app.get('/api/plans', (req, res) => {
  let out = DB.plansList;
  if (req.query.cat) out = out.filter(p => p.cat === req.query.cat);
  res.json(out.map(hydrateAuthor));
});

app.get('/api/threads/:id', (req, res) => {
  for (const wsId of Object.keys(DB.workspaces)) {
    const t = byId(DB.workspaces[wsId].threads, req.params.id);
    if (t) return res.json({ ...hydrateAuthor(t), requirementId: wsId });
  }
  return notFound(res, 'thread');
});

app.post('/api/threads/:id/like', (req, res) => {
  for (const wsId of Object.keys(DB.workspaces)) {
    const t = byId(DB.workspaces[wsId].threads, req.params.id);
    if (t) { t.likes = (t.likes || 0) + 1; persist(); return res.json(t); }
  }
  notFound(res, 'thread');
});

app.post('/api/polls/:id/vote', (req, res) => {
  const optionIndex = parseInt(req.body.optionIndex, 10);
  if (isNaN(optionIndex)) return res.status(400).json({ error: 'optionIndex required' });
  for (const wsId of Object.keys(DB.workspaces)) {
    const p = byId(DB.workspaces[wsId].polls, req.params.id);
    if (p) {
      if (!p.options[optionIndex]) return res.status(400).json({ error: 'invalid optionIndex' });
      p.options[optionIndex].votes++;
      p.total = (p.total || 0) + 1;
      persist();
      return res.json(p);
    }
  }
  notFound(res, 'poll');
});

app.post('/api/group-buys/:reqId/join', (req, res) => {
  const ws = workspace(req.params.reqId);
  if (!ws || !ws.groupBuy) return notFound(res, 'group buy');
  if (ws.groupBuy.joined < ws.groupBuy.target) ws.groupBuy.joined++;
  persist();
  res.json(ws.groupBuy);
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ requirements: [], vendors: [], plans: [], threads: [] });
  res.json({
    requirements: DB.requirements.filter(r => r.title.toLowerCase().includes(q)),
    vendors:      DB.vendors.filter(v => v.name.toLowerCase().includes(q)),
    plans:        DB.plansList.filter(p => p.title.toLowerCase().includes(q)).map(hydrateAuthor),
    threads:      Object.values(DB.workspaces).flatMap(w => w.threads.filter(t => t.title.toLowerCase().includes(q)).map(hydrateAuthor)),
  });
});

app.post('/api/admin/reset', (_req, res) => {
  DB = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  fs.writeFileSync(STATE_PATH, JSON.stringify(DB, null, 2));
  res.json({ ok: true });
});

// 404 for unknown /api routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// ─── static client ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// SPA fallback (in case routes are added later)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CollabBuy listening on http://localhost:${PORT}`);
});
