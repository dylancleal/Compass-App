# Spec — New-user introduction & demo ("How Compass works")

> **Status:** spec written on Opus, ready to build on Sonnet.
> **Author note:** Self-contained. Every file path, type, and hook below reflects the codebase as of
> the `fix/ux-time-format-and-slots` branch. Build the parts **in order** (A → B → C); B reuses the
> persistence flag from A, and C is a thin entry point that reuses A's component.

## Why we're building this

A new user finishes onboarding (pick areas → set goals → calendar → 7-day preview → first check-in)
and lands on the Today page facing a real plan — but **nothing has ever explained the daily loop**:
that you tick suggestions to log them, that the green pills are the app learning, that there's an
evening wrap and a weekly review. The magic is invisible until you stumble onto it.

This feature adds a gentle, **skippable, replayable** introduction that teaches the daily loop and
the 3–4 highest-value interactions — without breaking the calm ethos (no nagging, no modal walls,
everything dismissible).

**Non-goals:** no video, no external tour library, no account/credential steps, no gamification.
Keep it pure-frontend and local — it reads/writes only `AppSettings` (already dual-backend).

---

## Architecture recap (read before starting)

- **Settings is the persistence home.** `AppSettings` (`lib/types.ts`) already carries
  `onboarding_completed_at?: string`. It is read with `useSettings()` and written with
  `useSaveSettings()` (`saveSettings.mutate({ field: value })` — partial merge). Onboarding's
  `handleFinish()` (`app/onboarding/page.tsx:371`) is the exact pattern to copy for our new flag.
- **App shell:** `app/layout.tsx` mounts `<Nav/>` then `<main class="max-w-2xl px-4 pt-20 pb-10">`.
  `Nav` hides itself on `/onboarding` (`components/Nav.tsx:23`). A global overlay should mount inside
  `Providers` so it has React Query access.
- **Onboarding terminal step** is `"preview"` → `handleFinish()` sets `onboarding_completed_at` and
  routes to `/checkin`. After the check-in is saved, the user arrives at `/` (Today).
- **The daily loop the tour must teach** (all already built):
  1. **Morning check-in** (`/checkin`) shapes the plan.
  2. **The plan** (`components/Plan.tsx`) — **tick a suggestion = log it** (auto-creates a Session).
     Cards show **green personal-insight pills** (the app learning) and **time chips** (~when to do it).
  3. **Carry-over** — yesterday's unticked suggestions appear atop today's plan.
  4. **Quick log** chips + **Today's schedule** "done?" buttons capture activity passively.
  5. **Evening wrap** (`/wrap`) — one-tap rating after 4pm closes the day.
  6. **Weekly review** (`/review`) — Sunday-style stats + next-week preview.
