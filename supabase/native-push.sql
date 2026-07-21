-- Native (Android/iOS) push notification tokens, via Firebase Cloud
-- Messaging. Separate table from push_subscriptions (supabase/push.sql) —
-- FCM tokens are a single opaque string, not a Web Push endpoint/keys triple,
-- and are sent through the Firebase Admin SDK rather than web-push. Run in
-- the Supabase SQL editor after push.sql.

create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  token text not null,
  -- IANA name, same purpose as push_subscriptions.timezone — see push.sql.
  timezone text,
  created_at timestamptz not null default now()
);

-- A user can have multiple devices; dedupe on the token itself, which
-- Firebase guarantees unique per app install.
create unique index if not exists fcm_tokens_token_uq
  on fcm_tokens (token);

alter table fcm_tokens enable row level security;
drop policy if exists own_rows on fcm_tokens;
create policy own_rows on fcm_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
