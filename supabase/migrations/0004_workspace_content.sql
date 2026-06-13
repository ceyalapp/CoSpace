-- 0004: workspace content

create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  requirement_id text not null references public.requirements(id),
  tier text not null check (tier in ('Budget','Family','Premium')),
  title text not null,
  subtitle text,
  cost_label text,
  payback_label text,
  used_by int not null default 0,
  author_id text references public.authors(id),
  panels text,
  inverter text,
  warranty text,
  featured boolean not null default false,
  sort_order int not null default 0
);

create table public.threads (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  requirement_id text not null references public.requirements(id),
  author_id text references public.authors(id),
  title text not null,
  likes int not null default 0,
  reply_count int not null default 0,
  tag text,
  pinned boolean not null default false,
  time_label text,
  created_at timestamptz not null default now()
);

create table public.thread_likes (
  thread_id text not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.polls (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  requirement_id text not null references public.requirements(id),
  question text not null,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id bigserial primary key,
  poll_id text not null references public.polls(id) on delete cascade,
  idx int not null,
  label text not null,
  votes int not null default 0,
  unique (poll_id, idx),
  unique (poll_id, id)
);

create table public.poll_votes (
  poll_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade
);

create table public.group_buys (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  requirement_id text not null references public.requirements(id),
  title text not null,
  vendor_id text references public.vendors(id),
  target int not null check (target > 0),
  joined int not null default 0,
  discount text,
  closes text,
  per_flat text,
  status text not null default 'active' check (status in ('active','closed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.group_buy_members (
  group_buy_id text not null references public.group_buys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_buy_id, user_id)
);

create table public.resources (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  requirement_id text not null references public.requirements(id),
  title text not null,
  type text,
  size_label text,
  author_id text references public.authors(id),
  created_at timestamptz not null default now()
);

create table public.workspace_summaries (
  requirement_id text primary key references public.requirements(id) on delete cascade,
  avg_cost text,
  avg_payback text,
  installed_flats int not null default 0
);
