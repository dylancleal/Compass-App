# Calendar — Phase 3 architecture spec (Google + Microsoft OAuth sync)

**Status:** architecture only (Phase 3a). No code, no credentials. This document
makes the hard decisions so a later Sonnet session can implement 3b+ against a
settled design.

**What Phase 3 adds over Phase 2.** Phase 2 reads a calendar from a *secret ICS
URL* the user pastes in — one-way, read-only, no auth, refreshed by re-fetching
the whole feed. Phase 3 connects the user's Google / Microsoft account directly
via OAuth, which buys us: no fragile secret URLs, access to *all* of a user's
calendars, **incremental (delta) sync** instead of full re-downloads, reliable
event deletions, and — optionally — **two-way write-back** of Compass intentions.

**Credentials warning (read before 3b).** Implementing this needs OAuth client
credentials created in the user's own Google Cloud Console and Azure portals,
plus server secrets. That touches the user's accounts. **Per the standing
guardrail, do not begin 3b/3c until the user explicitly hands over or creates
those credentials.** §10 lists exactly what's needed.

---

## 1. The three constraints that drive every decision

Everything below follows from these. Read them first.

1. **A refresh token is a long-lived secret that grants ongoing access to the
   user's calendar.** It must never reach the browser, never sit in
   `localStorage`, never be exposed through a `NEXT_PUBLIC_*` var or a
   PostgREST-readable column. It lives server-side, encrypted, and is used only
   inside Next.js Route Handlers.

2. **OAuth requires a server.** Token exchange uses the OAuth *client secret*;
   token storage must be persistent and secure. The browser-only LocalDB mode
   has neither. **Therefore OAuth calendar sync is a cloud-mode-only feature**
   (`isSupabaseConfigured() === true`). In local mode we keep Phase 2 ICS only
   and disable the Google/Microsoft connect buttons with a "needs cloud sync"
   note. See §9.

3. **Access tokens are short-lived (~1 hour); refresh tokens are durable.** Any
   sync path must transparently refresh an expired access token from the stored
   refresh token before calling the provider API. This refresh is the heartbeat
   of the whole system.

---

## 2. Decision: dedicated OAuth flow, not Supabase Auth as broker

There are two ways to get provider tokens. We pick the second.

**Option A — Supabase Auth as the OAuth broker (rejected).** Supabase Auth has
Google and Azure providers; signing in with extra scopes returns
`provider_token` + `provider_refresh_token` in the session. Rejected because:

- Supabase **does not persist or refresh** the provider token — it hands it to
  you once at sign-in and washes its hands. We'd have to store and refresh it
  ourselves anyway, so the "free" part isn't the hard part.
- It **conflates app login with calendar authorization.** Compass already logs
  in by email. Bolting calendar scopes onto login forces re-consent on every
  login and means "disconnect calendar" can't be separated from "sign out."
- It doesn't cleanly support **multiple calendar accounts** (e.g. a personal +
  a uni Google account) for one Compass user.

**Option B — Compass owns a dedicated OAuth flow (chosen).** Compass runs its
own OAuth 2.0 Authorization-Code-with-PKCE flow per provider, entirely separate
from app login. This decouples "who you are" from "what calendars you've
linked," supports multiple accounts per user, lets us request `offline_access`
explicitly, and keeps all token handling in our own server routes where we
control storage and refresh. This is the standard pattern for an app that
integrates calendars as a *feature* rather than as its identity provider.

---

## 3. The OAuth flow, end to end

Two new Route Handlers per the App Router (these run server-side only):

```
app/api/calendar/oauth/[provider]/start/route.ts     GET  → 302 to consent
app/api/calendar/oauth/[provider]/callback/route.ts  GET  ← provider redirect
```

`[provider]` ∈ `google | microsoft`. Flow:

1. **Start.** User clicks "Connect Google" in the connections UI → browser hits
   `/start`. The handler:
   - Confirms an authenticated Supabase user (we need a `user_id` to attach the
     connection to). Reject anonymous/local mode.
   - Generates a **PKCE** `code_verifier` (store server-side, keyed to a `state`
     nonce) and its `code_challenge`.
   - Generates a `state` value (CSRF defence) binding the request to this user.
     Store `{ state → (user_id, code_verifier, provider, return_to) }` with a
     short TTL — a `oauth_pending` table or a signed, httpOnly, short-lived
     cookie. A signed cookie is simplest and needs no table.
   - Redirects (302) to the provider's authorization endpoint with:
     `client_id`, `redirect_uri`, `response_type=code`, `scope` (§ per provider),
     `state`, `code_challenge`, `code_challenge_method=S256`, and the
     offline/refresh-token flags (Google: `access_type=offline&prompt=consent`;
     Microsoft: include `offline_access` in scope).

