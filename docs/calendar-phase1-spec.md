# Calendar — Phase 1 implementation spec

**Scope:** an internal calendar (no external account sync). Add scheduled time
blocks, a week/day/agenda view, quick-add, a deadline rail from existing tasks,
and smart placement that avoids overlaps — all wired into the existing planner.

**Out of scope (later phases):** ICS read-only sync (Phase 2) and Google /
Microsoft OAuth two-way sync (Phase 3). We *do* create the `calendar_connections`
table now so Phase 2 is just a sync function, but no network/auth code yet.

**Credentials:** Phase 1 needs none. Phases 2–3 touch the user's accounts
(ICS secret URLs, then OAuth dev credentials) — do not start those without
explicit go-ahead.

This spec is written to hand to a Sonnet session. The hard parts (data model,
SQL, scheduling algorithm) are fully specified here; the UI is a component
breakdown to build against the existing Eucalyptus design system.

---

## 1. The conceptual model — three layers of time

Compass deals with three different kinds of time. The calendar overlays them.

| Layer | Entity | Behaviour |
|---|---|---|
| **Deadlines** — when something is *due* | existing `Task.due_date` | rendered as markers/pills, never as blocks |
| **Commitments** — *immovable* busy time | `CalendarBlock` with `busy = true` (manual or, later, synced) | block out time; the scheduler routes around them |
| **Intentions** — time you *choose* to spend | `CalendarBlock` with `source = "compass"` / `"manual"` | the thing the planner places into free gaps |

### Why a new entity (CalendarBlock) and not reuse Task/Session

- **`Task`** = a to-do with a deadline. Forward-looking, *un-timed*. Unchanged.
- **`Session`** = a logged, *completed* activity (past tense). It is the single
  source of truth for stats/trends. Unchanged.
- **`CalendarBlock`** = a *planned span of time* (has start + end). New.

Relationship rules:

- A block MAY link a `task_id` (it advances that task) and/or a `category_id`.
- When a block is marked **done**, optionally spawn a `Session` (the historical
  record) so trends keep working off one source. Blocks stay forward-looking;
  sessions stay backward-looking. **No stat is ever computed from blocks** —
  this is the rule that prevents double-counting.
- Imported/external events (Phase 2) are blocks with `source != manual/compass`
  and `busy = true`; they never become sessions.

---

## 2. Types — add to `lib/types.ts`

```ts
export type CalendarSource = "manual" | "compass" | "google" | "microsoft" | "apple";
export type BlockStatus = "planned" | "done" | "skipped";

export interface CalendarBlock {
  id: ID;
  category_id?: ID;          // null for external imports
  task_id?: ID;              // block advances this task
  title: string;
  start_at: string;          // ISO datetime (UTC instant) — see Timezone note
  end_at: string;            // ISO datetime
  all_day?: boolean;
  source: CalendarSource;
  external_id?: string;       // provider event id (dedupe key, Phase 2)
  external_calendar_id?: string;
  busy: boolean;             // true = counts against free time
  status: BlockStatus;
  notes?: string;
  created_at: string;
}

export interface CalendarConnection {
  id: ID;
  provider: "google" | "microsoft" | "apple" | "ics";
  label: string;
  ics_url?: string;          // Phase 2
  color?: string;
  enabled: boolean;
  last_synced_at?: string;
  created_at: string;
}
```

### Timezone note (read this — it is the #1 source of calendar bugs)

- Store instants as `timestamptz` in Postgres and as ISO strings in TS
  (`start_at` / `end_at`). One absolute instant, no wall-clock ambiguity.
- Render in the browser's local time. Build local-day windows with the
  **local `Date` constructor** (`new Date(y, m-1, d, hour)`) so DST is handled
  by the platform — see `dayWindowFor` in §5.
- The existing `lib/date.ts` works in local `yyyy-mm-dd` "day keys" for
  all-day concepts (tasks, sessions). Blocks need real instants, so they use
  ISO datetimes. To group blocks by day for rendering, derive the day key from
  the local date: `todayKey(new Date(block.start_at))`.
