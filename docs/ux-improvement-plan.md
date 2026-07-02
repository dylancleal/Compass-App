# Compass — UI/UX & Flow Improvement Plan

Drafted from a full pass over the app (Today, Check-in, Plan, Calendar, Review, Trends, Wrap, Uni, Areas, Settings, Onboarding, IntroTour). Keep the existing **Eucalyptus** identity — warm sand, deep greens, biophilic blobs, gentle copy. Everything below builds on it, nothing replaces it.

Each item is self-contained with file paths so it can be implemented independently in any order (built for handing to a coding agent one section at a time).

---

## 1. Current-state snapshot

**What's already strong**
- Cohesive palette + dark mode, CSS-variable driven (`app/globals.css`)
- Real behavioural science in the planner: Fogg B=MAP single next action ("Start here" breathe ring), respect-rest, spaced-repetition study logic, streak surfacing, personal insights
- Satisfying micro-interactions: TickCircle confetti burst, all-done confetti rain, collapsible "how to approach" steps
- The daily loop exists end-to-end: check-in → plan → tick → evening wrap → review

**Main weaknesses**
1. **Flat hierarchy on Today** — 7 equally-weighted card sections stacked (`app/page.tsx`). The one thing that matters right now doesn't visually dominate.
2. **Nav overload** — 7 tabs (`components/Nav.tsx`). Review and Trends overlap heavily; Uni is a single category promoted to global nav.
3. **Flat visual depth** — every card is the same 1px border + 3px shadow. No elevation system, no gradients, nothing "3D".
4. **Static numbers** — stats, progress bars and rings render at final value instantly; no count-ups, no fill animations on mount.
5. **Time-blindness** — the home page looks identical at 7am and 9pm. The app knows the time and the checkin state; the layout should morph.
6. **Dark-mode leaks** — many hard-coded hexes won't adapt: conflict badge `#fef9ec` (`app/page.tsx:117`), Affirmation card `#f0fdf4/#ecfeff/#065f46` (`components/Plan.tsx:425-449`), onboarding custom tile `#f0f4ff` (`app/onboarding/page.tsx:99`), wrap rating tints, `#c7cfc3` unchecked TickCircle border. Audit and convert to CSS vars.
7. `h-13` in `components/Nav.tsx:27` is not a Tailwind scale value — verify it resolves; likely should be `h-12` or `h-[52px]`.

---

## 2. Quick wins — styling & motion (low risk, do first)

### 2.1 Elevation system (globals.css)
Replace the single `.card` shadow with a 3-tier scale using **green-tinted** shadows (tinted shadows read warmer/more physical than gray):

```css
--shadow-1: 0 1px 2px rgba(46,58,51,.05), 0 1px 3px rgba(46,58,51,.04);
--shadow-2: 0 2px 4px rgba(46,58,51,.05), 0 6px 14px rgba(46,58,51,.07);
--shadow-3: 0 4px 8px rgba(46,58,51,.06), 0 14px 32px rgba(46,58,51,.11);
```
- `.card` default → shadow-1. Interactive cards (suggestion cards, check-in CTA) → shadow-2, hover → shadow-3 with `translateY(-2px)`.
- Add a 1px **inner top highlight** to cards for a subtle dimensional "lit from above" feel:
  `box-shadow: inset 0 1px 0 rgba(255,255,255,.6), var(--shadow-1);` (use `rgba(255,255,255,.04)` in dark mode).

### 2.2 Primary buttons get life
All primary CTAs (`Continue →`, `Start day 1 →`, `Save & close →`) are flat `var(--primary)`. Change to:
- `background: linear-gradient(135deg, var(--primary-mid), var(--primary))`
- hover: soft glow `box-shadow: 0 4px 16px var(--ring)` + `translateY(-1px)`
- active: press down. Centralize in `components/ui.tsx` `Button` so it propagates everywhere.

### 2.3 Staggered list entrances
Suggestion cards (`components/Plan.tsx`) all pop in at once. Add `animation-delay: calc(var(--i) * 60ms)` via inline `--i` per card index. Same for onboarding preview day cards and review "By area" rows. Cheap, makes every list feel alive.

### 2.4 Animated numbers & bars
- Review stats (`app/review/page.tsx` headline grid) and Trends: count-up on mount (simple `requestAnimationFrame` hook, ~20 lines, `lib/useCountUp.ts`).
- All progress bars (GoalCard, review By-area) animate width from 0 with `transition: width .6s cubic-bezier(.22,1,.36,1)` triggered after mount.
- The unused `ring-fill` keyframe in globals.css suggests rings were planned — see 3.2.

