// Server-only — do not import in client components.
import { getFreshGoogleToken } from "./googleTokens";
import { getServiceSupabase } from "./supabaseService";
import { matchEventToCategory } from "./categoryMatcher";
import type { Category, Task } from "./types";

const SYNC_DAYS = 90;

interface GoogleEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: "opaque" | "transparent";
}

function toBlock(event: GoogleEvent, connectionId: string, userId: string) {
  if (!event.start || !event.end) return null;
  const allDay = Boolean(event.start.date);
  return {
    user_id: userId,
    title: event.summary ?? "Busy",
    start_at: new Date(event.start.dateTime ?? `${event.start.date}T00:00:00Z`).toISOString(),
    end_at: new Date(event.end.dateTime ?? `${event.end.date}T00:00:00Z`).toISOString(),
    all_day: allDay,
    source: "google",
    external_id: event.id,
    external_calendar_id: connectionId,
    busy: event.transparency !== "transparent",
    status: "planned",
    category_id: undefined as string | undefined,
  };
}

type Block = NonNullable<ReturnType<typeof toBlock>>;

// Google Calendar's UI merges the user's own calendar with every shared and
// subscribed calendar (a university timetable, a partner's calendar, an
// "other account" calendar) into one view — but the Calendar API only
// returns events from whichever specific calendar ID you ask for. Without
// this, only the user's own default ("primary") calendar ever synced, and
// anything living on a different calendar silently never showed up.
//
// Scoped to calendars the user has actually chosen to show (`selected`) —
// matches what they see in their own Google Calendar, and avoids quietly
// pulling in a calendar they were once shared on but hid long ago.
async function fetchSelectedCalendarIds(accessToken: string): Promise<string[]> {
  const ids = new Set<string>(["primary"]);
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error(`Google calendarList error ${resp.status}`);
    const data = await resp.json();
    pageToken = data.nextPageToken as string | undefined;
    for (const cal of (data.items ?? []) as { id: string; primary?: boolean; selected?: boolean }[]) {
      if (cal.selected && !cal.primary) ids.add(cal.id);
    }
  } while (pageToken);
  return Array.from(ids);
}

