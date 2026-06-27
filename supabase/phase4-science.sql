-- Phase 4: data-driven science library
-- Run in the Supabase SQL editor after schema.sql and calendar.sql.
-- Adds session_templates table with the same per-user RLS pattern as all other tables.

create table if not exists session_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default compass_uid() references auth.users(id) on delete cascade,
  -- builtin_id mirrors the string id from BUILTIN_LIBRARY (e.g. "gym-push").
  -- Used as the upsert conflict key so seeded rows are stable across reseeds.
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
