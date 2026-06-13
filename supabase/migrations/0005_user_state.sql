-- 0005: per-user state (owner-only via RLS)

create table public.active_requirements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id text not null references public.requirements(id),
  stage text,
  progress numeric(3,2) check (progress between 0 and 1),
  next_step text,
  updated_label text,
  updated_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

create table public.checklist_items (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.budgets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  planned bigint not null default 0
);

create table public.budget_items (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  amount bigint not null default 0,
  paid boolean not null default false,
  sort_order int not null default 0
);

create table public.shortlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

create table public.quotations (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id text references public.vendors(id) on delete set null,
  vendor_label text,
  amount_label text,
  amount_rupees bigint,
  date_label text,
  best boolean not null default false,
  created_at timestamptz not null default now()
);
