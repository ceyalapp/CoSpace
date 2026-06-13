-- 0011: address advisor warnings
-- 1) Revoke EXECUTE on all SECURITY DEFINER functions (invoked by triggers / server only)
revoke execute on function public.current_author_id()                  from public, anon, authenticated;
revoke execute on function public.handle_new_user()                    from public, anon, authenticated;
revoke execute on function public.tg_thread_like_after_insert()        from public, anon, authenticated;
revoke execute on function public.tg_thread_like_after_delete()        from public, anon, authenticated;
revoke execute on function public.tg_poll_vote_after_insert()          from public, anon, authenticated;
revoke execute on function public.tg_groupbuy_member_before_insert()   from public, anon, authenticated;
revoke execute on function public.tg_groupbuy_member_after_insert()    from public, anon, authenticated;
revoke execute on function public.tg_groupbuy_member_after_delete()    from public, anon, authenticated;
grant execute on function public.current_author_id() to authenticated;

-- 2) Rewrite RLS policies to use (select auth.uid()) — single evaluation per query
drop policy "self update profile"              on public.profiles;
drop policy "insert own thread"                on public.threads;
drop policy "insert own review"                on public.vendor_reviews;
drop policy "insert own resource"              on public.resources;
drop policy "like thread as self"              on public.thread_likes;
drop policy "see own thread likes"             on public.thread_likes;
drop policy "unlike thread as self"            on public.thread_likes;
drop policy "vote in poll as self"             on public.poll_votes;
drop policy "see own poll votes"               on public.poll_votes;
drop policy "join group buy as self"           on public.group_buy_members;
drop policy "see own group buy memberships"    on public.group_buy_members;
drop policy "leave group buy as self"          on public.group_buy_members;
drop policy "own active_requirements"          on public.active_requirements;
drop policy "own checklist"                    on public.checklist_items;
drop policy "own budget"                       on public.budgets;
drop policy "own budget items"                 on public.budget_items;
drop policy "own shortlist"                    on public.shortlist;
drop policy "own quotations"                   on public.quotations;

create policy "self update profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "insert own thread" on public.threads
  for insert to authenticated
  with check (exists (select 1 from public.authors a where a.id = author_id and a.profile_id = (select auth.uid())));

create policy "insert own review" on public.vendor_reviews
  for insert to authenticated
  with check (exists (select 1 from public.authors a where a.id = author_id and a.profile_id = (select auth.uid())));

create policy "insert own resource" on public.resources
  for insert to authenticated
  with check (exists (select 1 from public.authors a where a.id = author_id and a.profile_id = (select auth.uid())));

create policy "like thread as self"   on public.thread_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "see own thread likes"  on public.thread_likes for select to authenticated using (user_id = (select auth.uid()));
create policy "unlike thread as self" on public.thread_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "vote in poll as self"   on public.poll_votes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "see own poll votes"     on public.poll_votes for select to authenticated using (user_id = (select auth.uid()));

create policy "join group buy as self"        on public.group_buy_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "see own group buy memberships" on public.group_buy_members for select to authenticated using (user_id = (select auth.uid()));
create policy "leave group buy as self"       on public.group_buy_members for delete to authenticated using (user_id = (select auth.uid()));

create policy "own active_requirements" on public.active_requirements
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own checklist"           on public.checklist_items
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own budget"              on public.budgets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own budget items"        on public.budget_items
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own shortlist"           on public.shortlist
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own quotations"          on public.quotations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3) Indexes for FKs the advisor flagged
create index active_requirements_requirement_idx on public.active_requirements (requirement_id);
create index group_buys_vendor_idx               on public.group_buys (vendor_id);
create index plans_author_idx                    on public.plans (author_id);
create index poll_votes_poll_option_idx          on public.poll_votes (poll_id, option_id);
create index quotations_vendor_idx               on public.quotations (vendor_id);
create index resources_author_idx                on public.resources (author_id);
create index shortlist_vendor_idx                on public.shortlist (vendor_id);
create index threads_author_idx                  on public.threads (author_id);
create index vendor_reviews_author_idx           on public.vendor_reviews (author_id);
