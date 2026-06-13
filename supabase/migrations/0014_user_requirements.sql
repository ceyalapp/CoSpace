-- 0014: allow authenticated users to create new requirements.
--
-- Schema additions:
--   - created_by uuid (nullable for seeded rows; required for user-created rows)
--   - created_at timestamptz default now()
--
-- RLS: authenticated INSERT only when created_by = auth.uid().
-- SELECT remains public per 0008. UPDATE/DELETE remain server-only (no policy).

alter table public.requirements
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists requirements_created_by_idx
  on public.requirements (created_by);

create index if not exists requirements_created_at_idx
  on public.requirements (created_at desc);

-- Allow authenticated users to insert their own requirements.
drop policy if exists "authenticated insert requirements" on public.requirements;
create policy "authenticated insert requirements"
  on public.requirements
  for insert
  to authenticated
  with check (created_by = auth.uid());
