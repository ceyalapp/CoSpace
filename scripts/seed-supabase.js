#!/usr/bin/env node
// Idempotent seed loader for CollabBuy.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env).
// Run: node scripts/seed-supabase.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIYA_EMAIL  = process.env.PRIYA_EMAIL || 'balabesimple@gmail.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Aborting.');
  process.exit(1);
}
if (SERVICE_KEY.startsWith('PASTE_')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY looks like a placeholder. Paste the real key from Dashboard → Settings → API → service_role.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));

const COMMUNITY_ID = 'lakeside_habitat';

function die(label, err) {
  console.error(`✗ ${label}:`, err.message || err);
  process.exit(1);
}
async function step(label, fn) {
  try {
    const result = await fn();
    console.log(`✓ ${label}`);
    return result;
  } catch (e) { die(label, e); }
}

async function ensurePriyaUser() {
  // 1) Find by email
  const { data: list, error: listErr } = await sb.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find(u => u.email === PRIYA_EMAIL);
  if (existing) return existing.id;

  const u = seed.user;
  const { data: created, error } = await sb.auth.admin.createUser({
    email: PRIYA_EMAIL,
    email_confirm: true,
    user_metadata: {
      handle: u.id,
      name: u.name,
      flat: u.flat,
      block: u.block,
      avatar: u.avatar,
      avatar_color: u.avatarColor,
      community_id: COMMUNITY_ID,
    },
  });
  if (error) throw error;
  return created.user.id;
}

