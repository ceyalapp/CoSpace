-- 0017: real notifications
--
-- Replaces the hardcoded /api/notifications payload with per-recipient rows.
-- Users may read/update only their own. Rows are created exclusively by
-- SECURITY DEFINER triggers on real events (so one user's action can notify
-- another without granting a cross-user INSERT policy):
--   • joining a group buy  → confirm to the joiner + alert other members
--   • a review on a vendor → alert everyone who shortlisted that vendor

begin;

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tone text not null default 'sage',
  icon text not null default 'sparkles',
  title text not null,
  sub text,
  link_kind text check (link_kind in ('req','vendor')),
  link_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "update own notifications" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- No INSERT policy: notifications are produced only by the triggers below.

-- ─── group buy join → confirm joiner + alert other members ───
create or replace function public.tg_groupbuy_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare gb record; joiner text;
begin
  select id, requirement_id, title, joined, target into gb
    from public.group_buys where id = new.group_buy_id;
  select coalesce(name, 'A neighbour') into joiner
    from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, tone, icon, title, sub, link_kind, link_id)
  values (new.user_id, 'sun', 'check',
          'You joined ' || gb.title,
          gb.joined || ' of ' || gb.target || ' spots filled', 'req', gb.requirement_id);

  insert into public.notifications (user_id, tone, icon, title, sub, link_kind, link_id)
  select m.user_id, 'sun', 'users',
         joiner || ' joined ' || gb.title,
         gb.joined || ' of ' || gb.target || ' spots filled', 'req', gb.requirement_id
    from public.group_buy_members m
   where m.group_buy_id = new.group_buy_id and m.user_id <> new.user_id;

  return new;
end$$;
revoke execute on function public.tg_groupbuy_notify() from public, anon, authenticated;
-- name sorts after groupbuy_member_after_insert, so `joined` is already incremented.
create trigger groupbuy_notify_after_insert
  after insert on public.group_buy_members
  for each row execute function public.tg_groupbuy_notify();

-- ─── vendor review → alert users who shortlisted that vendor ──
create or replace function public.tg_review_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare vname text; reviewer text; reviewer_uid uuid;
begin
  select name into vname from public.vendors where id = new.vendor_id;
  select a.name, a.profile_id into reviewer, reviewer_uid
    from public.authors a where a.id = new.author_id;

  insert into public.notifications (user_id, tone, icon, title, sub, link_kind, link_id)
  select s.user_id, 'sage', 'reply',
         'New review on ' || coalesce(vname, 'a vendor'),
         coalesce(reviewer, 'Someone') || ' rated them ' || new.rating || '★', 'vendor', new.vendor_id
    from public.shortlist s
   where s.vendor_id = new.vendor_id and s.user_id is distinct from reviewer_uid;

  return new;
end$$;
revoke execute on function public.tg_review_notify() from public, anon, authenticated;
create trigger review_notify_after_insert
  after insert on public.vendor_reviews
  for each row execute function public.tg_review_notify();

commit;