### 2.5 Animated nav pill
Active tab currently swaps colour instantly. Slide a single pill indicator between items (CSS: measure active link, absolutely-position a rounded rect behind it, `transition: left/width .25s`). Feels dramatically more polished for ~30 lines.

### 2.6 Tick → settle animation
When a suggestion is ticked, the card currently just drops to `opacity: .72`. Instead: brief scale-down (`scale(.985)`), headline gets an animated strikethrough (width 0→100% pseudo-element), then settles. Pairs with the existing confetti burst.

---

## 3. Depth & "3D" layer (theme-safe, no WebGL)

Recommendation: **CSS pseudo-3D, not Three.js.** This is a daily-use PWA; keep it instant. All of the below is transform/gradient only and respects `prefers-reduced-motion`.

### 3.1 Cursor-follow tilt on hero cards
The check-in CTA and the "Start here" suggestion card get a gentle perspective tilt following the pointer (max ~2.5deg, `perspective(800px) rotateX() rotateY()`, spring back on leave). Desktop-only (pointer: fine). ~25 lines as a `useTilt` hook. This is the single highest-impact "3D" touch.

### 3.2 3D progress rings for weekly goals
Replace `GoalCard` thin bars with SVG rings:
- gradient stroke (`primary-mid → primary`), rounded caps
- animated `stroke-dashoffset` fill on mount (the `ring-fill` keyframe already exists in globals.css)
- soft drop-shadow under the arc for lift
- when a ring crosses 100%: pulse + tiny leaf/checkmark pop (goal-gradient payoff moment, see §5)

### 3.3 Icon chips with dimension
Category emoji currently sit raw. Wrap in "squircle" chips: `border-radius: 38%`, soft radial gradient background from the category accent (`accent.soft → surface`), 1px inner highlight, tiny drop shadow. Instantly gives every list a tactile, layered feel. Apply in Plan pills, Quick log chips, Areas page, Review rows.

### 3.4 Layered header depth on Today
Give the greeting header a subtle parallax: the biophilic blobs already drift; add one small leaf/branch SVG accent behind the greeting that translates slightly on scroll (`transform: translateY(scrollY * -0.08)`). Keep opacity low (~8%).

### 3.5 Dark-mode fireflies (delight, optional)
In dark mode only, 4–5 tiny blurred dots (`--primary-mid` at 30%) drifting very slowly behind content — the night version of the blobs. Pure CSS keyframes.

### 3.6 Stretch (only if wanted later): a real 3D compass rose
A small CSS-3D compass on the empty/all-done state (two stacked divs, `rotateX(60deg)`, needle spins to "N" on day completion). Skip Three.js/Spline — 200KB+ for one flourish isn't worth it on this app.

---

## 4. Flow restructure

