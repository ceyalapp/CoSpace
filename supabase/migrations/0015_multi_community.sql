-- 0015: multi-community — scope catalog/workspace content by community_id
--
-- Until now all catalog content (requirements, vendors, plans, threads, polls,
-- group_buys, resources) was global and world-readable. This migration makes
-- community a first-class tenant boundary:
--   1. Adds community_id to the 7 content tables, backfilled to lakeside_habitat.
--   2. Adds a current_community_id() helper that reads the caller's profile
--      (NOT user_metadata — that is user-editable and unsafe for authz).
--   3. Replaces "public read … using (true)" with community-scoped read policies.
--   4. Scopes the child tables (vendor_reviews, poll_options, workspace_summaries)
--      via EXISTS on their community-scoped parent.
--   5. Adds a second community so onboarding has something to pick.
--
-- Reads are now authenticated-only and limited to the caller's community. The app
-- is already gated behind a Supabase session (anon never calls /api), so dropping
-- anon read does not change the product surface.

begin;

-- ─── 1. community_id on content tables ───────────────────────
alter table public.requirements add column if not exists community_id text references public.communities(id);
alter table public.vendors      add column if not exists community_id text references public.communities(id);
alter table public.plans        add column if not exists community_id text references public.communities(id);
alter table public.threads      add column if not exists community_id text references public.communities(id);
alter table public.polls        add column if not exists community_id text references public.communities(id);
alter table public.group_buys   add column if not exists community_id text references public.communities(id);
alter table public.resources    add column if not exists community_id text references public.communities(id);

-- Backfill all existing rows to the original single community.
update public.requirements set community_id = 'lakeside_habitat' where community_id is null;
update public.vendors      set community_id = 'lakeside_habitat' where community_id is null;
update public.plans        set community_id = 'lakeside_habitat' where community_id is null;
update public.threads      set community_id = 'lakeside_habitat' where community_id is null;
update public.polls        set community_id = 'lakeside_habitat' where community_id is null;
update public.group_buys   set community_id = 'lakeside_habitat' where community_id is null;
update public.resources    set community_id = 'lakeside_habitat' where community_id is null;

-- Now enforce NOT NULL.
alter table public.requirements alter column community_id set not null;
alter table public.vendors      alter column community_id set not null;
alter table public.plans        alter column community_id set not null;
alter table public.threads      alter column community_id set not null;
alter table public.polls        alter column community_id set not null;
alter table public.group_buys   alter column community_id set not null;
alter table public.resources    alter column community_id set not null;

create index if not exists requirements_community_idx on public.requirements (community_id);
create index if not exists vendors_community_idx      on public.vendors (community_id);
create index if not exists plans_community_idx        on public.plans (community_id);
create index if not exists threads_community_idx      on public.threads (community_id);
create index if not exists polls_community_idx        on public.polls (community_id);
create index if not exists group_buys_community_idx   on public.group_buys (community_id);
create index if not exists resources_community_idx    on public.resources (community_id);

-- ─── 2. current_community_id() helper ────────────────────────
-- Reads from profiles (server-controlled), never from auth.jwt()/user_metadata.
create or replace function public.current_community_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select community_id from public.profiles where id = auth.uid() limit 1;
$$;
revoke execute on function public.current_community_id() from public, anon, authenticated;
grant execute on function public.current_community_id() to authenticated;

-- ─── 3. community-scoped read policies on content tables ─────
drop policy if exists "public read requirements" on public.requirements;
drop policy if exists "public read vendors"      on public.vendors;
drop policy if exists "public read plans"        on public.plans;
drop policy if exists "public read threads"      on public.threads;
drop policy if exists "public read polls"        on public.polls;
drop policy if exists "public read group_buys"   on public.group_buys;
drop policy if exists "public read resources"    on public.resources;

create policy "read requirements in my community" on public.requirements
  for select to authenticated using (community_id = public.current_community_id());
create policy "read vendors in my community" on public.vendors
  for select to authenticated using (community_id = public.current_community_id());
create policy "read plans in my community" on public.plans
  for select to authenticated using (community_id = public.current_community_id());
create policy "read threads in my community" on public.threads
  for select to authenticated using (community_id = public.current_community_id());
create policy "read polls in my community" on public.polls
  for select to authenticated using (community_id = public.current_community_id());
create policy "read group_buys in my community" on public.group_buys
  for select to authenticated using (community_id = public.current_community_id());
create policy "read resources in my community" on public.resources
  for select to authenticated using (community_id = public.current_community_id());

-- ─── 4. child tables scoped via their community-scoped parent ─
drop policy if exists "public read vendor_reviews"      on public.vendor_reviews;
drop policy if exists "public read poll_options"        on public.poll_options;
drop policy if exists "public read workspace_summaries" on public.workspace_summaries;

create policy "read vendor_reviews in my community" on public.vendor_reviews
  for select to authenticated using (
    exists (select 1 from public.vendors v
             where v.id = vendor_id and v.community_id = public.current_community_id())
  );
create policy "read poll_options in my community" on public.poll_options
  for select to authenticated using (
    exists (select 1 from public.polls p
             where p.id = poll_id and p.community_id = public.current_community_id())
  );
create policy "read workspace_summaries in my community" on public.workspace_summaries
  for select to authenticated using (
    exists (select 1 from public.requirements r
             where r.id = requirement_id and r.community_id = public.current_community_id())
  );

-- ─── 5. tighten insert policies to the caller's community ────
-- Requirements: user-created rows must belong to the caller AND their community.
drop policy if exists "authenticated insert requirements" on public.requirements;
create policy "authenticated insert requirements" on public.requirements
  for insert to authenticated
  with check (created_by = (select auth.uid()) and community_id = public.current_community_id());

-- Threads / resources: keep author-ownership check, add community guard.
drop policy if exists "insert own thread" on public.threads;
create policy "insert own thread" on public.threads
  for insert to authenticated
  with check (
    community_id = public.current_community_id()
    and exists (select 1 from public.authors a where a.id = author_id and a.profile_id = (select auth.uid()))
  );

drop policy if exists "insert own resource" on public.resources;
create policy "insert own resource" on public.resources
  for insert to authenticated
  with check (
    community_id = public.current_community_id()
    and exists (select 1 from public.authors a where a.id = author_id and a.profile_id = (select auth.uid()))
  );

-- ─── 6. a second community so onboarding has a real choice ───
insert into public.communities (id, name, short_name, members_count) values
  ('green_meadows', 'Green Meadows Residency', 'Green Meadows', 0)
on conflict (id) do nothing;

commit;
