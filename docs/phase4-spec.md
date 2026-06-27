# Phase 4 — Data-driven science · Cold-start value · One-tap logging

> **Status:** spec written on Opus, ready to build on Sonnet.
> **Author note:** This spec is self-contained. Every file path, type, and function
> signature below reflects the codebase as of the `feature/calendar-category-intelligence`
> branch. Build the three workstreams **in order** (A → B → C); B and C both depend on A's
> resolver existing, and C depends on the `session_type` field added in A.

Phase 4 closes the three gaps identified in the product review:

- **A. The magic evaporates outside gym/tennis/uni.** Session structures are hardcoded in
  `lib/science.ts`. Adding a domain (running, music, language) needs a code change + deploy.
  → Make the science library **data**, seeded from the current hardcoded values, overridable
  and extensible without a deploy.
- **B. Cold-start.** A brand-new user with zero logged sessions gets generic output and a
  "it's been 14 days" reason that's literally false. → Use the onboarding metadata they just
  entered (experience / UTR / weekly goal) to produce a genuinely personal first plan, and show
  a **"your next 7 days" preview** at the end of onboarding so value lands before the empty state.
- **C. Logging friction.** Accepting a planned session does **not** create a `Session` record
  today (see "Critical insight" below), skill-confidence is asked every session, and duration is
  always manual. → Make **accept = done = logged** in one tap, infer duration from calendar
  blocks, and prompt for skill-confidence only occasionally.

---

## Architecture recap (read before starting)

- **Data layer is dual-backend** behind `CompassDB` (`lib/db/types.ts`). `LocalDB`
  (`lib/db/local.ts`, localStorage) is the default; `SupabaseDB` (`lib/db/supabase.ts`) is used
  when `NEXT_PUBLIC_DATA_BACKEND=supabase`. **Any new store must be implemented in both**, plus a
  SQL migration for Supabase. Both seed initial data in `ensureSeeded()`.
- **Reads/writes go through React Query hooks** in `lib/queries.ts` (`useInvalidatingMutation`
  pattern). The planner is **synchronous** and runs in `components/Plan.tsx` via `buildPlan(...)`,
  fed entirely from already-loaded query data. So any data the planner needs (the science library)
  must be loaded via a hook and passed into `buildPlan`.
- **The planner** (`lib/planner.ts`) scores categories (`scoreCategories`) then renders
  per-domain suggestions (`gymSuggestion` / `tennisSuggestion` / `studySuggestion` /
  `suggestionText`). It imports `lib/science.ts` directly today — that import is what we're
  replacing with an injected library + resolver.
- **`SessionStructure`** (`lib/science.ts`) is already the right shape:
  `{ durationMin: number; plan: string[]; cite: string; whyItWorks: string }`.
- **`blendedDuration`** (`lib/personalStats.ts`) blends the science baseline with the user's own
  rolling average (40/60 once ≥5 sessions) and scales by mental energy. Leave this intact — the
  resolver feeds it the baseline, exactly as today.

### Critical insight (drives workstream C)
In `components/Plan.tsx`, ticking a `SuggestionCard` calls
`update.mutate({ status: "accepted" })` — it **only flips the suggestion's status**. It never
creates a `Session`. That means a user can follow the plan perfectly for weeks and the
personalization engine still has zero data to learn from. Fixing this (accept → create Session) is
the single highest-leverage change in Phase 4 and the foundation of "one-tap logging".

---

## Workstream A — Data-driven science library

**Goal:** session structures become seeded, overridable data. Adding a domain = inserting rows,
not editing TypeScript. The current gym/tennis/uni behaviour (including experience/UTR variants)
must be reproduced exactly from data.

### A1. New types
Add to `lib/types.ts`:

```ts
// A declarative modifier applied to a base session when a condition holds.
export interface SessionVariant {
  // Condition evaluated against resolve-time context (see resolver).
  when: {
    field: "experience" | "level" | "deadlineDays" | "lowWellbeing";
    op: "eq" | "lt" | "lte" | "gt" | "gte";
    value: string | number | boolean;
  };
  patch: {
    sessionTypeOverride?: string;   // e.g. beginner gym → "Full body"
    durationDelta?: number;         // +/- minutes
    durationFactor?: number;        // multiply (applied after delta)
    planPrepend?: string[];
    planAppend?: string[];
    planReplace?: string[];         // replaces plan entirely
    whyAppend?: string;
    whyReplace?: string;
  };
}

export interface SessionTemplate {
  id: ID;
  domain: string;            // "gym" | "tennis" | "uni" | "running" | ... (matches Domain)
  session_type: string;      // "Push", "Backhand", "Revision", "Easy run", ...
  duration_min: number;
  plan: string[];
  cite: string;
  why: string;
  variants?: SessionVariant[];
  is_builtin: boolean;       // true = seeded default (can be reset); false = user-added
  weekly_default?: number;   // optional default weekly-goal hint for the domain
}
```

