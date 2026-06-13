-- 0008: enable RLS and install policies

-- Enable on every public table
alter table public.communities          enable row level security;
alter table public.profiles             enable row level security;
alter table public.authors              enable row level security;
alter table public.requirements         enable row level security;
alter table public.vendors              enable row level security;
alter table public.vendor_reviews       enable row level security;
alter table public.plans                enable row level security;
alter table public.threads              enable row level security;
alter table public.thread_likes         enable row level security;
alter table public.polls                enable row level security;
alter table public.poll_options         enable row level security;
alter table public.poll_votes           enable row level security;
alter table public.group_buys           enable row level security;
alter table public.group_buy_members    enable row level security;
alter table public.resources            enable row level security;
alter table public.workspace_summaries  enable row level security;
alter table public.active_requirements  enable row level security;
alter table public.checklist_items      enable row level security;
alter table public.budgets              enable row level security;
alter table public.budget_items         enable row level security;
alter table public.shortlist            enable row level security;
alter table public.quotations           enable row level security;

-- ─── Public read (anon + authenticated) ──────────────────────
create policy "public read communities"        on public.communities          for select to anon, authenticated using (true);
create policy "public read authors"            on public.authors              for select to anon, authenticated using (true);
create policy "public read requirements"       on public.requirements         for select to anon, authenticated using (true);
create policy "public read vendors"            on public.vendors              for select to anon, authenticated using (true);
create policy "public read vendor_reviews"     on public.vendor_reviews       for select to anon, authenticated using (true);
create policy "public read plans"              on public.plans                for select to anon, authenticated using (true);
create policy "public read threads"            on public.threads              for select to anon, authenticated using (true);
create policy "public read polls"              on public.polls                for select to anon, authenticated using (true);
create policy "public read poll_options"       on public.poll_options         for select to anon, authenticated using (true);
create policy "public read group_buys"         on public.group_buys           for select to anon, authenticated using (true);
create policy "public read resources"          on public.resources            for select to anon, authenticated using (true);
create policy "public read workspace_summaries" on public.workspace_summaries for select to anon, authenticated using (true);

-- ─── profiles (PII) — authenticated read only, owner update ─
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "self update profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─── Authored content: must be your linked author ───────────
create policy "insert own thread" on public.threads
  for insert to authenticated with check (
    exists (select 1 from public.authors a where a.id = author_id and a.profile_id = auth.uid())
  );

create policy "insert own review" on public.vendor_reviews
  for insert to authenticated with check (
    exists (select 1 from public.authors a where a.id = author_id and a.profile_id = auth.uid())
  );

create policy "insert own resource" on public.resources
  for insert to authenticated with check (
    exists (select 1 from public.authors a where a.id = author_id and a.profile_id = auth.uid())
  );

-- ─── Like / vote / join: user_id must equal auth.uid() ──────
create policy "like thread as self" on public.thread_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy "see own thread likes" on public.thread_likes
  for select to authenticated using (user_id = auth.uid());
create policy "unlike thread as self" on public.thread_likes
  for delete to authenticated using (user_id = auth.uid());

create policy "vote in poll as self" on public.poll_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy "see own poll votes" on public.poll_votes
  for select to authenticated using (user_id = auth.uid());

create policy "join group buy as self" on public.group_buy_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "see own group buy memberships" on public.group_buy_members
  for select to authenticated using (user_id = auth.uid());
create policy "leave group buy as self" on public.group_buy_members
  for delete to authenticated using (user_id = auth.uid());

-- ─── Owner-only user state ──────────────────────────────────
create policy "own active_requirements" on public.active_requirements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own checklist" on public.checklist_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own budget" on public.budgets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own budget items" on public.budget_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own shortlist" on public.shortlist
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own quotations" on public.quotations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
