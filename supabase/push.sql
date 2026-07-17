-- Web push notifications. Run in the Supabase SQL editor after calendar.sql.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- A user can have multiple subscriptions (one per browser/device); dedupe on
-- the endpoint itself, which is unique per registration.
create unique index if not exists push_subscriptions_endpoint_uq
  on push_subscriptions (endpoint);

alter table push_subscriptions enable row level security;
drop policy if exists own_rows on push_subscriptions;
create policy own_rows on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Marks when a reminder push was sent for a block, so the cron sweep never
-- double-sends. Null = not yet reminded.
alter table calendar_blocks add column if not exists reminder_sent_at timestamptz;

-- The cron sweep scans "starts soon and not yet reminded" across every
-- user every few minutes — needs to be an index, not a sequential scan.
create index if not exists calendar_blocks_reminder_idx
  on calendar_blocks (start_at) where reminder_sent_at is null;
