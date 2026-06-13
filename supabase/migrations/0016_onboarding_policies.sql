-- 0016: onboarding without the service key
--
-- Onboarding needs to (a) create the caller's author identity, (b) optionally
-- create a community, and (c) keep communities.members_count current. The server
-- previously leaned on the service-role client for this, but that key may be absent
-- (placeholder). These changes let the *user* client do it safely under RLS:
--   1. A user may insert/update their own author row (profile_id = auth.uid()).
--   2. Any authenticated user may create a community.
--   3. A trigger maintains members_count as profiles join/switch/leave communities.

begin;

-- 1. authors: manage your own identity
drop policy if exists "insert own author" on public.authors;
create policy "insert own author" on public.authors
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "update own author" on public.authors;
create policy "update own author" on public.authors
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- 2. communities: authenticated users may create one (join is just a profile update)
drop policy if exists "authenticated insert communities" on public.communities;
create policy "authenticated insert communities" on public.communities
  for insert to authenticated
  with check (true);

-- 3. members_count maintenance (SECURITY DEFINER so it can write communities)
create or replace function public.tg_profile_community_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if new.community_id is not null then
      update public.communities set members_count = members_count + 1 where id = new.community_id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if new.community_id is distinct from old.community_id then
      if old.community_id is not null then
        update public.communities set members_count = greatest(members_count - 1, 0) where id = old.community_id;
      end if;
      if new.community_id is not null then
        update public.communities set members_count = members_count + 1 where id = new.community_id;
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.community_id is not null then
      update public.communities set members_count = greatest(members_count - 1, 0) where id = old.community_id;
    end if;
  end if;
  return null;
end$$;
revoke execute on function public.tg_profile_community_count() from public, anon, authenticated;

drop trigger if exists profile_community_count on public.profiles;
create trigger profile_community_count
  after insert or update or delete on public.profiles
  for each row execute function public.tg_profile_community_count();

commit;