### 4.1 Consolidate nav: 7 → 5
```
Today · Calendar · Progress · Areas · ⚙
```
- **Progress** = merge Review + Trends (they both show weekly stats; Review keeps the narrative summary + next-week preview as the default tab, Trends' charts become a second tab within the page).
- **Uni** leaves global nav — it's one category's detail page. Link to it from its Area card and from uni-related suggestion cards instead. (Routes stay, just de-promoted.)
- Settings becomes a gear icon, right-aligned.

### 4.2 Time-aware Today page (the big one)
The home page morphs by daypart + state — same components, different order/prominence:

| State | Hero (top, large) | Below |
|---|---|---|
| Morning, no check-in | Check-in CTA (bigger, with day-arc art) | Yesterday carry-over, schedule |
| Checked in, plan open | **The single "Start here" card**, full-width and prominent | Rest of plan (slightly smaller cards), goals, schedule, quick log |
| All plan done | Celebration state + "day arc" showing sun past peak | Wrap teaser, goals recap |
| After 4pm, no wrap | Wrap CTA becomes the hero (currently a small card) | Plan remainder |
| After wrap | "Day sealed" quiet state + tomorrow's one-line sketch | — |

Implementation: a `daypart()` helper + conditional ordering in `app/page.tsx`. No new data needed — `checkin`, `allDone`, `evening_rating`, and the clock are all already read there.

### 4.3 The "plan reveal" moment
After finishing check-in, `/checkin` currently just routes home. Instead: brief transition screen (~1.5s) where the plan cards deal in one-by-one with their reasons ("because it's been 5 days…"). This turns plan generation into an anticipated reward instead of a page swap. Route `/checkin` → `/?reveal=1`, and `Plan.tsx` staggers with slightly longer delays + a "Building your day…" shimmer when the flag is present.

### 4.4 Wrap = peak-end moment
The evening wrap (`app/wrap/page.tsx`) is the "end" in peak-end terms — currently the plainest screen in the app. Upgrade:
- After save: full-screen moment — moon rises, day's stats summarised in 3 numbers (sessions, minutes, streak), one affirming line.
- Then a **tomorrow teaser**: "Tomorrow looks like: 💪 Pull day · 🎾 Backhand" (one `buildPlan` call for tomorrow with assumed medium capacity). Planting tomorrow's intention tonight = implementation-intention effect (Gollwitzer), and gives a reason to come back.

### 4.5 Sunday reset ritual
On Sundays (or Monday morning), the Today header gets one extra line + link: "Fresh week — see how last week landed →" (to Progress). Fresh-start effect: people commit to goals at temporal landmarks. Trivial to add; only shows when last week had ≥1 session.

### 4.6 Onboarding → day-1 bridge
"Start day 1 →" currently lands on `/checkin` cold. Add a one-liner on the check-in page when arriving with no prior checkins: "Day 1 — let's set your baseline." (fresh-start framing, zero new screens).

---

## 5. Motivation-science layer (copy + small features)

Already in place: B=MAP next-action, respect-rest, spacing, streaks, why-it-works citations. Add:

1. **Goal-gradient nudge** — when a weekly goal is 1 session away, its pill/ring gets an accent state and copy: "1 more for your 4× goal". People accelerate near completion. (GoalCard + planner `personal_insight` already computes counts.)
2. **Endowed progress** — the daily "X/Y done" counter includes the check-in itself as the first tick ("1/4 — check-in done ✓"). Starting at non-zero measurably increases completion.
3. **Streak insurance, not streak guilt** — if the user marked a Light day or rated the evening "Rough", a missed day shows the streak as "protected 🛡" instead of reset. Aligns with the app's respect-rest principle; loss-framing kills apps like this.
4. **Variable celebration** — rotate the all-done reward: confetti rain / growing sprout animation / compass needle spin / short affirming line. Predictable rewards habituate; variety keeps the dopamine hit (`ConfettiRain` in Plan.tsx becomes one of N).
5. **Identity framing (sparing)** — after hitting a weekly goal 2+ weeks running, the goal card's sub-line becomes identity-based: "You train 4× a week" rather than "goal met". (Atomic-habits identity loop; only on sustained streaks so it stays earned.)
6. **Commit-to-time** — the `🕐 ~9am` pill on suggestions is passive. Make it tappable → creates a ghost block on today's calendar ("planned" status already exists in the schema). Implementation intentions: "at 9am I will X" roughly doubles follow-through vs. vague intent.

---

## 6. Consistency & polish audit

- **Dark-mode sweep**: replace every hard-coded hex flagged in §1.6 with vars (add `--warn-soft`, `--warn-text`, `--success-soft`, `--success-text` to globals.css).
- **Affirmation card** (`Plan.tsx`): its mint gradient is the only element off-palette; restyle with `--primary-soft` + `--accent-soft`.
- **Emoji sizing**: normalize with the §3.3 icon chips.
- **"redo" / "refresh" / "details" links**: unify into one quiet-link style (currently mixed underline/size).
- **Review "study streak" card**: label says study streak but sits beside generic stats — retitle "🔥 streak" and use the longest current streak across categories.
- **Empty states**: give each list empty-state one tiny illustration (single SVG leaf/compass, `--muted` stroke) instead of text-only.

---

## 7. Suggested implementation order

| Phase | Items | Feel |
|---|---|---|
| 1 (one session) | 2.1–2.6 + 6 dark-mode sweep | "app got 2× more polished" |
| 2 | 3.1–3.3 rings/tilt/chips | "app feels dimensional" |
| 3 | 4.1 nav merge, 4.2 time-aware Today | "app feels like a companion" |
| 4 | 4.3 reveal, 4.4 wrap moment, 4.6 bridge | "the loop feels ritual" |
| 5 | 5.1–5.6 science layer, 4.5 Sunday reset | "it pulls me back daily" |
| 6 (optional) | 3.5 fireflies, 3.6 compass rose | delight |

Notes for the implementing agent:
- All motion must respect the existing `prefers-reduced-motion` block in globals.css — extend it for every new animation.
- Stay CSS-first; no framer-motion/Three.js unless a spring genuinely can't be faked.
- This is Next.js 16 — check `node_modules/next/dist/docs/` before touching routing/layout conventions (see AGENTS.md).
- Test every colour change in both light and dark schemes.
