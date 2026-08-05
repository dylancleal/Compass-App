# DESIGN.md — Lodestone: the Instrument Readout redesign

Records what shipped in this design pass, why, and what to check before calling it finished. Scope: **Lodestone only** (`data-variant="study"`). Compass keeps its existing Eucalyptus look and is not part of this redesign — see "Compass isolation" below.

## Thesis

Lodestone stopped reading as a wellness app apologizing for asking you to do something, and started reading as the sports watch already on your wrist — every screen a live instrument reporting your actual state, not a soft card.

**World:** matte-black instrument face; tabular/monospace numerals at real size for every stat; category colors as committed "channels" (cobalt/amber), not pastel accents; cards as bezel-outlined instrument panels with a channel-color LED dot, replacing the old side-tab border pattern; progress as lap-arcs and readouts, not flat fills alone.

**Candidate 4 of 7**, seed key `c72a5b91` — chosen after a comp round across `app/comp-a`, `app/comp-b`, `app/comp-c` (temporary routes, now deleted, see "Cleanup" below).

**Revision (post-review):** the first pass went fully flat/atmosphere-free — zero elevation, no background glow, Fireflies disabled — which read as cold and off-brand rather than "instrument." Feedback: keep the bezel-panel/LED-dot/tabular-numeral structure, but bring back the green/apricot glow blobs, ambient starfield motes, and card lift that make it still read as a wellness app. See "Design tokens" below for the restored values.

## What changed

### Design tokens (`app/globals.css`)
A new `:root[data-variant="study"]` block sits alongside the existing Eucalyptus tokens: matte-black `--background`/`--surface`, near-white `--foreground`, a cobalt `--primary` and amber `--accent` as committed channel colors, and `--led-glow`/`--font-mono-instrument` as instrument-only primitives with no Eucalyptus equivalent.

`--shadow-1/2/3`, `--card-highlight`, and `--blob-a`/`--blob-b` (the two green/apricot glow blobs painted by `body::before`/`body::after`) were initially zeroed out for a fully flat "no elevation, no atmosphere" look, and `components/Fireflies.tsx` (ambient starfield motes, app-wide) was disabled for this variant entirely. Both were reverted after review — they now reuse the same Eucalyptus dark-mode values (proven against a near-black canvas) and Fireflies renders for both variants. `.card` still gets a slightly tighter `border-radius` for Lodestone, but no longer strips its shadow.

### Surfaces rebuilt (visual + critique fixes)
Each was scored by a dual-agent critique (design review + browser/DOM evidence) before rework. Scores are out of 40.

| Surface | File | Before | Key fixes |
|---|---|---|---|
| Today | `app/page.tsx`, `components/DayTimeline.tsx` | 22 | New timeline layout for the Lodestone variant (Compass keeps the card list) |
| Calendar | `app/calendar/page.tsx` | 23 | — |
| Progress / This week | `app/review/page.tsx` | 18 | Next-week preview now starts next Monday, not today; removed duplicate empty state; side-tab borders replaced with icon-chip color |
| Trends | `app/trends/page.tsx` | 22 | Panel routing switched from exact-name match to `detectDomain()` so renamed categories keep their tailored charts; Y-axis labels no longer clip on mobile; removed the redundant 8-week chart stacked on top of the paid-tier 26-week chart; heatmap gained a scroll fade + cue; `ForecastCard` retheme onto shared tokens, matching `CoachPanel`'s flat-card treatment; forecast copy no longer contradicts itself when the mental-score scale is ceiling-clamped |
| Settings | `app/settings/page.tsx` | 28 | Weekly Schedule now derives its rows from the user's actual active categories (via `detectDomain`) instead of a hardcoded Study/Gym/Tennis list — a renamed or removed area no longer leaves a phantom toggle row; auto-saved fields (name, area name/icon, planner-weight sliders) flash a "Saved" confirmation; area deletion uses a themed inline confirm instead of `window.confirm()`; touch targets bumped to 44×44 with real aria-labels |
| Onboarding | `app/onboarding/page.tsx` | 24 | No visual redesign (deliberately out of scope) — fixed the P0: `IntroTour` no longer auto-redirects the user away from `/checkin` seconds after onboarding finishes; added Back navigation through Setup and Preview; category-creation failures are now surfaced instead of silently swallowed; primary CTAs show pending state |
| Sign-in | `components/NativeAuthScreen.tsx`, `components/AuthGate.tsx` | 21 | No visual redesign — fixed the shared P0 root cause: a malformed/empty error value rendered as the literal text `{}`; unified "Send magic link" → "Continue" to match what actually happens (typed code, not a clickable link) and native's existing copy; added the missing focus ring on native inputs; `autoComplete`/`aria-label` added to both email and code inputs; touch targets bumped to 44×44 |