> Keep `SessionStructure` in `lib/science.ts` as the **resolved** runtime shape. A `SessionTemplate`
> resolves *into* a `SessionStructure`.

### A2. Bundled seed library — `lib/science/library.ts` (new)
Convert the existing data in `lib/science.ts` into a flat `SessionTemplate[]` constant
`BUILTIN_LIBRARY`. This is both the seed for the DB and the **fallback** if the DB store is empty.

- **Gym** (`GYM_SCIENCE`): one template per type (Push/Pull/Legs/Full body/Cardio/Mobility/Recovery).
  Encode `getGymSessionForExperience` as variants on the relevant templates:
  - beginner → `when: {field:"experience", op:"eq", value:"beginner"}`,
    `patch.sessionTypeOverride:"Full body"` + the beginner full-body plan/why (move the inline
    beginner plan from `science.ts:321` into the variant).
  - advanced → `patch.durationDelta:+10`, `planAppend:[volume-tracking, deload lines]`, `whyAppend:...`.
  - Keep the Push→Pull→Legs rotation logic (`GYM_ROTATION`) in the **resolver/planner**, not the
    data — rotation is "which type comes next", a planner concern, not a template property.
- **Tennis** (`TENNIS_SCIENCE`): one template per skill + Match + Fitness. Encode
  `getTennisSessionForUTR` as variants keyed on `field:"level"` (UTR):
  - `op:"lt", value:3` → `durationDelta:-10` (min 30 enforced in resolver), `planReplace` with the
    consistency-constrained plan, `whyReplace`.
  - `op:"gte", value:9` → `durationDelta:+15`, `planAppend` tactical lines, `whyAppend`.
- **Uni** (`STUDY_SCIENCE`): one template per type (Study/Reading/Problem set/Revision/Past paper/
  Group work). No metadata variants today (deadline/momentum branching stays in `studySuggestion`).
- **NEW domains** (this is the payoff — ship them as data so the magic extends):
  - **running**: `Easy run` (Zone 2), `Intervals`, `Long run`, `Tempo`, `Recovery`. Cite ACSM /
    Seiler polarized-training. Variant on `experience` beginner → run/walk intervals.
  - **swimming**: `Technique`, `Endurance`, `Sprints`, `Recovery`.
  - **generic**: a single decent `Session` template so any custom category gets a structured,
    non-embarrassing suggestion (currently `FALLBACK` is one bland line). Make it 3–4 real steps:
    define one outcome, 25-min focused block, capture what worked, set next step.

> Keep citations real and short, matching the tone in `science.ts`. This file will be large; that's
> fine — it's data.

### A3. DB store `session_templates`
Extend the `CompassDB` contract (`lib/db/types.ts`):

```ts
// session templates (data-driven science library)
listSessionTemplates(): Promise<SessionTemplate[]>;
upsertSessionTemplate(input: SessionTemplate): Promise<SessionTemplate>;
removeSessionTemplate(id: string): Promise<void>;
```

- **`lib/db/local.ts`**: add `KEYS.sessionTemplates`. In `ensureSeeded()`, if absent, write
  `BUILTIN_LIBRARY`. Implement the three methods over the array (mirror the categories pattern).
- **`lib/db/supabase.ts`**: add a `session_templates` table. In `ensureSeeded()`, if
  `count === 0`, insert `BUILTIN_LIBRARY`. Implement the three methods (mirror categories).
  `plan` and `variants` are JSON columns.
- **SQL migration** (add to wherever the existing schema lives — check `lib/db/` or a `supabase/`
  dir; if none, add `docs/sql/phase4-session-templates.sql`):

```sql
create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  session_type text not null,
  duration_min int not null,
  plan jsonb not null default '[]',
  cite text default '',
  why text default '',
  variants jsonb default '[]',
  is_builtin boolean not null default false,
  weekly_default int,
  created_at timestamptz default now()
);
-- single-user-per-project model today; enable RLS to match the other tables.
alter table session_templates enable row level security;
-- mirror whatever policy the existing tables use (see categories table policy).
```

