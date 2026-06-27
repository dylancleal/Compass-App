-- Calendar Phase 3b (OAuth). Run in the Supabase SQL editor after calendar.sql.

-- Encrypted token storage — intentionally NOT readable by the anon/authenticated role.
-- Only the service role key (used exclusively in server route handlers) can access this.
create table if not exists calendar_oauth_tokens (
  connection_id uuid primary key references calendar_connections(id) on delete cascade,
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,           -- AES-GCM encrypted
  refresh_token text not null,          -- AES-GCM encrypted
  access_token_expires_at timestamptz not null,
  scope text,
  account_email text,
  sync_token text,                      -- Google: nextSyncToken for delta sync
  needs_reauth boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table calendar_oauth_tokens enable row level security;
-- No policy = no client access. Service role bypasses RLS entirely.
revoke all on calendar_oauth_tokens from anon, authenticated;

-- Extra columns on calendar_connections for OAuth metadata.
alter table calendar_connections add column if not exists account_email text;
alter table calendar_connections add column if not exists needs_reauth boolean not null default false;