### Shared root-cause fixes
- **`friendlyAuthError()`** (`components/AuthGate.tsx`): every `setErr(...)` call now routes through one helper that refuses to render an empty/message-less error value verbatim — this was the literal `{}` bug, reproduced independently by both the Onboarding and Sign-in critiques.
- **`detectDomain()` as the routing key**, not display name: `app/trends/page.tsx` (panel selection) and `app/settings/page.tsx` (Weekly Schedule rows) both moved off exact `category.name` matching, onto the same `lib/categorySetup.ts` helper already used by `GoalCard.tsx` and `lib/preview.ts`. Both surfaces previously silently dropped functionality the moment a user renamed a category — directly contradicting the product's "fully renameable" promise.
- **Chart axis clipping** (`components/charts.tsx`): `LineTrend`/`AreaTrend`/`BarTrend` all had a Y-axis width too narrow for 3-digit values at 375px, causing "240" to read as "40". Widened and rebalanced margins across all three; `BarTrend` also gained the empty state the other two already had.

## Compass isolation

Every change above is either:
1. Gated behind `APP_VARIANT.id === "study"` (Subscription section, `CoachPanel`, `DeepInsights`, the timeline layout), or
2. A variant-agnostic bug fix that benefits both products identically (the `{}` error fix, the `detectDomain()` routing fixes, the IntroTour hijack fix, chart axis clipping, touch targets) — these use CSS custom properties that already resolve correctly per-theme, never hardcoded Instrument Readout colors into shared code paths.

No Eucalyptus token was touched. `getAccessLevel()` still returns `"paid"` unconditionally outside the `"study"` variant, so none of the gating logic engages for Compass.

## Verification performed

- `npx tsc --noEmit` clean after every change in this pass.
- Live browser verification (dev account, Lodestone variant) for every rebuilt surface: Trends (panel routing across a renamed category, chart Y-axis at 375px, redundant-chart removal, heatmap scroll cue, forecast copy under a real ceiling-clamped account), Settings (Weekly Schedule against live categories — caught and fixed a `detectDomain()` return-value mismatch here, themed delete confirm, save-flash), Sign-in (copy, contrast, touch-target height, autocomplete/aria attributes), Today and Calendar (regression check after touching shared `GoalCard.tsx`/`charts.tsx`).
- Contrast was checked with computed `getComputedStyle` values and the real WCAG relative-luminance formula, not eyeballed — this caught that the critiques' specific Settings contrast complaints (`primary-soft`/`primary` pairing) were already resolved as a side effect of the token redesign (now 5.11:1), while surfacing a *new*, currently-live failure the critiques hadn't specifically named.

## Known follow-up (not fixed in this pass)

**White-on-primary button contrast is app-wide, not surface-specific.** `color: "#fffdf9"` (or Tailwind `text-white`) on `background: var(--primary)` (`#4f8ff0` in the Lodestone dark theme) computes to ≈3.17:1 — below the 4.5:1 AA minimum. Confirmed live on Settings' "Turn on" and "Add calendar" buttons and Sign-in's "Continue" button. The same pairing appears identically in ~12 files including already-shipped surfaces (`components/Nav.tsx`, `components/ProgressTabs.tsx`, `app/calendar/page.tsx`, `app/onboarding/page.tsx`, `components/IntroTour.tsx`, `components/CategorySetupSheet.tsx`, `components/calendar/WeekGrid.tsx`, `components/calendar/ConnectionsPanel.tsx`, `app/connected/page.tsx`), so it needs a token-level fix (darken `--primary`, or introduce a computed on-primary text color) rather than a per-file patch. Tracked as a spawned follow-up task in-session; not yet actioned.

## Cleanup

`app/comp-a`, `app/comp-b`, `app/comp-c` — the temporary side-by-side comp routes used to pick the direction above — were untracked scratch work and have been deleted now that candidate 4 is fully implemented across the real routes.
