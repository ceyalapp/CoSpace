-- 0018: INSERT policies for member-authored workspace content
-- Lets a signed-in community member add plans, polls, poll options, and vendors
-- to their own community. Mirrors the existing "insert own thread/resource" rules.
-- (threads, resources, vendor_reviews already have INSERT policies.)

-- Plans: community-scoped, attributed to the caller's linked author.
create policy "insert plan in my community" on public.plans
  for insert to authenticated with check (
    community_id = current_community_id()
    and exists (
      select 1 from public.authors a
      where a.id = author_id and a.profile_id = (select auth.uid())
    )
  );

-- Polls have no author column — any member may open one in their community.
create policy "insert poll in my community" on public.polls
  for insert to authenticated with check (
    community_id = current_community_id()
  );

-- Poll options inherit the parent poll's community.
create policy "insert poll_options in my community" on public.poll_options
  for insert to authenticated with check (
    exists (
      select 1 from public.polls p
      where p.id = poll_id and p.community_id = current_community_id()
    )
  );

-- Vendors are a community directory — any member may add one to their community.
create policy "insert vendor in my community" on public.vendors
  for insert to authenticated with check (
    community_id = current_community_id()
  );