> ⚠️ Check the existing tables' RLS policy and replicate it. The other tables already work
> multi-user, so copy that exact pattern — don't invent a new one.

### A4. Resolver — `lib/science/resolve.ts` (new)
Replaces `getScienceForSession`, `getGymSessionForExperience`, `getTennisSessionForUTR`.

```ts
export interface ResolveContext {
  experience?: "beginner" | "intermediate" | "advanced";
  level?: number;          // UTR for tennis; generic numeric level otherwise
  deadlineDays?: number;
  lowWellbeing?: boolean;
}

// Find the template for (domain, sessionType), apply matching variants in order,
// return a resolved SessionStructure. Also returns the (possibly overridden) type.
export function resolveSession(
  library: SessionTemplate[],
  domain: string,
  sessionType: string,
  ctx: ResolveContext,
): { sessionType: string; science: SessionStructure };
```

Rules:
- Look up by `domain` + `session_type`. If not found, fall back to the domain's `generic`/first
  template, then to a hard `FALLBACK` constant (keep one in this file).
- Evaluate each variant's `when` against `ctx`; apply patches **in array order**. Support
  `sessionTypeOverride` (and if it points at another template, re-resolve into that template's base
  first, then continue applying remaining patches — keep this simple: override only swaps
  plan/why/duration via the patch, it does NOT chain re-lookups, to avoid recursion).
- Enforce `durationMin = max(20, base ± deltas) * factor`, rounded.
- The resolver returns the **baseline** duration; `blendedDuration` still does personal blending in
  the planner (unchanged).

### A5. Rewire the planner
- `lib/planner.ts`: add `library: SessionTemplate[]` to `PlannerInput`. Replace the three
  `science.ts` calls:
  - `gymSuggestion`: keep `GYM_ROTATION`/`getNextGymType` for choosing the next type, then call
    `resolveSession(library, "gym", nextType, { experience })`.
  - `tennisSuggestion`: keep the skill-scoring (`getUTRSkillWeights` stays — it's planner logic,
    not template data), then `resolveSession(library, "tennis", recommendedSkill, { level: utr })`.
  - `studySuggestion`: `resolveSession(library, "uni", sessionType, { deadlineDays, lowWellbeing })`.
  - `suggestionText` (generic/finance/job/custom): use `resolveSession(library, domain, type, ...)`
    where `domain = detectDomain(cat.name)` (`lib/categorySetup.ts`) and `type` is the domain's
    default template type. **This is what makes running/music/etc. produce real plans.**
- `lib/science.ts`: keep `GYM_ROTATION`, `getNextGymType`, `TENNIS_SKILLS`, `getUTRSkillWeights`,
  and the `SessionStructure` type. **Delete** `getScienceForSession`,
  `getGymSessionForExperience`, `getTennisSessionForUTR`, and the big `*_SCIENCE` consts (now in
  `library.ts`). Update all imports.
- `lib/queries.ts`: add `useSessionTemplates()` (+ optional `useUpsertSessionTemplate`,
  `useRemoveSessionTemplate`). Add a `sessionTemplates` query key.
- `components/Plan.tsx`: load `useSessionTemplates()` and pass `library` into both `buildPlan`
  calls. If the query is still loading, fall back to `BUILTIN_LIBRARY` so the first paint isn't blank.

### A6. Acceptance criteria (A)
- [ ] `npx tsc --noEmit` clean.
- [ ] Gym/tennis/uni suggestions are **byte-identical** to current output for the same inputs
  (verify: a beginner gym user still gets Full Body; UTR 2 tennis gets the shortened
  consistency plan; UTR 10 gets the tactical append).
- [ ] Adding a row to `session_templates` for a new domain (e.g. a "Guitar" custom category mapped
  to `generic`, or a real `running` category) yields a structured multi-step suggestion with a
  citation — **with no code change** beyond the seed.
- [ ] Works on both `LocalDB` and `SupabaseDB`; seeding populates the store on first run.

---

## Workstream B — Cold-start value from onboarding inputs

**Goal:** a brand-new user (zero sessions) gets a genuinely personal first plan, and sees a
"next 7 days" preview at the end of onboarding.

### B1. Planner cold-start polish (`lib/planner.ts`)
- `lastActivity` returning `undefined` currently makes `sinceDays = 14` → reason
  `"it's been 14 days"`, which is false for a new user. Add an `isFresh` notion: when a category has
  **no sessions and no completed tasks ever**, suppress the neglect reason and instead push a
  fresh-start reason bit, e.g. `"a great place to begin"`. Keep the neglect **score** high (we do
  want fresh categories surfaced) but fix the **language**.
