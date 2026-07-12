-- Lodestone: one-shot setup script for a brand-new Supabase project.
-- Run this in full in the SQL editor of the *separate* Supabase project
-- created for Lodestone (never the personal Compass project) — Settings
-- → SQL Editor → New query → paste this whole file → Run.
--
-- This is the concatenation of schema.sql, calendar.sql, calendar-oauth.sql,
-- phase4-science.sql, phase4-logging.sql and phase5-daily-loop.sql in their
-- required order, so Lodestone starts on the exact same schema Compass runs
-- today. Every statement is idempotent (IF NOT EXISTS / IF EXISTS guards),
-- so it's safe to re-run if something fails partway through.
-- demo_data.sql is intentionally NOT included — that's Compass's personal
-- sample data, not something a fresh Lodestone project needs.

-- ── schema.sql ─────────────────────────────────────────────────────────────

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

-- ── calendar.sql ───────────────────────────────────────────────────────────

create table if not exists calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'manual',
  external_id text,
  external_calendar_id text,
  busy boolean not null default true,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  provider text not null,
  label text not null,
  ics_url text,
  color text,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Full (non-partial) index — PostgREST's upsert(onConflict) can only infer a
-- plain column-list unique index, not a partial one. Still safe for manual
-- rows (external_id null): Postgres treats each NULL as distinct, so they
-- never conflict with each other.
create unique index if not exists calendar_blocks_external_uq
  on calendar_blocks (user_id, external_calendar_id, external_id);

create index if not exists calendar_blocks_range_idx
  on calendar_blocks (user_id, start_at);

do $$
declare t text;
begin
  foreach t in array array['calendar_blocks','calendar_connections'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- ── calendar-oauth.sql ─────────────────────────────────────────────────────

create table if not exists calendar_oauth_tokens (
  connection_id uuid primary key references calendar_connections(id) on delete cascade,
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  scope text,
  account_email text,
  sync_token text,
  needs_reauth boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table calendar_oauth_tokens enable row level security;
revoke all on calendar_oauth_tokens from anon, authenticated;

alter table calendar_connections add column if not exists account_email text;
alter table calendar_connections add column if not exists needs_reauth boolean not null default false;

-- ── phase4-science.sql ─────────────────────────────────────────────────────

create table if not exists session_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default compass_uid() references auth.users(id) on delete cascade,
  builtin_id  text,
  domain      text not null,
  session_type text not null,
  duration_min int not null,
  plan        jsonb not null default '[]',
  cite        text not null default '',
  why         text not null default '',
  variants    jsonb not null default '[]',
  is_builtin  boolean not null default false,
  weekly_default int,
  created_at  timestamptz not null default now(),
  unique (user_id, builtin_id)
);

alter table session_templates enable row level security;
drop policy if exists own_rows on session_templates;
create policy own_rows on session_templates
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── phase4-logging.sql ─────────────────────────────────────────────────────

alter table suggestions
  add column if not exists session_type text;

-- ── phase5-daily-loop.sql ──────────────────────────────────────────────────

alter table suggestions
  add column if not exists personal_insight text;