async function seedAll() {
  await step('community', async () => {
    const u = seed.user;
    const { error } = await sb.from('communities').upsert({
      id: COMMUNITY_ID,
      name: u.community,
      short_name: u.communityShort,
      members_count: u.members,
    });
    if (error) throw error;
  });

  const priyaUid = await step('priya auth user', ensurePriyaUser);

  // Trigger may have created profile; ensure it has the right fields.
  await step('priya profile', async () => {
    const u = seed.user;
    const { error } = await sb.from('profiles').upsert({
      id: priyaUid,
      community_id: COMMUNITY_ID,
      name: u.name,
      flat: u.flat,
      block: u.block,
      avatar: u.avatar,
      avatar_color: u.avatarColor,
    });
    if (error) throw error;
  });

  await step('authors', async () => {
    const rows = [
      { id: seed.user.id, name: seed.user.name, flat: seed.user.flat, avatar: seed.user.avatar, color: seed.user.avatarColor, profile_id: priyaUid },
      ...seed.residents.map(r => ({ id: r.id, name: r.name, flat: r.flat, avatar: r.avatar, color: r.color, profile_id: null })),
    ];
    const { error } = await sb.from('authors').upsert(rows);
    if (error) throw error;
  });

  await step('requirements', async () => {
    const rows = seed.requirements.map((r, i) => ({
      id: r.id, title: r.title, emoji: r.emoji, heat: r.heat, tint: r.tint,
      cost_label: r.cost, active: r.active, plans_count: r.plans, vendors_count: r.vendors,
      sort_order: i, community_id: COMMUNITY_ID,
    }));
    const { error } = await sb.from('requirements').upsert(rows);
    if (error) throw error;
  });

  await step('vendors', async () => {
    const rows = seed.vendors.map(v => ({
      id: v.id, name: v.name, requirement_id: v.cat, rating: v.rating, jobs: v.jobs, score: v.score,
      price_label: v.price, tag: v.tag, logo: v.logo, color: v.color,
      resp_label: v.resp, est_label: v.est, verified: !!v.verified,
      photos: seed.vendorDetail[v.id]?.photos || 0,
      services: seed.vendorDetail[v.id]?.services || [],
      jobs_in_community: seed.vendorDetail[v.id]?.jobsInCommunity || [],
      community_id: COMMUNITY_ID,
    }));
    const { error } = await sb.from('vendors').upsert(rows);
    if (error) throw error;
  });

  await step('vendor_reviews', async () => {
    const rows = [];
    for (const [vendorId, detail] of Object.entries(seed.vendorDetail || {})) {
      for (const r of detail.reviews || []) {
        rows.push({
          id: r.id, vendor_id: vendorId, author_id: r.author,
          rating: r.rating, text: r.text, time_label: r.time,
        });
      }
    }
    if (!rows.length) return;
    const { error } = await sb.from('vendor_reviews').upsert(rows);
    if (error) throw error;
  });

  await step('plans', async () => {
    const byId = new Map();
    for (const [reqId, ws] of Object.entries(seed.workspaces || {})) {
      (ws.plans || []).forEach((p, i) => {
        byId.set(p.id, {
          id: p.id, requirement_id: reqId, tier: p.tier, title: p.title, subtitle: p.subtitle,
          cost_label: p.cost, payback_label: p.payback, used_by: p.usedBy, author_id: p.author,
          panels: p.panels, inverter: p.inverter, warranty: p.warranty,
          featured: !!p.featured, sort_order: i, community_id: COMMUNITY_ID,
        });
      });
    }
    (seed.plansList || []).forEach((p, i) => {
      if (byId.has(p.id)) return;
      byId.set(p.id, {
        id: p.id, requirement_id: p.cat, tier: p.tier, title: p.title,
        cost_label: p.cost, used_by: p.usedBy, author_id: p.author,
        featured: !!p.featured, sort_order: 100 + i, community_id: COMMUNITY_ID,
      });
    });
    const { error } = await sb.from('plans').upsert([...byId.values()]);
    if (error) throw error;
  });

  await step('workspace_summaries', async () => {
    const rows = Object.entries(seed.workspaces || {}).map(([reqId, ws]) => ({
      requirement_id: reqId,
      avg_cost: ws.summary?.avgCost,
      avg_payback: ws.summary?.avgPayback,
      installed_flats: ws.summary?.installedFlats || 0,
    }));
    if (!rows.length) return;
    const { error } = await sb.from('workspace_summaries').upsert(rows);
    if (error) throw error;
  });

  await step('threads', async () => {
    const rows = [];
    for (const [reqId, ws] of Object.entries(seed.workspaces || {})) {
      (ws.threads || []).forEach(t => {
        rows.push({
          id: t.id, requirement_id: reqId, author_id: t.author, title: t.title,
          likes: t.likes || 0, reply_count: t.replies || 0,
          tag: t.tag, pinned: !!t.pinned, time_label: t.time, community_id: COMMUNITY_ID,
        });
      });
    }
    if (!rows.length) return;
    const { error } = await sb.from('threads').upsert(rows);
    if (error) throw error;
  });

  await step('polls + options', async () => {
    const polls = [];
    const options = [];
    for (const [reqId, ws] of Object.entries(seed.workspaces || {})) {
      (ws.polls || []).forEach(p => {
        polls.push({ id: p.id, requirement_id: reqId, question: p.q, community_id: COMMUNITY_ID });
        (p.options || []).forEach((o, i) => {
          options.push({ poll_id: p.id, idx: i, label: o.label, votes: o.votes });
        });
      });
    }
    if (polls.length) {
      const { error: e1 } = await sb.from('polls').upsert(polls);
      if (e1) throw e1;
    }
    if (options.length) {
      // Upsert by (poll_id, idx) — delete & insert to keep order stable
      const { error: e2 } = await sb.from('poll_options')
        .upsert(options, { onConflict: 'poll_id,idx', ignoreDuplicates: false });
      if (e2) throw e2;
    }
  });

  await step('group_buys', async () => {
    const rows = [];
    for (const [reqId, ws] of Object.entries(seed.workspaces || {})) {
      if (!ws.groupBuy) continue;
      const gb = ws.groupBuy;
      rows.push({
        id: `gb_${reqId}`, requirement_id: reqId, title: gb.title,
        vendor_id: seed.vendors.find(v => v.name === gb.vendor)?.id || null,
        target: gb.target, joined: gb.joined,
        discount: gb.discount, closes: gb.closes, per_flat: gb.perFlat,
        status: 'active', community_id: COMMUNITY_ID,
      });
    }
    if (!rows.length) return;
    const { error } = await sb.from('group_buys').upsert(rows);
    if (error) throw error;
  });

  await step('resources', async () => {
    const rows = [];
    for (const [reqId, ws] of Object.entries(seed.workspaces || {})) {
      (ws.resources || []).forEach(r => {
        rows.push({
          id: r.id, requirement_id: reqId, title: r.title,
          type: r.type, size_label: r.size, author_id: r.by, community_id: COMMUNITY_ID,
        });
      });
    }
    if (!rows.length) return;
    const { error } = await sb.from('resources').upsert(rows);
    if (error) throw error;
  });

  await step('priya active_requirements', async () => {
    const rows = (seed.me.activeReqs || []).map(r => ({
      user_id: priyaUid, requirement_id: r.id,
      stage: r.stage, progress: r.progress, next_step: r.nextStep, updated_label: r.updated,
    }));
    if (!rows.length) return;
    const { error } = await sb.from('active_requirements').upsert(rows);
    if (error) throw error;
  });

  await step('priya checklist', async () => {
    const rows = (seed.me.checklist || []).map(c => ({
      id: c.id, user_id: priyaUid, text: c.text, done: !!c.done,
    }));
    if (!rows.length) return;
    const { error } = await sb.from('checklist_items').upsert(rows);
    if (error) throw error;
  });

  await step('priya budget', async () => {
    const b = seed.me.budget;
    if (!b) return;
    const { error } = await sb.from('budgets').upsert({ user_id: priyaUid, planned: b.planned });
    if (error) throw error;
    // budget_items: id is bigserial so we need to delete-then-insert to stay idempotent
    await sb.from('budget_items').delete().eq('user_id', priyaUid);
    const items = (b.items || []).map((it, i) => ({
      user_id: priyaUid, label: it.label, amount: it.amount, paid: !!it.paid, sort_order: i,
    }));
    if (items.length) {
      const { error: e2 } = await sb.from('budget_items').insert(items);
      if (e2) throw e2;
    }
  });

  await step('priya shortlist', async () => {
    const rows = (seed.me.shortlist || []).map(vid => ({ user_id: priyaUid, vendor_id: vid }));
    if (!rows.length) return;
    const { error } = await sb.from('shortlist').upsert(rows);
    if (error) throw error;
  });

  await step('priya quotations', async () => {
    const rows = (seed.me.quotations || []).map(q => ({
      user_id: priyaUid,
      vendor_id: seed.vendors.find(v => v.name === q.vendor)?.id || null,
      vendor_label: q.vendor, amount_label: q.amount, date_label: q.date, best: !!q.best,
    }));
    if (!rows.length) return;
    // delete-then-insert for idempotency (bigserial id)
    await sb.from('quotations').delete().eq('user_id', priyaUid);
    const { error } = await sb.from('quotations').insert(rows);
    if (error) throw error;
  });

  console.log('\nSeed complete. Sign in as', PRIYA_EMAIL);
}

seedAll().catch(e => die('seed', e));