- Make `buildPlan` usable without a check-in: add optional param
  `assume?: { capacity: Capacity; mental: number; uni_readiness: number }`. When `checkin` is
  absent and `assume` is provided, use it (default `{ capacity:"medium", mental:3, uni_readiness:3 }`).
  This is needed by the preview generator; the live Plan still requires a real check-in.

### B2. Week preview generator — `lib/preview.ts` (new)
```ts
export interface PreviewDay {
  date: string;
  weekdayLabel: string;          // "Mon"
  items: { categoryName: string; icon: string; headline: string; estMin: number }[];
}

export function buildWeekPreview(
  base: Omit<PlannerInput, "date" | "checkin">,
  days = 7,
): PreviewDay[];
```
- For each of the next `days` days, call `buildPlan` with `date = addDays(today, i)`, no check-in,
  `assume` defaults, and **simulate the weekly schedule** so scheduled gym/tennis/study days light
  up on the right weekdays (the planner already reads `settings.weeklySchedule` via
  `isScheduledToday`).
- Simulate weekly-goal pacing lightly: spread a category's `weekly_goal` across its scheduled days
  so the preview doesn't suggest the same category all 7 days. (Simplest: only surface a category
  on its scheduled weekdays; for categories with a `weekly_goal` but no schedule, surface every
  `floor(7 / goal)` days.)
- Pure function — **persists nothing**. Take only the headline line of each suggestion
  (`text.split("\n")[0]`).

### B3. Onboarding preview step (`app/onboarding/page.tsx`)
- Add a `"preview"` step **after** `"calendar"` (or replace the calendar step's terminal CTA so the
  preview shows before the final redirect).
- Render `buildWeekPreview(...)` from the categories + metadata the user just created. One compact
  card per day: weekday + 1–2 headline items with icon + est minutes. Empty days read as a calm
  "breathing room" line (reuse the existing copy from `Plan.tsx`).
- Heading: **"Here's what your next 7 days could look like"**, subcopy that it adapts as they log.
- Final CTA `"Start day 1 →"` → existing `handleFinish()` (sets `onboarding_completed_at`, routes to
  `/checkin`).
- The preview needs `sessions` (empty for new users), `tasks`, `settings`, and the
  `session_templates` library — load `useSessionTemplates()` here too, fall back to `BUILTIN_LIBRARY`.

### B4. Acceptance criteria (B)
- [ ] New user who picks Gym (beginner, 3×/wk) + Tennis (UTR 4, 2×/wk) + Uni sees a 7-day preview
  with **personalized** content (Full Body for beginner gym; skill-focused tennis) and **no**
  "it's been 14 days" language anywhere.
- [ ] Preview persists nothing (no suggestions/sessions written during onboarding).
- [ ] Day 1's real plan after check-in matches the spirit of the preview's day 1.

---

## Workstream C — One-tap logging + passive capture

**Goal:** accepting a planned session logs it (one tap), duration is inferred from the calendar when
possible, and skill-confidence is asked only occasionally.

### C1. Carry the session type on suggestions
- `lib/types.ts`: add `session_type?: string` to `Suggestion`. Add it to `DraftSuggestion` output in
  `lib/planner.ts` for every domain branch (gym → next type, tennis → recommended skill, uni →
  chosen `sessionType`, generic → resolved type).
- DB: `LocalDB` stores it for free (JSON). `SupabaseDB`: add a `session_type text` column to the
  `suggestions` table (migration). Confirm `saveSuggestions`/`updateSuggestion` pass it through
  (they spread the object, so just the column is needed).

### C2. Accept → create Session (the core change) — `components/Plan.tsx`
- When `onToggle(true)` fires on an actionable `SuggestionCard`, in addition to marking the
  suggestion `accepted`, create a `Session`:
  ```ts
  createSession.mutate({
    category_id: s.category_id!,
    date: today,
    type: s.session_type ?? "Session",
    duration_minutes: inferDuration(s, calendarBlocks) ?? s.est_minutes,
    payload: { auto_logged: true, suggestion_id: s.id },
  });
  ```
- When `onToggle(false)` (untick), **remove** the auto-logged session created for that suggestion
  (find by `payload.suggestion_id === s.id && payload.auto_logged`). Use `useSessions()` +
  `useRemoveSession()`.
- Guard against duplicates: before creating, check no existing session has
  `payload.suggestion_id === s.id`.