- **Column naming:** `end` is a reserved word in SQL, so the DB columns are
  `start_at` / `end_at` and the TS fields match. No aliasing needed.

---

## 3. SQL migration — `supabase/calendar.sql`

Matches the existing `schema.sql` conventions exactly (`compass_uid()` default,
per-user RLS).

```sql
-- Calendar (Phase 1). Run in the Supabase SQL editor after schema.sql.

create table if not exists calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'manual',
  external_id text,
  external_calendar_id text,
  busy boolean not null default true,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default compass_uid() references auth.users(id) on delete cascade,
  provider text not null,
  label text not null,
  ics_url text,
  color text,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Dedupe imported events per source calendar (Phase 2 upserts rely on this).
create unique index if not exists calendar_blocks_external_uq
  on calendar_blocks (user_id, external_calendar_id, external_id)
  where external_id is not null;

-- Fast range queries for a visible week/day.
create index if not exists calendar_blocks_range_idx
  on calendar_blocks (user_id, start_at);

-- RLS: same own-rows policy as every other table.
do $$
declare t text;
begin
  foreach t in array array['calendar_blocks','calendar_connections'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
```

---

## 4. Data layer

### 4a. `CompassDB` interface (`lib/db/types.ts`)

```ts
// calendar blocks
listCalendarBlocks(rangeStart: string, rangeEnd: string): Promise<CalendarBlock[]>;
createCalendarBlock(input: Omit<CalendarBlock, "id" | "created_at">): Promise<CalendarBlock>;
updateCalendarBlock(id: string, patch: Partial<CalendarBlock>): Promise<CalendarBlock>;
removeCalendarBlock(id: string): Promise<void>;

// calendar connections (CRUD now; sync is Phase 2)
listCalendarConnections(): Promise<CalendarConnection[]>;
createCalendarConnection(input: Omit<CalendarConnection, "id" | "created_at">): Promise<CalendarConnection>;
updateCalendarConnection(id: string, patch: Partial<CalendarConnection>): Promise<CalendarConnection>;
removeCalendarConnection(id: string): Promise<void>;
```

### 4b. SupabaseDB (`lib/db/supabase.ts`) — same style as existing methods

```ts
async listCalendarBlocks(rangeStart: string, rangeEnd: string): Promise<CalendarBlock[]> {
  const { data } = await sb()
    .from("calendar_blocks")
    .select("*")
    .gte("start_at", rangeStart)
    .lte("start_at", rangeEnd)
    .order("start_at");
  return (data ?? []) as CalendarBlock[];
}
async createCalendarBlock(input: Omit<CalendarBlock, "id" | "created_at">): Promise<CalendarBlock> {
  const { data } = await sb().from("calendar_blocks").insert(input).select().single();
  return data as CalendarBlock;
}
async updateCalendarBlock(id: string, patch: Partial<CalendarBlock>): Promise<CalendarBlock> {
  const { data } = await sb().from("calendar_blocks").update(patch).eq("id", id).select().single();
  return data as CalendarBlock;
}
async removeCalendarBlock(id: string): Promise<void> {
  await sb().from("calendar_blocks").delete().eq("id", id);
}
// connections: identical shape against "calendar_connections"
```

### 4c. LocalDB (`lib/db/local.ts`)

Mirror the existing localStorage array pattern: a `calendar_blocks` key holding
`CalendarBlock[]`, filter by range in `listCalendarBlocks`, push/splice for
create/update/remove, `uid()` for ids, `new Date().toISOString()` for
`created_at`. Same for connections. (Keeps the app runnable with no backend.)

### 4d. React Query hooks (`lib/queries.ts`)

