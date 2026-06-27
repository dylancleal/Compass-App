// Calendar scheduling — pure, I/O-free interval logic (Phase 1).
//
// Finds free time around fixed commitments and places intentions (planner
// suggestions, manual blocks) without overlaps. Works in epoch milliseconds;
// converts to/from ISO only at the boundaries. Fully unit-testable.
//
// See docs/calendar-phase1-spec.md §5 for the design rationale.

import type { CalendarBlock } from "@/lib/types";

export interface Interval {
  start: number;
  end: number;
} // epoch ms

const MIN = 60_000;

export function toInterval(b: Pick<CalendarBlock, "start_at" | "end_at">): Interval {
  return { start: Date.parse(b.start_at), end: Date.parse(b.end_at) };
}

// Merge overlapping/adjacent intervals into a minimal disjoint set.
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

// Free gaps inside `window` given busy intervals.
export function freeGaps(busy: Interval[], window: Interval): Interval[] {
  const merged = mergeIntervals(
    busy.filter((b) => b.end > window.start && b.start < window.end),
  );
  const gaps: Interval[] = [];
  let cursor = window.start;
  for (const b of merged) {
    const s = Math.max(b.start, window.start);
    if (s > cursor) gaps.push({ start: cursor, end: s });
    cursor = Math.max(cursor, Math.min(b.end, window.end));
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps;
}

export interface SlotOptions {
  durationMs: number;
  bufferMs?: number; // breathing room left on each side of the block
  notBefore?: number; // earliest acceptable start (e.g. Date.now())
  notAfter?: number; // latest acceptable end (e.g. a deadline instant)
  prefer?: "earliest" | "latest";
}

// First/best gap that fits the duration + buffers within constraints.
export function findSlot(gaps: Interval[], opts: SlotOptions): Interval | null {
  const buffer = opts.bufferMs ?? 0;
  const candidates: Interval[] = [];
  for (const g of gaps) {
    const lo = Math.max(g.start, opts.notBefore ?? g.start) + buffer;
    const hi = Math.min(g.end, opts.notAfter ?? g.end) - buffer;
    if (hi - lo >= opts.durationMs) {
      const start = opts.prefer === "latest" ? hi - opts.durationMs : lo;
      candidates.push({ start, end: start + opts.durationMs });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    opts.prefer === "latest" ? b.start - a.start : a.start - b.start,
  );
  return candidates[0];
}

export interface DayWindow {
  startHour: number;
  endHour: number;
} // local hours

// Epoch window for a local day key with working hours. Local Date ctor => DST-safe.
export function dayWindowFor(dayKey: string, win: DayWindow): Interval {
  const [y, m, d] = dayKey.split("-").map(Number);
  return {
    start: new Date(y, m - 1, d, win.startHour, 0, 0, 0).getTime(),
    end: new Date(y, m - 1, d, win.endHour, 0, 0, 0).getTime(),
  };
}

export interface Intention {
  id: string;
  title: string;
  durationMin: number;
  category_id?: string;
  task_id?: string;
  prefer?: "earliest" | "latest";
  notAfter?: number; // deadline instant, if any
}

export interface PlacedIntention extends Intention {
  start_at: string;
  end_at: string;
}

// Greedy first-fit: place each intention into the day's free gaps, reserving
// each placement so later intentions avoid it. Returns what didn't fit.
export function placeIntentions(
  intentions: Intention[],
  existing: CalendarBlock[],
  day: Interval,
  opts: { bufferMin?: number; notBefore?: number } = {},
): { placed: PlacedIntention[]; unplaced: Intention[] } {
  const buffer = (opts.bufferMin ?? 10) * MIN;
  const busy = existing.filter((b) => b.busy).map(toInterval);
  const placed: PlacedIntention[] = [];
  const unplaced: Intention[] = [];

  for (const it of intentions) {
    const slot = findSlot(freeGaps(busy, day), {
      durationMs: it.durationMin * MIN,
      bufferMs: buffer,
      notBefore: opts.notBefore,
      notAfter: it.notAfter,
      prefer: it.prefer,
    });
    if (!slot) {
      unplaced.push(it);
      continue;
    }
    placed.push({
      ...it,
      start_at: new Date(slot.start).toISOString(),
      end_at: new Date(slot.end).toISOString(),
    });
    busy.push(slot); // reserve so the next intention routes around it
  }
  return { placed, unplaced };
}

// Manual-add nudge: which existing busy blocks does this candidate overlap?
// Half-open test: a block ending at 14:00 does not conflict with one starting at 14:00.
export function conflicts(
  candidate: Pick<CalendarBlock, "start_at" | "end_at">,
  others: CalendarBlock[],
): CalendarBlock[] {
  const c = toInterval(candidate);
  return others
    .filter((o) => o.busy)
    .filter((o) => {
      const i = toInterval(o);
      return i.start < c.end && c.start < i.end;
    });
}

// Finds all pairs of busy, non-all-day, non-ghost blocks that overlap in time.
// Used to surface scheduling conflicts in the calendar UI.
export function findConflictPairs(blocks: CalendarBlock[]): [CalendarBlock, CalendarBlock][] {
  const pairs: [CalendarBlock, CalendarBlock][] = [];
  const busy = blocks.filter(
    (b) => b.busy && !b.all_day && !(b.source === "compass" && b.status === "planned"),
  );
  const sorted = [...busy].sort((a, b) => a.start_at.localeCompare(b.start_at));

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.start_at >= a.end_at) break;
      pairs.push([a, b]);
    }
  }
  return pairs;
}

// View helper: where a block sits within a rendered day column (percentages).
export function blockBox(b: CalendarBlock, day: Interval): { topPct: number; heightPct: number } {
  const s = Date.parse(b.start_at);
  const e = Date.parse(b.end_at);
  const span = day.end - day.start;
  return {
    topPct: ((Math.max(s, day.start) - day.start) / span) * 100,
    heightPct: ((Math.min(e, day.end) - Math.max(s, day.start)) / span) * 100,
  };
}