2. **Consent.** The user approves on Google/Microsoft. Provider redirects back
   to `/callback?code=…&state=…`.

3. **Callback.** The handler:
   - Validates `state` against the stored value (reject on mismatch → CSRF).
   - Recovers `code_verifier` and `user_id`.
   - **Exchanges** `code` + `code_verifier` + `client_secret` at the provider's
     token endpoint (server-to-server `fetch`) → `{ access_token, refresh_token,
     expires_in, scope }`. Microsoft also returns an `id_token` we can decode
     for the account email; Google we can hit the userinfo endpoint or read the
     `id_token`.
   - **Persists** an encrypted token row + a `calendar_connections` row (§5/§7).
   - Kicks off an initial **full sync** (§6) so the user immediately sees events.
   - Redirects back to `return_to` (the settings or calendar page) with a success
     flag.

**Redirect URIs** must be registered with each provider for every origin:
`http://localhost:3000/api/calendar/oauth/google/callback` (dev) and the Vercel
production URL equivalent, ×2 providers. Drive the base from
`OAUTH_REDIRECT_BASE_URL` so dev/preview/prod differ only by env.

### Scopes (start read-only)

| Provider | Read-only scope | Write (Phase 3d) | Refresh-token flag |
|---|---|---|---|
| Google | `https://www.googleapis.com/auth/calendar.readonly` | `…/auth/calendar.events` | `access_type=offline` + `prompt=consent` |
| Microsoft | `Calendars.Read` | `Calendars.ReadWrite` | `offline_access` (always include) |

Request the *minimum* scope for the phase. Upgrading read→write later means a
re-consent, which is fine and expected.

---

## 4. Token lifecycle — the heartbeat

A single server helper, `getFreshAccessToken(connectionId)`, is the only thing
that ever reads a refresh token. Every sync call goes through it.

```
getFreshAccessToken(connectionId):
  row = load token row via SERVICE ROLE   # never anon key
  if row.access_token_expires_at > now + 60s:
      return decrypt(row.access_token)
  # expired or near-expiry → refresh
  resp = POST provider token endpoint {grant_type: refresh_token,
         refresh_token: decrypt(row.refresh_token), client_id, client_secret}
  store encrypt(resp.access_token), expires_at = now + resp.expires_in
  if resp.refresh_token:                  # Google sometimes rotates; MS rotates
      store encrypt(resp.refresh_token)
  return resp.access_token
```

Failure handling:
- **`invalid_grant` on refresh** = the user revoked access or the refresh token
  expired. Mark the connection `enabled = false`, set a `needs_reauth` flag, and
  surface a "Reconnect" button in the UI. Never silently retry forever.
- Microsoft rotates refresh tokens on every refresh — **always persist the new
  one**. Google usually keeps the same refresh token but returns a new one
  occasionally — persist when present.

---

## 5. Token storage & security model

Tokens do **not** go in `calendar_connections` (that table is read by the
browser via the anon key + RLS). They go in a **separate table the client role
cannot read at all.**

```sql
-- supabase/calendar-oauth.sql   (Phase 3b — run after calendar.sql)

create table if not exists calendar_oauth_tokens (
  connection_id uuid primary key
    references calendar_connections(id) on delete cascade,
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,            -- encrypted (see below)
  refresh_token text not null,           -- encrypted
  access_token_expires_at timestamptz not null,
  scope text,
  account_email text,
  sync_token text,                       -- Google: nextSyncToken
  delta_link text,                       -- Microsoft: @odata.deltaLink
  needs_reauth boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table calendar_oauth_tokens enable row level security;
-- NO policy granting the anon/authenticated role access. With RLS on and no
-- policy, PostgREST returns nothing to the client. Only the SERVICE ROLE key
-- (used exclusively in server route handlers) bypasses RLS and can touch this.
revoke all on calendar_oauth_tokens from anon, authenticated;
```

**Encryption at rest.** Two acceptable options:
- **App-layer AES-GCM** with a key in `TOKEN_ENCRYPTION_KEY` (server env). Encrypt
  before insert, decrypt after select, in the route handler. Simple, portable,
  no Postgres extension needed. **Recommended for this app.**
- **Supabase Vault** (`pgsodium`) — store secrets in the vault and reference by
  id. More moving parts; only worth it if we outgrow app-layer crypto.

Either way the **`SUPABASE_SERVICE_ROLE_KEY`** is what lets the server read this
table; it is a server-only secret and must never be `NEXT_PUBLIC_*`.