- **Tone reference:** copy should match the existing voice — calm, warm, second person, short.
  See onboarding headings ("What do you want to work on?", "Here's what your next 7 days could look
  like") and Plan empty states.

---

## Part A — Welcome carousel (the core deliverable)

A swipeable, full-screen-overlay sequence of **5 cards** that fires **once**, the first time the user
lands on Today after completing onboarding. Skippable at any point; never shown again once finished
or skipped (unless replayed via Part C).

### A1. Persistence flag — `lib/types.ts`

Add to `AppSettings`, mirroring `onboarding_completed_at` exactly:

```ts
tour_completed_at?: string; // ISO datetime — unset means the intro hasn't been seen
```

> **Dual-backend note:** `onboarding_completed_at` already round-trips through both `LocalDB` and
> `SupabaseDB`, so `tour_completed_at` rides the same settings storage. **Do not** add a SQL
> migration unless settings are stored as individual columns — check `lib/db/supabase.ts`
> `getSettings`/`saveSettings`: if settings is a single JSON/row blob, no migration is needed; if it's
> column-per-field, add `tour_completed_at text` to that table the same way `onboarding_completed_at`
> is handled. Match whatever pattern already exists — don't invent a new one.

### A2. Component — `components/IntroTour.tsx` (new)

A client component. Self-contained overlay; renders `null` unless it should show.

```ts
"use client";
// Reads useSettings(); useSaveSettings(). Renders nothing until settings load.
// Shows when: settings.onboarding_completed_at IS set AND settings.tour_completed_at is NOT set.
// Also exported so Part C can force-open it: <IntroTour forceOpen={bool} onClose={...} />
```

Props:
```ts
interface IntroTourProps {
  forceOpen?: boolean;          // Part C — replay regardless of the saved flag
  onClose?: () => void;         // called after finish/skip (used by Part C)
}
```

Behaviour:
- **Auto-show gate:** if `!forceOpen`, only render when `onboarding_completed_at` is set **and**
  `tour_completed_at` is unset. While settings are loading, render `null`.
- **Finish / Skip:** both call `saveSettings.mutate({ tour_completed_at: new Date().toISOString() })`
  then hide. In `forceOpen` mode, **do not** write the flag again if it's already set — just call
  `onClose()` (replaying shouldn't matter, but keep it idempotent).
- **Card navigation:** local `index` state, Back / Next buttons + a row of progress dots (reuse the
  dot pattern from `StepSetup`, `app/onboarding/page.tsx:157-165`). Support arrow-key Left/Right and
  swipe (touch) if cheap; keyboard + buttons are the must-haves. Last card's primary button reads
  **"Start using Compass →"**.
- **Dismiss:** a small "Skip" text button (top-right or bottom-left) on every card, plus `Esc` key
  and backdrop click.

### A3. The 5 cards (content + intent)

Each card: an emoji/visual, a heading, 1–2 short sentences. Keep it skimmable. Where a card refers to
a real UI element, render a **small static mock** of that element (a styled div that *looks like* the
real card/chip) rather than a screenshot — consistent with the design system, no asset pipeline.

1. **Welcome / philosophy** 🧭
   - "Welcome to Compass" — "A calm daily companion. Each morning it shapes a gentle plan around your
     energy and your goals. No strePress, no guilt — just a nudge in the right direction."
   - *(fix the typo — write "No pressure".)*

2. **Check in → get a plan** 🌿
   - "Start with a 30-second check-in. Tell Compass how today feels and it shapes the plan to match —
     a lighter list on a rough day, more on a big one."
   - Mock: a miniature check-in summary row (mood emoji + "Medium day").

3. **Tick to log — that's the whole trick** ✅
   - "Tap the circle on any suggestion to mark it done. That's it — Compass logs it for you and learns
     from it. The more you tick, the more personal your plan becomes."
   - Mock: a mini SuggestionCard with the tick circle highlighted, plus a green pill reading
     "3/4 sessions this week ✓" and a time chip "~9am". Label them: "← this is Compass learning"
     pointing at the green pill.

4. **Capture everything, gently** 🗓️
   - "Did something off-plan? Use the Quick-log chips. Got events in your calendar? Tap 'done' right on
     the schedule. Yesterday's unfinished items carry over to today automatically."
   - Mock: a Quick-log chip + a schedule row with a "done?" button.

5. **Close the loop** 🌙
   - "After 4pm, close your day with a one-tap rating. On Sundays, the Review tab shows your week —
     sessions, streaks, and a preview of what's next."
   - Mock: the three wrap faces (🌟 😌 😕) + a tiny "Review" stat tile ("7 sessions").
   - Primary button: **"Start using Compass →"**.

### A4. Styling
- Full-viewport overlay: fixed inset-0, backdrop `rgba` blur over the app, centered card
  `max-w-md`, using `var(--surface)`, `var(--border)`, `var(--primary)`, `var(--muted)` — same tokens
  as onboarding. Respect dark mode (the app is dark-default; tokens already handle it).
- Entrance: reuse the existing `animate-pop` class (used on Today's check-in card) for the card.
- Mobile-first: cards must look right at ~380px wide. Buttons full-width-friendly.

### A5. Mounting
- Render `<IntroTour />` once, globally, **inside `Providers`** in `app/layout.tsx` (after `<main>` is
  fine — it's a fixed overlay). It self-gates, so mounting it always is safe; it shows nothing for
  returning users or users mid-onboarding.
- It must **not** appear over the `/onboarding` route. Gate on `usePathname()`: return `null` while
  `pathname.startsWith("/onboarding")` or `pathname === "/checkin"` (let the user finish the real
  check-in first; the tour greets them once they reach Today).

---

## Part B — First-Today coach-marks (optional polish, build only if A is clean)

Lightweight one-time tooltips on the Today page pointing at the 2 highest-value targets. **Skip this
part entirely if it risks the calm feel — A is the priority.** If built:

- After the carousel finishes, show at most **two** sequential coach-marks on `/`:
  1. point at the first SuggestionCard's tick circle — "Tap to mark done. Compass logs it for you."
  2. point at a green insight pill (if one is visible) — "Green = Compass learning from you."
- Use a separate flag `coachmarks_done_at?: string` in `AppSettings` (same pattern), so they show once.
- Implement as absolutely-positioned tooltips anchored to elements via `data-tour="plan-tick"` /
  `data-tour="insight-pill"` attributes added to the real elements in `components/Plan.tsx`. No
  third-party library — a small `useEffect` that measures `getBoundingClientRect()` is enough.
- Every coach-mark has a "Got it" dismiss; dismissing the last writes the flag.
- **Watch-out:** if no actionable suggestion or no insight pill is on screen, skip that mark silently
  rather than pointing at nothing. If neither target exists, write the flag and show nothing.

---

## Part C — Replay entry point ("How Compass works")

So the intro isn't a one-shot a user can never see again.

- Add a row to `app/settings/page.tsx` — a button **"Replay the intro tour"** (or "How Compass works").
  Place it near the bottom (e.g. under a small "Help" or "About" heading; create one if none exists).
- Wire it to open `<IntroTour forceOpen onClose={...} />`. Manage a local `tourOpen` boolean in the
  settings page; render the tour conditionally with `forceOpen`. Closing just flips the boolean — it
  must **not** clear `tour_completed_at`.
- This reuses the exact same component — no content duplication.

---

## Acceptance criteria

- [ ] `npx tsc --noEmit` clean.
- [ ] **First run:** a brand-new user who completes onboarding + first check-in lands on Today and the
      welcome carousel appears automatically, exactly once.
- [ ] Skipping on any card, or finishing the last card, both set `tour_completed_at` and the carousel
      never auto-appears again (verify by reloading).
- [ ] The carousel **never** appears on `/onboarding` or `/checkin`, and never for a user who already
      has `tour_completed_at` set.
- [ ] Navigation works via Next/Back buttons, progress dots reflect position, `Esc`/backdrop/Skip all
      dismiss.
- [ ] Renders correctly at 380px width and in dark mode; uses design tokens (no hardcoded hex except
      where the existing code already does).
- [ ] **Replay:** Settings → "Replay the intro tour" reopens it; closing it does not wipe the flag and
      does not retrigger the auto-show.
- [ ] Works on both `LocalDB` and `SupabaseDB` (the flag persists across reload in each).
- [ ] (If Part B built) coach-marks show once after the carousel, skip gracefully when their target
      isn't on screen, and respect their own flag.

## Build order & checkpoints
1. **A1** add `tour_completed_at` to `AppSettings`; confirm settings save/load round-trips it on both
   backends (check `lib/db/supabase.ts` to decide if a migration is needed). **Checkpoint:** flag
   persists.
2. **A2–A5** build `IntroTour.tsx`, the 5 cards, mount globally, self-gate. **Checkpoint:** auto-shows
   once for a fresh user, never for a returning one; typo "No pressure" fixed.
3. **C** settings replay entry. **Checkpoint:** replayable without wiping the flag.
4. **B** (optional) coach-marks, only if time and it stays calm.
5. `npx tsc --noEmit`, manual smoke test (fresh user via Dev login + temporary flag reset), commit,
   push, open PR.

## Risks / watch-outs
- **Don't gate on `sessions.length`** to detect "new user" — gate on the explicit
  `onboarding_completed_at` set + `tour_completed_at` unset. The existing Today redirect logic
  (`app/page.tsx:80`) uses sessions as a fallback for *legacy* users; the tour should rely on the
  flags only.
- **Idempotent writes:** don't write `tour_completed_at` on every render — only on finish/skip, and
  not at all in `forceOpen` replay mode.
- **No flash:** while `useSettings()` is loading, render `null` so the overlay never flickers in for
  returning users on slow loads.
- **Calm ethos:** everything dismissible, no second auto-popup, copy stays warm and brief. If Part B
  feels naggy in testing, cut it.
- **Testing a fresh run:** to re-trigger locally, temporarily clear `tour_completed_at` via Settings
  save or the Dev login flow — don't hardcode a bypass that ships.
```
