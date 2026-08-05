---
timestamp: 2026-08-04T04-34-45Z
slug: app-trends-page-tsx
---
---
target: app/trends/page.tsx
score: 22
score_max: 40
p0_count: 0
p1_count: 3
p2_count: 2
---

# Critique: Lodestone Progress "Trends" tab (app/trends/page.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence).

## Design Health Score: 22/40 — Acceptable

## Design Specificity Verdict
Grounded, with one real crack. Domain-specific panels (Tennis skill-confidence, Uni work session-type breakdown, Gym metric trends) are genuine product thinking, not one templated stats page. But they're selected by exact string match on category name — PRODUCT.md promises categories are "fully renameable to anything," so renaming "Uni work" silently drops to the generic panel with zero explanation. The design promise and the implementation are out of sync.

## What's Working
1. GoalCard — ring progress + stepper + adaptive badge + copy that never shames. Strongest single piece of specificity on the page.
2. CoachPanel's guided entry (suggested-question chips) lowers the blank-textbox barrier; error state is honest plain language.
3. Domain-tailored per-category panels are real product thinking, not a reused template.

## Cross-surface finding (important)
Assessment A explicitly checked for the "side-tab" pattern found on all 3 prior surfaces (Today, Calendar, This-week) — it does **not** appear here. Instead, this page uses two *other* treatments for the same underlying idea ("this is smart/AI-generated content"): CoachPanel is a flat card, ForecastCard uses a full-perimeter border. So the issue isn't a single overused pattern — it's **three different, inconsistent visual treatments for conceptually the same "insight" content** across the app. That's arguably the more important finding for the eventual redesign: not "stop using side-tab everywhere," but "pick one insight-content treatment and use it everywhere."

## Priority Issues

**[P1] Renaming a category silently drops its tailored panel.** Panels are keyed off exact `cat.name` strings; the product explicitly promises full renaming. `lib/categorySetup.ts` already has a `detectDomain()` helper used elsewhere for this exact purpose — not currently used here. → /impeccable harden

**[P1] Y-axis labels clip and become misreadable on mobile.** Confirmed live at 375px: "240" reads as "40", "300" reads as "00" on both category area charts — a user could genuinely misread their own tracked minutes, not just a cosmetic nit. → /impeccable harden

**[P1] Two near-identical "sessions per week" charts stack in the same scroll for paid users.** An 8-week bar chart is immediately followed by a 26-week bar chart showing the same single-spike shape — the deepened-value payoff for subscribing reads as redundant scroll instead. → /impeccable distill

**[P2] Activity heatmap overflows off-screen with no scroll affordance.** Only ~14 of 28 days visible at 375px, scrollbar hidden, no fade/chevron cue — a first-time mobile user likely believes the visible half is the entire 28-day history. → /impeccable polish

**[P2] Goal-progress bars are illegible at 0%.** Missing `track` prop falls back to background-matching color; combined with 0%-width fill this renders as an undifferentiated flat rectangle rather than a legible control on any fresh account. → /impeccable polish

## Detector false positive (flagged for transparency)
`ai-color-palette: "Cyan neon on dark background"` fired repeatedly but the actual computed colors are dark-green/gold on light surfaces (`#0f6e56` on `#e1f5ee`, `#e0b877` on transparent) — no cyan anywhere in the codebase's palette. The detector appears to be comparing against the page's dark theme mode rather than each element's local background. Not a real issue.

## Persona Red Flags
- **Alex (power user)**: no custom date ranges anywhere, no export/share (unlike This-week's ShareRecapCard); the duplicate 8wk/26wk charts cost real re-reading time.
- **Jordan (first-timer)**: "RPE" appears with zero explanation; renaming a category silently loses its tailored charts with no message why.
- **Sam (accessibility)**: heatmap cells encode data almost entirely via opacity on plain divs with no tabIndex/role — unreachable by keyboard, and the low-opacity "no sessions" cells likely fail contrast outright.

## Minor Observations
- The 3-day momentum forecast shows a flat "5/5/5" (apparent scale-ceiling clamp) while its own callout claims "+0.4 pts" — the visual and the promised insight contradict each other, a bad look for a feature meant to build AI-coach trust.
- `BarTrend` has no empty state (unlike LineTrend/AreaTrend) — a zero-session week shows bare axes, reading as a possible loading glitch.
- Additional real `low-contrast` instances beyond what's already listed elsewhere: 2.8:1 tab-pill text, 3.7:1 button text.
- `overused-font` (Geist) flagged again — same low-signal caveat as other surfaces.

## Questions
- Should Trends' CoachPanel/ForecastCard adopt whichever "insight" treatment wins, or does the pattern need to be deliberately scoped to specific surfaces rather than universal?
- Does an 8+ section stacked scroll for paying users still feel calm, or has "reward the subscriber with more" become "reward the subscriber with more scrolling"?
- Should specialized visualizations key off a stored domain/kind field set at category creation, rather than the display name, so renaming never silently degrades the experience?
