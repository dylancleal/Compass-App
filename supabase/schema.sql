-- Compass schema for Supabase (Phase 1 → cloud sync).
-- Run this in the Supabase SQL editor after creating a project.
-- Every table is private per-user via RLS; user_id defaults to the caller's id
-- so client inserts never have to set it.

-- Helper: default owner = current authenticated user.
create or replace function compass_uid() returns uuid
  language sql stable as $$ select auth.uid() $$;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  icon text not null default '⭐',
  "order" int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  estimate_minutes int,
  status text not null default 'not_started',
  source text not null default 'manual',
  external_id text,
  first_step text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  date date not null,
  type text not null,
  duration_minutes int,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  type text not null,
  unit text
);

create table if not exists metric_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  metric_id uuid references metrics(id) on delete cascade,
  date date not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  date date not null,
  mental int not null,
  uni_readiness int not null,
  capacity text not null,
  note text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  date date not null,
  category_id uuid references categories(id) on delete set null,
  text text not null,
  reason text not null,
  est_minutes int,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists settings (
  user_id uuid primary key default compass_uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

-- Row Level Security: each user sees only their own rows.
do $$
declare t text;
begin
  foreach t in array array[
    'categories','tasks','sessions','metrics','metric_logs',
    'checkins','suggestions','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
