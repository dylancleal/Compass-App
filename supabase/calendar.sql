-- Calendar Phase 1. Run in the Supabase SQL editor after schema.sql.

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

-- Dedupe imported events per source calendar (Phase 2 upserts rely on this).
create unique index if not exists calendar_blocks_external_uq
  on calendar_blocks (user_id, external_calendar_id, external_id)
  where external_id is not null;

-- Fast range queries for a visible week/day.
create index if not exists calendar_blocks_range_idx
  on calendar_blocks (user_id, start_at);

-- RLS: same own-rows policy as every other table.
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
