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

-- Dedupe imported events per source calendar. Full (non-partial) index —
-- PostgREST's upsert(onConflict: "...") can only infer a plain column-list
-- unique index, not a partial one, so a `where external_id is not null`
-- predicate here makes every sync's ON CONFLICT silently unmatchable. This
-- is still safe for manually-created rows (external_id null): Postgres
-- treats each NULL as distinct, so they never conflict with each other.
--
-- Drop-then-create, not `if not exists`: an earlier version of this file
-- created this same index name as a PARTIAL index (`where external_id is
-- not null`). `create ... if not exists` only checks the name, not the
-- definition — on a database that still has the old partial index, it
-- silently no-ops and the broken index never gets replaced. Re-running
-- this file is safe either way (no data loss — it's just an index).
drop index if exists calendar_blocks_external_uq;
create unique index calendar_blocks_external_uq
  on calendar_blocks (user_id, external_calendar_id, external_id);

-- Fast range queries for a visible week/day.
create index if not exists calendar_blocks_range_idx
  on calendar_blocks (user_id, start_at);

-- Synced events point at the connection they came from via
-- external_calendar_id, but that was only ever a loose text tag with nothing
-- enforcing it. Two ways that stranded events on the calendar forever:
--   1. Removing a connection relied on the app remembering to delete the
--      blocks too, in a separate statement that could partially fail.
--   2. A sync that finished *after* its connection was removed happily wrote
--      events referencing a connection that no longer existed — a real race,
--      since a sync runs server-side over several seconds.
-- A real foreign key fixes both directions at once: deletes cascade, and an
-- insert naming a dead connection is rejected outright.
--
-- Safe to re-run. The delete only removes rows already pointing at a
-- connection that no longer exists (i.e. already invisible-but-undeletable
-- junk); manual blocks have a null external_calendar_id and are untouched.
delete from calendar_blocks
  where external_calendar_id is not null
    and external_calendar_id <> ''
    and external_calendar_id not in (select id::text from calendar_connections);

alter table calendar_blocks
  alter column external_calendar_id type uuid
  using nullif(external_calendar_id, '')::uuid;

alter table calendar_blocks
  drop constraint if exists calendar_blocks_external_calendar_fk;
alter table calendar_blocks
  add constraint calendar_blocks_external_calendar_fk
  foreign key (external_calendar_id) references calendar_connections(id) on delete cascade;

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
