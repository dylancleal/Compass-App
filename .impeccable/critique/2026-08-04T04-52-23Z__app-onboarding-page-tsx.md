---
timestamp: 2026-08-04T04-52-23Z
slug: app-onboarding-page-tsx
---
---
target: app/onboarding/page.tsx
score: 24
score_max: 40
p0_count: 1
p1_count: 2
p2_count: 2
---

# Critique: Lodestone Onboarding flow (app/onboarding/page.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence). **Methodology limitation**: neither assessment could complete a live browser pass on the actual onboarding steps (StepPick/StepSetup/StepPreview) — the only dev-auth shortcuts in the codebase (`/api/dev-auth`, `/api/reviewer-auth`) are both hardcoded to specific already-onboarded emails, and no real inbox was available to OTP-verify a fresh address. Both assessments correctly refused to force the test onto an already-onboarded account (would have tested the wrong thing) and fell back to thorough source review instead, explicitly labeling inferred vs. confirmed claims. Findings below are still well-grounded (especially the P0, cross-referenced directly from source), but a supplementary live visual pass is possible and worth doing separately — I have a working fresh-account mechanism (the Play Store reviewer test account) neither agent knew about.

## Design Health Score: 24/40 — Acceptable

## Design Specificity Verdict
The 3-step shape (pick areas → configure each → preview week) is competent but generic. The two things PRODUCT.md calls the product's actual moat — calendar-aware conflict avoidance and the check-in-as-entry-point mechanic — get zero onboarding real estate; the user is onboarded into categories, then dropped cold onto `/checkin` with no framing for what it is. The domain-specific setup questions (UTR rating, enrolled units, weekly-goal pills) are a genuine bright spot sitting inside an otherwise interchangeable wizard shell.

## What's Working
1. Tile picker restraint — `VISIBLE_TILES` correctly narrows to 2 options for the study variant via `APP_VARIANT.onboardingTiles`, well under the working-memory ceiling. Deliberate, product-aware.
2. Domain-aware setup questions genuinely tailor the flow per category type, every advanced field marked optional with plain-language hints.
3. `StepPreview` runs the real planner engine, not mock content — an honest preview of what the user will actually get.

## Priority Issues

**[P0] The intro tour hijacks navigation seconds after onboarding finishes.** `completeOnboarding` routes to `/checkin`; `IntroTour` (mounted globally) auto-shows the instant `onboarding_completed_at` is set and immediately redirects to `/` — away from the check-in the user was just sent to — into an unrelated 5-7 step spotlight tour. The user's first post-onboarding action becomes a hijacked redirect, directly undercutting the calm reassurance `StepPreview` just built. → /impeccable shape

**[P1] No way back, anywhere, in a 3-step + N-substep flow.** Confirmed no back control exists in StepPick, StepSetup, or StepPreview — a user who picks the wrong tile has no path back short of abandoning. → /impeccable clarify

**[P1] Category-creation failures are silently swallowed.** A broad `catch { /* continue */ }` treats a benign duplicate-name race identically to a genuine network/auth failure — a category can simply fail to appear with zero user-facing signal. → /impeccable harden

**[P2] Primary CTAs give zero loading feedback.** "Continue →" and "Start day 1 →" await multiple mutations/refetches with no pending state — a slow connection risks a double-tap or a user believing the tap didn't register. → /impeccable harden

**[P2] Sign-in gate renders a raw "{}" as the error message.** Confirmed live by both assessments independently: submitting a fresh email through "Send magic link" produced a literal `{}` glyph instead of a readable error — the front door to onboarding showing the same error-handling gap found elsewhere in the codebase. → /impeccable harden

## Persona Red Flags
- **Jordan (first-timer)**: finishes the wizard, taps "Start day 1," lands on an unexplained check-in screen, then gets yanked back to "/" by the intro tour before seeing what a check-in even looks like — two competing "first experiences" stacked with no clear "real" one.
- **Casey (mobile)**: the macro step (pick/setup/preview) lives in local React state, not URL or persisted settings — a backgrounding/refresh mid-flow would drop Casey back to StepPick with categories already half-created in the DB.

## Minor Observations
- The "side-tab" pattern appears here too (StepPreview's day cards) — the 4th of 6 surfaces checked. Detector flags a nuance worth weighing: here it's used consistently as a day-marker across a repeated list, which may read as more systemic/deliberate than a stray highlighted callout — still worth folding into whatever single treatment the redesign settles on.
- No overall progress indicator across the three macro steps — only internal dots within Setup.
- The "Something else" custom category always gets icon ✨ and color slate — no personalization for the input most likely to be personally meaningful.
- `CategorySetupSheet.tsx` scanned clean (0 detector findings).

## Questions
- If check-in is really "the entry point to everything else," why does onboarding never mention it before routing straight into it?
- Could the intro tour's content fold into (or trigger after) onboarding's own preview step, removing the double-onboarding sequencing problem entirely?
- Where would Lodestone's actual point of difference (calendar-conflict avoidance) get onboarding real estate, even just as a teased "coming next" line?
