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

  type Block = NonNullable<ReturnType<typeof toBlock>>;
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
      params.set("timeMin", new Date().toISOString());
      params.set("timeMax", new Date(Date.now() + SYNC_DAYS * 86_400_000).toISOString());
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
          toUpsert.push(block as Block);
        }
      }
    }
  } while (pageToken);

  if (toUpsert.length > 0) {
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

    const dedupedUpsert = toUpsert.filter(
      (b) => !existingKeys.has(`${b.title.trim().toLowerCase()}::${b.start_at}::${b.end_at}`),
    );

    if (dedupedUpsert.length > 0) {
      await sb.from("calendar_blocks").upsert(dedupedUpsert, {
        onConflict: "user_id,external_calendar_id,external_id",
        ignoreDuplicates: false,
      });
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

  return { synced: toUpsert.length, deleted: toDelete.length };
}
