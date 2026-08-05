import { NextResponse } from "next/server";
import { async as icalAsync, expandRecurringEvent } from "node-ical";
import type { VEvent } from "node-ical";

export interface ParsedICSEvent {
  externalId: string;
  title: string;
  start_at: string; // ISO UTC
  end_at: string;   // ISO UTC
  all_day: boolean;
}

// Expand recurring events from the start of "today" through 90 days out.
// Starting from the exact current moment (rather than the start of today)
// excluded a recurring event's occurrence for today once its time-of-day
// had already passed — e.g. sync in the afternoon and a morning gym class
// looked like it "only starts next week", since next week's occurrence is
// still in the future while today's already isn't. Backing off a generous
// 24h (rather than computing an exact local midnight) covers every
// timezone without needing to know the user's — a same-day event syncing
// in as "yesterday" would be a display quirk, not a missing event.
const EXPAND_FROM = new Date(Date.now() - 24 * 60 * 60 * 1000);
const EXPAND_TO = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

function isoOf(d: Date): string {
  return d.toISOString();
}

function parseEvent(event: VEvent): ParsedICSEvent[] {
  const isAllDay = event.datetype === "date";

  if (event.rrule) {
    // Expand recurring events into individual instances.
    const instances = expandRecurringEvent(event, {
      from: EXPAND_FROM,
      to: EXPAND_TO,
      excludeExdates: true,
    });
    return instances.map((inst) => {
      const end = inst.end ?? new Date(inst.start.getTime() + (isAllDay ? 86400000 : 3600000));
      return {
        // No trailing array index — the occurrence's own start timestamp is
        // already a stable, unique key per real instance (a single VEVENT
        // can't produce two occurrences at the same instant). The index
        // used to be appended here, but EXPAND_FROM rolls forward a day at
        // a time, so instances shift position in the array between syncs
        // as earlier occurrences age out of the window — the same future
        // occurrence got a new externalId (and a new duplicate row) on
        // every sync run rather than upserting the existing one.
        externalId: `${event.uid}_${isoOf(inst.start)}`,
        title: typeof inst.summary === "string" ? inst.summary : (inst.summary?.val ?? "Event"),
        start_at: isoOf(inst.start),
        end_at: isoOf(end),
        all_day: inst.isFullDay,
      };
    });
  }

  if (!event.start) return [];
  const end = event.end ?? new Date(event.start.getTime() + (isAllDay ? 86400000 : 3600000));
  const title = typeof event.summary === "string" ? event.summary : (event.summary?.val ?? "Event");
  return [{
    externalId: event.uid,
    title,
    start_at: isoOf(event.start),
    end_at: isoOf(end),
    all_day: isAllDay,
  }];
}

export async function POST(request: Request) {
  let url: string;
  let provider: string;
  let connectionId: string;

  try {
    const body = await request.json();
    url = body.url;
    provider = body.provider ?? "ics";
    connectionId = body.connectionId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!url || !connectionId) {
    return NextResponse.json({ error: "url and connectionId are required" }, { status: 400 });
  }

  let cal: Awaited<ReturnType<typeof icalAsync.parseICS>>;
  try {
    // Fetch the ICS content on the server (bypasses browser CORS).
    const res = await fetch(url, {
      headers: { "User-Agent": "Compass-Calendar/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch calendar: ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }
    const text = await res.text();
    cal = await icalAsync.parseICS(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not reach calendar URL: ${msg}` }, { status: 502 });
  }

  const events: ParsedICSEvent[] = [];
  for (const component of Object.values(cal)) {
    if (!component || component.type !== "VEVENT") continue;
    try {
      events.push(...parseEvent(component as VEvent));
    } catch {
      // Skip unparseable events rather than failing the whole sync.
    }
  }

  return NextResponse.json({ events, provider, connectionId });
}
