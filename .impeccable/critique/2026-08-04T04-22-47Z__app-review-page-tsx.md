---
timestamp: 2026-08-04T04-22-47Z
slug: app-review-page-tsx
---
---
target: app/review/page.tsx
score: 18
score_max: 36
p0_count: 0
p1_count: 3
p2_count: 2
---

# Critique: Lodestone Progress "This week" tab (app/review/page.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence).

## Design Health Score: 18/36 (heuristic #5 Error Prevention marked n/a — read-only page) — Acceptable, low end

## Design Specificity Verdict
The `protectedStreak` mechanic (a rest day backed by a "light"/"rough" check-in still preserves the streak) is genuine, principle-driven product thinking — the mechanical proof of "never use guilt as retention," not just copy. Everything else (stat row, by-area list, next-days preview) is the generic weekly-recap-dashboard template with the palette applied on top. The one distinctive idea (the 🛡 shield) is currently unexplained, so it reads as a stray emoji rather than a designed moment.

## What's Working
1. protectedStreak logic — real mechanical proof of the "respect over guilt" principle.
2. Per-category cards are information-dense without clutter: accent border, icon, inline goal progress, all in a compact row.
3. ShareRecapCard is correctly gated off entirely when there's nothing to show — avoids an obviously bad share state.

## Priority Issues

**[P1] "Next week preview" is mislabeled and overlaps "this week."** `buildWeekPreview` starts its 7-day window at today, not next Monday — confirmed live: on a Tuesday, the "Next week preview" section opens with "TUE," the same day as the "This week" stats above it. Directly touches the product's core calendar-precision claim. → /impeccable clarify

**[P1] Redundant, contradictory empty state.** With active categories and zero sessions, the page shows both a full "By area" list (each card reading "0 sessions") AND a separate "No sessions logged this week yet" banner — same fact stated twice in two visual registers. → /impeccable clarify

**[P1] The "side-tab" AI-tell pattern recurs a third time** ("By area" cards, `border-left: 3px + border-radius: 20px`) — now confirmed on all three surfaces critiqued so far (Today, Calendar, Progress). This is no longer a per-component nit; it's a systemic pattern worth fixing once across the design system. → /impeccable layout or /impeccable typeset

**[P2] Contrast failures, 6 instances.** Active tab-pill text at 2.8:1 and category-tag pills at 4.3:1 (×5) — both under the 4.5:1 minimum. → /impeccable harden

**[P2] Touch targets under the 44×44pt minimum.** Nav pills measured 28px tall, the This-week/Trends toggle 32px tall — on a native-Android-primary product, this is the only interactive control on the page and it's undersized for one-handed use. → /impeccable adapt

## Persona Red Flags
- **Alex (power user)**: can't drill from a category into its history, can't change the viewed week from this page — exhausts everything the page offers in under 10 seconds.
- **Casey (mobile)**: the nav bar clips "Today" to an unreadable sliver at 375px with no scroll-affordance hint — same shared-chrome issue seen on Today.
- **Sam (accessibility)**: the 🛡 shield has no aria-label (screen reader announces the raw glyph); stat number + label aren't landmarked together as one unit.

## Minor Observations
- No distinction between "loading" and "genuinely empty" — sessions/categories/checkins all default to `[]`, so a slow fetch renders pixel-identical to a true quiet week.
- Zero-state formatting inconsistent within one row: sessions/time render "0", streak renders "—".
- `overused-font` (Geist) flagged by detector — likely false positive, same reasoning as Calendar/Today (single deliberate font, not a mashup).
- Monthly recap is double-gated (paid tier AND totalSessions > 0) — a brand-new paid subscriber with zero sessions this month sees no recap at all, a missed moment to reinforce what they just paid for.
- Goal badges/progress bars weren't exercised in testing (neither test account had weekly_goal metadata set) — worth a manual spot-check.

## Questions
- What would this page look like showing only one explanation for an empty week, never both at once?
- Does "next 7 days" belong on Progress at all, given Today/Calendar already own that job?
- What would it take to make the protected-streak shield a felt moment of reassurance instead of an unexplained emoji?