```ts
// keys: add  calendarBlocks: ["calendarBlocks"],  calendarConnections: ["calendarConnections"]

export const useCalendarBlocks = (rangeStart: string, rangeEnd: string) =>
  useQuery({
    queryKey: [...keys.calendarBlocks, rangeStart, rangeEnd],
    queryFn: () => db.listCalendarBlocks(rangeStart, rangeEnd),
  });

export const useCreateCalendarBlock = () =>
  useInvalidatingMutation(
    (i: Omit<CalendarBlock, "id" | "created_at">) => db.createCalendarBlock(i),
    [keys.calendarBlocks],
  );
export const useUpdateCalendarBlock = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<CalendarBlock> }) => db.updateCalendarBlock(a.id, a.patch),
    [keys.calendarBlocks],
  );
export const useRemoveCalendarBlock = () =>
  useInvalidatingMutation((id: string) => db.removeCalendarBlock(id), [keys.calendarBlocks]);
// connections: same pattern, invalidate [keys.calendarConnections]
```

---

## 5. The scheduling algorithm — new file `lib/schedule.ts`

This is the core of the feature and the part to get right. Pure functions,
no I/O, fully unit-testable. Works in epoch milliseconds; converts to/from ISO
only at the boundary.

```ts
import type { CalendarBlock } from "@/lib/types";

export interface Interval { start: number; end: number } // epoch ms

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
  bufferMs?: number;      // breathing room left on each side of the block
  notBefore?: number;     // earliest acceptable start (e.g. Date.now())
  notAfter?: number;      // latest acceptable end (e.g. a deadline instant)
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

export interface DayWindow { startHour: number; endHour: number } // local hours

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
  notAfter?: number;     // deadline instant, if any
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
    if (!slot) { unplaced.push(it); continue; }
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
export function conflicts(
  candidate: Pick<CalendarBlock, "start_at" | "end_at">,
  others: CalendarBlock[],
): CalendarBlock[] {
  const c = toInterval(candidate);
  return others
    .filter((o) => o.busy)
    .filter((o) => {
      const i = toInterval(o);
      return i.start < c.end && c.start < i.end; // half-open overlap test
    });
}
```

### Sanity checks to write as tests