---

## 6. The sync engine — delta, not full re-download

This is the real payoff over ICS. One server route:

```
app/api/calendar/sync/route.ts   POST { connectionId }  (auth required)
```

It: loads the connection, `getFreshAccessToken`, runs a provider-specific delta
sync, maps results to `CalendarBlock`s, and writes them — **including
deletions**, which ICS never gave us.

### Google Calendar — `syncToken`

- Endpoint: `GET /calendar/v3/calendars/{calendarId}/events`.
- **First sync:** no `syncToken`; page through with `timeMin`/`timeMax`
  (e.g. now → +90d to match Phase 2's horizon) following `nextPageToken`.
  The final page returns `nextSyncToken` → persist it.
- **Incremental:** pass `syncToken=<saved>`. The API returns only events changed
  since last sync. Cancelled events come back with `status: "cancelled"` → delete
  the matching block. Persist the new `nextSyncToken`.
- **`410 GONE`** = the sync token expired → discard it and do a full resync.

### Microsoft Graph — delta query

- Endpoint: `GET /me/calendars/{id}/events/delta` (or `/me/calendarview/delta`
  for a bounded window — preferred, mirrors Google's `timeMin/Max`).
- **First sync:** follow `@odata.nextLink` pages; the last page yields
  `@odata.deltaLink` → persist it.
- **Incremental:** GET the saved `deltaLink`; returns only changes. Deleted
  events appear with an `@removed` annotation → delete the matching block.
  Persist the new `deltaLink`.

### Mapping provider event → `CalendarBlock`

| Block field | Google | Microsoft |
|---|---|---|
| `external_id` | event `id` | event `id` |
| `external_calendar_id` | the **connection id** (as today) | connection id |
| `title` | `summary` | `subject` |
| `start_at` / `end_at` | `start.dateTime`→UTC ISO (or `start.date` if all-day) | `start.dateTime`+`start.timeZone`→UTC | 
| `all_day` | `start.date` present | `isAllDay` |
| `busy` | `transparency !== "transparent"` | `showAs ∈ {busy,oof,tentative}` |
| `source` | `"google"` | `"microsoft"` |
| `status` | `"planned"` | `"planned"` |

`CalendarSource` already includes `google`/`microsoft` (added in Phase 1), so no
type change there.

### Required data-layer change: deletions

Phase 2's `syncCalendarBlocks(blocks, connectionId)` only inserts/replaces — it
has **no deletion path**, because an ICS feed is always the full current truth.
Delta sync reports *cancellations*, so the data layer needs to remove them. Add:

```ts
// lib/db/types.ts
removeExternalBlocks(connectionId: string, externalIds: string[]): Promise<void>;
```

Implement in both `LocalDB` (filter the array) and `SupabaseDB` (delete where
`external_calendar_id = connectionId and external_id in (...)`). The sync route
collects cancelled ids per run and calls it. Keep `syncCalendarBlocks` for the
upsert path unchanged.

---

## 7. `calendar_connections` changes

Small additions to the existing table (Phase 3b migration):

```sql
alter table calendar_connections add column if not exists account_email text;
alter table calendar_connections add column if not exists read_only boolean not null default true;
-- ics_url stays nullable; for OAuth connections it's simply null.
```

`CalendarConnection` TS type gains `account_email?: string` and
`read_only?: boolean`. The `provider` union already allows `google`/`microsoft`.
The connections UI already renders provider icons and a sync button — it needs
only: (a) "Connect Google/Microsoft" entries that hit `/start` instead of asking
for an ICS URL, and (b) a "Reconnect" affordance when `needs_reauth` is set.

---

## 8. How sync is triggered

- **Now (3b/3c): on-demand.** Same UX as Phase 2 — the client calls
  `/api/calendar/sync` on calendar-page load when a connection is stale
  (>30 min), and on a manual "Sync" press. The difference is the work happens
  server-side with delta tokens, so it's cheap and fast after the first run.
- **Later (3e, optional): push + scheduled.**
  - *Webhooks:* Google `events.watch` channels and Microsoft Graph
    subscriptions push change notifications to a public callback. These expire
    (Graph ≤ ~3 days) and need renewal — requires a cron and a public URL.
  - *Cron:* a Vercel Cron route that iterates connections and runs delta sync,
    so the calendar is fresh even without an open tab.
  Defer both until on-demand is proven solid; they add a callback endpoint, a
  renewal job, and subscription bookkeeping.

---

## 9. Local-first degradation (constraint #2 in practice)

- OAuth connect buttons are **disabled in local mode** with a one-line note:
  "Connecting Google or Microsoft needs cloud sync — add Supabase keys (see
  README)." ICS paste-a-URL stays available in both modes.
- The `/api/calendar/*` OAuth + sync routes **hard-require** an authenticated
  Supabase user and the service-role env; they return 400/401 otherwise rather
  than half-working.
- This keeps the "runs with zero credentials" promise intact: local mode loses
  *account* sync, not the calendar itself.

---

## 10. Provider setup checklist — the credentials the user must create

**⚠️ Guardrail: every item here lives in the user's own accounts. Do not start
3b until the user has created these and provided the values (or done it
alongside us with their explicit go-ahead).**

**Google (for 3b):**
1. Google Cloud Console → new (or existing) project.
2. APIs & Services → enable **Google Calendar API**.
3. OAuth consent screen → **External**, **Testing** mode, add the user's own
   Google address as a *test user*. (Testing mode avoids Google's verification
   review — fine for personal/single-user. Going public with the sensitive
   `calendar` scope would trigger verification and possibly a security
   assessment; we stay in testing.)
4. Credentials → OAuth client ID → **Web application** → register the dev +
   prod redirect URIs (§3). Copy **client ID + client secret**.

**Microsoft (for 3c):**
1. Azure portal → Microsoft Entra ID → **App registrations** → new registration.
2. Supported account types: "personal Microsoft accounts" (and/or work/school as
   needed).
3. Add **Web** redirect URIs (§3).
4. API permissions → Microsoft Graph → **delegated** → `Calendars.Read` +
   `offline_access`.
5. Certificates & secrets → new **client secret**. Copy **application (client)
   ID + secret**.

**Server env vars (Vercel + `.env.local`), all server-only — never `NEXT_PUBLIC`:**

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
MS_OAUTH_CLIENT_ID=
MS_OAUTH_CLIENT_SECRET=
OAUTH_REDIRECT_BASE_URL=      # e.g. https://compass.vercel.app
TOKEN_ENCRYPTION_KEY=         # 32-byte key for AES-GCM
SUPABASE_SERVICE_ROLE_KEY=    # already exists in Supabase project settings
```

---

## 11. Two-way write-back (Phase 3d — deferred, design sketch only)

If/when we push Compass *intentions* out to the provider:

- Write only to a **single dedicated "Compass" calendar** created via the API,
  never the user's primary calendar. Keeps the user's space clean and makes
  "disconnect → delete everything we created" trivial.
- Store the provider event id back on the block (`external_id`) so edits/deletes
  map both ways.
- **Source-of-truth rule:** the provider owns imported events; Compass owns
  blocks with `source ∈ {compass, manual}`. A block is pushed out only if its
  source is Compass-owned. Never let a sync turn an imported event into a pushed
  one (would create echo loops).
- Needs the write scopes in §3 (re-consent).

---

## 12. Phasing & model recommendation

| Phase | Deliverable | Needs creds | Model |
|---|---|---|---|
| **3a** | This architecture spec | no | Opus (done) |
| **3b** | Google read-only: OAuth routes, token storage + crypto, `syncToken` delta sync, deletions, UI connect/reconnect | **yes (Google)** | Sonnet |
| **3c** | Microsoft read-only: reuse 3b skeleton, Graph delta sync | **yes (Azure)** | Sonnet |
| **3d** | Two-way write-back to a dedicated calendar (optional) | yes (write scopes) | Sonnet, Opus to review the conflict model |
| **3e** | Background sync: webhooks + Vercel Cron (optional) | no new accounts | Sonnet |

Recommended order: **3b end-to-end first** (it builds the entire reusable
skeleton — flow, token table, crypto helper, refresh heartbeat, sync route,
deletion path, UI). 3c then becomes a focused "add the Microsoft adapter" task.

---

## 13. Open questions to settle before 3b

1. **Multiple calendars per account.** Google/MS accounts often have several
   calendars (personal, holidays, shared). Do we sync all, or let the user pick
   a subset? Picking a subset means listing calendars post-connect and storing
   selected ids — a small UI + a `calendar_ids` column. Simplest v1: sync the
   **primary** calendar only; add multi-select later.
2. **Sync horizon.** Phase 2 uses now → +90 days. Keep it, or also pull a little
   history (e.g. −7 days) so the agenda's recent context is complete?
3. **`pending_oauth` storage.** Signed httpOnly cookie (no table) vs a short-TTL
   table. Cookie is simpler and stateless — recommended unless we hit size
   limits with the PKCE verifier (we won't).
4. **One Compass user, multiple provider accounts.** The data model supports it
   (one `calendar_connections` row each). Confirm the UI should allow "Connect
   another Google account."
