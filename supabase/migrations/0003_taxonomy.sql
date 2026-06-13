-- 0003: requirements, vendors, vendor_reviews

create table public.requirements (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  title text not null,
  emoji text,
  heat text check (heat in ('hot','warm','cool')),
  tint text,
  cost_label text,
  active int not null default 0,
  plans_count int not null default 0,
  vendors_count int not null default 0,
  sort_order int not null default 0
);

create table public.vendors (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null,
  requirement_id text not null references public.requirements(id),
  rating numeric(2,1),
  jobs int not null default 0,
  score int,
  price_label text,
  tag text,
  logo text,
  color text,
  resp_label text,
  est_label text,
  verified boolean not null default false,
  photos int not null default 0,
  services text[] not null default '{}',
  jobs_in_community jsonb not null default '[]'::jsonb
);

create table public.vendor_reviews (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  vendor_id text not null references public.vendors(id) on delete cascade,
  author_id text not null references public.authors(id),
  rating int not null check (rating between 1 and 5),
  text text not null,
  time_label text,
  created_at timestamptz not null default now()
);