- `mergeIntervals` merges `[9–10, 9:30–11]` → `[9–11]`; leaves disjoint alone.
- `freeGaps` of one 12–13 busy in a 9–17 window → `[9–12, 13–17]`.
- `findSlot` respects `notAfter` (won't place a 60-min block ending after a deadline).
- `placeIntentions` of two 50-min blocks into a day with a single 12–15 commitment
  places both without overlap and leaves the buffer.
- `conflicts` flags an exact-overlap and an edge-touch is **not** a conflict
  (half-open intervals: a block ending at 14:00 doesn't conflict with one
  starting at 14:00).

---

## 6. Planner integration

Reuse the existing engine; don't duplicate logic. `buildPlan` already produces
`DraftSuggestion[]` with `est_minutes` and `category_id`. Add a thin adapter
(put it in the calendar feature, e.g. `lib/calendarPlan.ts`):

```ts
// Convert planner suggestions into schedulable intentions, then place them.
// Deadline-urgent study leans earliest and carries the deadline as notAfter.
function suggestionsToIntentions(
  suggestions: DraftSuggestion[],
  tasks: Task[],
): Intention[] {
  return suggestions
    .filter((s) => (s.est_minutes ?? 0) > 0) // skip affirmations / rest notes
    .map((s) => {
      const task = tasks.find(
        (t) => t.category_id === s.category_id && t.status !== "complete" && t.due_date,
      );
      return {
        id: crypto.randomUUID(),
        title: s.text.split("\n")[0],
        durationMin: s.est_minutes ?? 30,
        category_id: s.category_id,
        task_id: task?.id,
        prefer: "earliest" as const,
        notAfter: task?.due_date
          ? new Date(`${task.due_date}T23:59:59`).getTime()
          : undefined,
      };
    });
}
```

Then: `placeIntentions(intentions, todaysBlocks, dayWindowFor(today, { startHour: 8, endHour: 21 }), { notBefore: Date.now() })`.

**Do not auto-write placements.** Render them as confirmable "ghost" blocks
(see §7) so the user accepts/drags them. This keeps the affirming, low-friction
tone — Compass proposes, the user decides. On confirm →
`createCalendarBlock({ source: "compass", busy: true, status: "planned", ... })`.

Working hours can later come from settings; hardcode `{ startHour: 8, endHour: 21 }`
for v1 (and optionally add a `workingHours` field to `AppSettings` if time allows).

---

## 7. UI — component breakdown (build on the Eucalyptus system)

All colors come from `accentOf(category.color)` and the `--*` CSS tokens. No new
palette. Reuse `Sheet`, `Button`, `Pill` from `components/ui.tsx`.

- **`app/calendar/page.tsx`** — view switcher (`Week` default · `Day` · `Agenda`),
  current date-range state, fetches `useCalendarBlocks(rangeStart, rangeEnd)` and
  `useTasks()`. Mobile default view = `Agenda`. Wrap any `useSearchParams` usage
  in `<Suspense>` (same rule the Trends page already follows).
- **`components/calendar/WeekGrid.tsx`** — the hero. CSS grid: a time axis column
  + N day columns, each `position: relative`. Blocks are
  `position: absolute` children positioned by:
  ```
  topPct    = (start - dayStart) / (dayEnd - dayStart) * 100
  heightPct = (end   - start)    / (dayEnd - dayStart) * 100
  ```
  Drag to move (update `start_at`/`end_at`), drag bottom edge to resize. On drop,
  call `conflicts()` — if non-empty, show the nudge instead of committing.
- **`components/calendar/BlockChip.tsx`** — one block. Category accent via
  `accentOf`; synced/external blocks render muted with a `ti-lock` and are not
  draggable; `source: "compass"` proposals render as dashed "ghosts" with a
  confirm tick.
- **`components/calendar/DeadlineRail.tsx`** — horizontal pills for tasks whose
  `due_date` falls in the visible range (the top rail in the mockup). "Schedule
  this" on a pill opens QuickAdd pre-filled with the task + `estimate_minutes`.
- **`components/calendar/QuickAddSheet.tsx`** — reuse `Sheet`. Fields: area
  (category picker), date, start time, duration. Live `conflicts()` check shows
  "overlaps your 2pm Lecture — move it?" before save.
- **`components/calendar/ProposedBlocks.tsx`** — runs the §6 adapter and renders
  the placed ghosts with a single "Add these to my day" confirm (and per-block
  dismiss).
- **Nav** — add `{ href: "/calendar", label: "Calendar" }` to `components/Nav.tsx`.

### Positioning helper (give this to the builder)

```ts
export function blockBox(b: CalendarBlock, day: Interval) {
  const s = Date.parse(b.start_at), e = Date.parse(b.end_at);
  const span = day.end - day.start;
  return {
    topPct: ((Math.max(s, day.start) - day.start) / span) * 100,
    heightPct: ((Math.min(e, day.end) - Math.max(s, day.start)) / span) * 100,
  };
}
```

---

## 8. Suggested build order

1. SQL migration (run it) + types.
2. Data layer: CompassDB + SupabaseDB + LocalDB + query hooks. (CRUD works end to end.)
3. `lib/schedule.ts` + its unit tests. (The algorithm, proven in isolation.)
4. `WeekGrid` + `BlockChip` + read-only render of existing blocks.
5. `QuickAddSheet` + drag/resize + `conflicts()` nudge. (Manual scheduling works.)
6. `DeadlineRail` + "schedule this task".
7. Planner adapter + `ProposedBlocks`. (Smart placement.)
8. Nav entry + Agenda/Day views.
9. `calendar_connections` settings stub (empty list + "coming soon"), so Phase 2
   only adds the sync function.

Steps 1–3 are the Opus-specced foundation in this doc; 4–9 are
straight implementation against the existing patterns.