// Any calendar other than "primary" — no stored incremental sync token for
// these (that's a per-connection, primary-only concept below), so every
// sync does a fresh bounded fetch and reconciles deletions itself: an event
// previously synced from this calendar, inside the same window, that didn't
// come back this time was removed or cancelled on Google's side.
async function syncSecondaryCalendar(
  sb: ReturnType<typeof getServiceSupabase>,
  calendarId: string,
  accessToken: string,
  connectionId: string,
  userId: string,
  categories: Category[],
  tasks: Task[],
  windowStart: string,
  windowEnd: string,
): Promise<{ toUpsert: Block[]; deleted: number }> {
  const toUpsert: Block[] = [];
  const seenIds = new Set<string>();
  let pageToken: string | undefined;
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: windowStart,
      timeMax: windowEnd,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const resp = await fetch(`${base}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) {
      // Don't let one inaccessible calendar (e.g. a shared calendar whose
      // owner revoked access since last sync) fail the whole sync.
      console.error(`Google calendar ${calendarId} fetch failed: ${resp.status}`);
      return { toUpsert: [], deleted: 0 };
    }

    const data = await resp.json();
    pageToken = data.nextPageToken as string | undefined;

    for (const event of (data.items ?? []) as GoogleEvent[]) {
      if (event.status === "cancelled") continue;
      // Event IDs are only unique within their own calendar — prefixing
      // guards against two different calendars on the same connection
      // coincidentally producing the same raw event ID.
      const externalId = `${calendarId}::${event.id}`;
      seenIds.add(externalId);
      const block = toBlock({ ...event, id: externalId }, connectionId, userId);
      if (block) {
        const match = matchEventToCategory(block.title, categories, tasks);
        if (match) block.category_id = match.categoryId;
        toUpsert.push(block);
      }
    }
  } while (pageToken);

  const { data: existingRows } = await sb
    .from("calendar_blocks")
    .select("external_id")
    .eq("user_id", userId)
    .eq("external_calendar_id", connectionId)
    .like("external_id", `${calendarId}::%`)
    .gte("start_at", windowStart)
    .lte("start_at", windowEnd);

  const staleIds = ((existingRows ?? []) as { external_id: string }[])
    .map((r) => r.external_id)
    .filter((id) => !seenIds.has(id));

  let deleted = 0;
  if (staleIds.length > 0) {
    await sb.from("calendar_blocks").delete().eq("external_calendar_id", connectionId).in("external_id", staleIds);
    deleted = staleIds.length;
  }

  return { toUpsert, deleted };
}

export async function runGoogleSync(connectionId: string): Promise<{ synced: number; deleted: number }> {
  const sb = getServiceSupabase();

  const { data: conn } = await sb
    .from("calendar_connections")
    .select("user_id")
    .eq("id", connectionId)
    .single();
  if (!conn) throw new Error("Connection not found");
  const userId = conn.user_id as string;

  const accessToken = await getFreshGoogleToken(connectionId);

  // Fetch user's categories and open tasks for event → category matching.
  const [{ data: catRows }, { data: taskRows }] = await Promise.all([
    sb.from("categories").select("*").eq("user_id", userId),
    sb.from("tasks").select("id, title, category_id").eq("user_id", userId).neq("status", "complete"),
  ]);
  const categories = (catRows ?? []) as Category[];
  const tasks = (taskRows ?? []) as Task[];

  const { data: tokenRow } = await sb
    .from("calendar_oauth_tokens")
    .select("sync_token")
    .eq("connection_id", connectionId)
    .single();
  const syncToken = tokenRow?.sync_token as string | null ?? null;

  // Shared window for the primary calendar's full-sync branch and every
  // secondary calendar. Starts 24h back, not the exact current moment —
  // otherwise a recurring event whose time-of-day already passed today
  // drops out of today entirely (same bug fixed in app/api/ics-sync/route.ts).
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + SYNC_DAYS * 86_400_000).toISOString();

  const toUpsert: Block[] = [];
  const toDelete: string[] = [];
  let nextSyncToken: string | null = null;
  let pageToken: string | undefined;
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  do {
    const params = new URLSearchParams({ maxResults: "250", singleEvents: "true" });
    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      params.set("timeMin", windowStart);
      params.set("timeMax", windowEnd);
      params.set("orderBy", "startTime");
    }
    if (pageToken) params.set("pageToken", pageToken);

    const resp = await fetch(`${base}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status === 410) {
      // Sync token expired — discard and run a full sync.
      await sb.from("calendar_oauth_tokens").update({ sync_token: null }).eq("connection_id", connectionId);
      return runGoogleSync(connectionId);
    }
    if (!resp.ok) throw new Error(`Google API error ${resp.status}`);

    const data = await resp.json();
    pageToken = data.nextPageToken as string | undefined;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken as string;

    for (const event of (data.items ?? []) as GoogleEvent[]) {
      if (event.status === "cancelled") {
        toDelete.push(event.id);
      } else {
        const block = toBlock(event, connectionId, userId);
        if (block) {
          const match = matchEventToCategory(block.title, categories, tasks);
          if (match) block.category_id = match.categoryId;
          toUpsert.push(block);
        }
      }
    }
  } while (pageToken);

  // Other calendars the user actually has visible — shared calendars, a
  // university timetable, another account's calendar, etc. Run in parallel;
  // one slow or inaccessible calendar shouldn't serialize the rest.
  const otherCalendarIds = (await fetchSelectedCalendarIds(accessToken)).filter((id) => id !== "primary");
  const secondaryResults = await Promise.all(
    otherCalendarIds.map((calendarId) =>
      syncSecondaryCalendar(sb, calendarId, accessToken, connectionId, userId, categories, tasks, windowStart, windowEnd),
    ),
  );
  for (const result of secondaryResults) toUpsert.push(...result.toUpsert);
  const secondaryDeleted = secondaryResults.reduce((sum, r) => sum + r.deleted, 0);

  // Google's API forbids combining timeMin/timeMax with syncToken, so once a
  // connection has a stored sync_token every later primary-calendar sync
  // call omits the date range entirely — Google then returns *any* event
  // that's changed since last sync, anywhere on the calendar, regardless of
  // date. Without this filter that pulls years-old and far-future events
  // back into a "today onward" app on every incremental sync after the
  // first. Applied to the combined set (not just the primary/incremental
  // path) so every source stays consistent.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const upcomingOnly = toUpsert.filter((b) => new Date(b.end_at).getTime() >= cutoff);

  if (upcomingOnly.length > 0) {
    // Dedup across connections: skip events that already exist from a different
    // connection with the exact same title + start + end (e.g. shared meetings
    // that appear in both of a user's Google accounts).
    const { data: existing } = await sb
      .from("calendar_blocks")
      .select("title, start_at, end_at")
      .eq("user_id", userId)
      .not("external_id", "is", null)
      .neq("external_calendar_id", connectionId);

    const existingKeys = new Set(
      (existing ?? []).map(
        (b: { title: string; start_at: string; end_at: string }) =>
          `${b.title.trim().toLowerCase()}::${b.start_at}::${b.end_at}`,
      ),
    );

    const dedupedUpsert = upcomingOnly.filter(
      (b) => !existingKeys.has(`${b.title.trim().toLowerCase()}::${b.start_at}::${b.end_at}`),
    );

    if (dedupedUpsert.length > 0) {
      const { error } = await sb.from("calendar_blocks").upsert(dedupedUpsert, {
        onConflict: "user_id,external_calendar_id,external_id",
        ignoreDuplicates: false,
      });
      if (error) throw new Error(error.message);
    }
  }

  if (toDelete.length > 0) {
    await sb.from("calendar_blocks")
      .delete()
      .eq("external_calendar_id", connectionId)
      .in("external_id", toDelete);
  }

  if (nextSyncToken) {
    await sb.from("calendar_oauth_tokens")
      .update({ sync_token: nextSyncToken, updated_at: new Date().toISOString() })
      .eq("connection_id", connectionId);
  }

  await sb.from("calendar_connections")
    .update({ last_synced_at: new Date().toISOString(), needs_reauth: false })
    .eq("id", connectionId);

  return { synced: upcomingOnly.length, deleted: toDelete.length + secondaryDeleted };
}