- Only do this for actionable suggestions with a `category_id` (skip affirmations / rest cards).
- This is per-suggestion, so it belongs in `SuggestionCard` (pass `onComplete`/`onUncomplete`
  callbacks down, or lift the session create/remove into the parent's `onToggle`). Lifting into the
  parent is cleaner — the parent already owns `update.mutate`.

### C3. Infer duration from calendar — `lib/personalStats.ts` or new `lib/sessionInfer.ts`
```ts
// If a busy, timed calendar block for this category exists on `date`, return its
// real minutes (end - start); else undefined.
export function inferDurationFromBlocks(
  categoryId: string | undefined,
  date: string,
  blocks: CalendarBlock[],
): number | undefined;
```
Used by C2. Prefer the matched block's actual minutes over the science estimate, because it's real.

### C4. One-tap done on Today's schedule (`app/page.tsx`)
- Each timed block in "Today's schedule" already renders. Add a small one-tap **"done ✓"** affordance
  that creates a `Session` for that block's category using the block's real duration
  (`inferDurationFromBlocks`), `type` from the block title if it maps to a known type else
  `"Session"`, `payload:{ auto_logged:true, block_id: block.id }`. Toggle state from the existence of
  that session. This captures activity passively for events that came from the calendar, not the plan.
- Don't show it for blocks with no `category_id` (unmatched external events).

### C5. Make skill-confidence occasional (`components/LogSheet.tsx`)
- Add helper `shouldPromptSkillConfidence(sessions, categoryId, skill, today): boolean` (in
  `lib/personalStats.ts` or `lib/sessionInfer.ts`): return `true` only if there is **no**
  `skill_confidence` logged for that skill in the last 7 days, OR it's the 3rd+ session of that skill
  since the last rating. Otherwise skip the question.
- In the feedback step, gate the skill-confidence block on this helper instead of showing it every
  tennis skill session. Energy + duration-feel can stay every time (they're one tap each), but
  consider also defaulting them so "Save feedback" is optional.
- **One-tap accepts (C2) never open LogSheet.** Optionally: occasionally (same cadence helper) show a
  tiny non-blocking "rate your {skill}?" follow-up chip under the accepted card — but keep it
  dismissible and never a modal. If unsure, skip the follow-up in v1; the main win is auto-logging.

### C6. Acceptance criteria (C)
- [ ] Ticking a planned gym session creates a `Session` of the correct `type` and duration; unticking
  removes it; no duplicates on re-tick.
- [ ] When a calendar block for that category exists today, the logged duration equals the block's
  real minutes, not the estimate.
- [ ] After a week of only ticking the plan (no manual logging), `getPersonalStats` reports
  `hasEnoughData` and `blendedDuration` starts blending — i.e. the engine now learns from accepts.
- [ ] Tennis skill-confidence is asked at most ~once/week/skill, not every session.
- [ ] `npx tsc --noEmit` clean; manual smoke test of accept/untick/relog.

---

## Suggested build order & checkpoints
1. **A1–A2** types + bundled library (pure refactor of existing data; no behaviour change yet).
2. **A3** DB store both backends + migration + seeding.
3. **A4–A5** resolver + planner rewire + `Plan.tsx` wiring. **Checkpoint:** existing 3 domains
   identical; a hand-inserted running template produces a real plan.
4. **B1–B3** cold-start polish + preview generator + onboarding step. **Checkpoint:** new-user
   preview is personalized and writes nothing.
5. **C1–C5** session_type field + accept→Session + duration inference + occasional skill prompt.
   **Checkpoint:** accepting the plan accumulates real session data.
6. `npx tsc --noEmit`, smoke test, commit per workstream, push.

## Risks / watch-outs
- **Seeding idempotency:** never double-seed `session_templates`; gate on count/empty exactly like
  categories. A bad seed that runs every load would duplicate the whole library.
- **RLS:** copy the existing tables' policy verbatim for `session_templates`; a missing policy will
  silently return zero rows under Supabase and the planner will fall back to `BUILTIN_LIBRARY`
  (degraded but not broken — still verify).
- **Untick correctness:** removing the auto-logged session must match on `suggestion_id`, not on
  category+type (the user may have a real manual session of the same type that day).
- **Preview cost:** `buildWeekPreview` runs `buildPlan` 7×; it's pure and cheap, but memoize in the
  onboarding component so it doesn't recompute on every keystroke.
- **Don't regress the calm ethos:** auto-logging must stay silent and reversible; the occasional
  skill prompt must never become a modal wall. Keep affirmations/rest cards out of auto-logging.
