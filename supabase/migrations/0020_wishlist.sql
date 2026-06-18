-- 0020: per-user reorderable wishlist of saved requirements (owner-only via RLS)
-- Mirrors the owner-only state pattern of shortlist/active_requirements
-- (0005_user_state.sql + 0008_rls_policies.sql), with a persisted `position`
-- column so members can order the list by priority.

create table public.wishlist_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id text not null references public.requirements(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

create index wishlist_items_user_pos_idx on public.wishlist_items (user_id, position);

alter table public.wishlist_items enable row level security;

create policy "own wishlist" on public.wishlist_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
