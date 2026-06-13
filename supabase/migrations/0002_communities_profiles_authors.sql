-- 0002: communities, profiles, authors

create table public.communities (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null,
  short_name text not null,
  members_count int not null default 0
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  community_id text references public.communities(id),
  name text not null,
  flat text,
  block text,
  avatar text,
  avatar_color text,
  created_at timestamptz not null default now()
);

create table public.authors (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null,
  flat text,
  avatar text,
  color text,
  profile_id uuid unique references public.profiles(id) on delete set null
);

-- Auto-create profile row when a new auth user is created. The seed script and signup
-- form both populate auth.users.raw_user_meta_data with the relevant fields.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, community_id, name, flat, block, avatar, avatar_color)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'community_id', ''),
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'flat', ''),
    nullif(new.raw_user_meta_data->>'block', ''),
    nullif(new.raw_user_meta_data->>'avatar', ''),
    nullif(new.raw_user_meta_data->>'avatar_color', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Returns the authors.id for the currently authenticated user, or null.
create or replace function public.current_author_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.authors where profile_id = auth.uid() limit 1;
$$;

revoke all on function public.current_author_id() from public;
grant execute on function public.current_author_id() to authenticated;
