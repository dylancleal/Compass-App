import type { CalendarBlock } from "@/lib/types";

function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `~${h12}${ampm}` : `~${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

// Finds the first free slot in the working day that fits durationMin.
// Scans 7am–10pm, skipping busy blocks, with a 15-min buffer.
// Returns a formatted string like "~9am" or "~5:30pm", or undefined if no gap.
export function findFreeSlot(
  blocks: CalendarBlock[],
  durationMin: number,
): string | undefined {
  const WINDOW_START = 7 * 60;  // 7am
  const WINDOW_END   = 22 * 60; // 10pm
  const BUFFER = 15;
  const needed = durationMin + BUFFER;

  const busy = blocks
    .filter((b) => !b.all_day && b.busy)
    .map((b) => ({ start: localMinutes(b.start_at), end: localMinutes(b.end_at) }))
    .sort((a, b) => a.start - b.start);

  let cursor = WINDOW_START;
  for (const { start, end } of busy) {
    if (start >= cursor + needed) return fmtMinutes(cursor);
    cursor = Math.max(cursor, end);
  }
  if (cursor + needed <= WINDOW_END) return fmtMinutes(cursor);
  return undefined;
}
