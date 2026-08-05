---
timestamp: 2026-08-04T04-42-30Z
slug: app-settings-page-tsx
---
---
target: app/settings/page.tsx
score: 28
score_max: 40
p0_count: 0
p1_count: 1
p2_count: 4
---

# Critique: Lodestone Settings page (app/settings/page.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence). Note: CLI static scan came back fully clean (0 findings) while the browser/DOM scan found 20+ real issues — confirms the CLI pass alone is not sufficient evidence of a clean page; runtime-computed contrast, nesting, and font-usage only surface in the browser pass.

## Design Health Score: 28/40 — Good (highest of any surface critiqued so far)

## Design Specificity Verdict
Mixed. Copy and backdrop are genuinely authored ("Make Lodestone yours," nebula background throughout, Subscription copy correctly branching by plan state). Structurally it's a conventional stacked-card settings page indistinguishable from any subscription app's settings screen. The "side-tab" pattern is absent here too — now confirmed missing on 2 of 5 surfaces (Trends, Settings), consistent with it being confined to AI-suggestion-adjacent surfaces specifically, which may be intentional but is worth the team confirming rather than assuming.

## What's Working
1. Subscription state branching — free/trial/paid/past_due each get distinct, correctly-worded copy and the right CTA.
2. Delete-account flow — two-step disclosure, typed "DELETE" to arm the button, native-billing warning shown only when relevant.
3. Calendar sync feedback — explicit "Synced — found 0 events. Wrong Google account?" instead of an ambiguous silent success.

## Priority Issues

**[P1] Weekly Schedule ignores the user's actual Areas.** `SCHEDULE_ROWS` hardcodes Study/Gym/Tennis independent of the real `categories` list. On the tested account (renamed "Study"→"Uni work", no Tennis area at all), the page still shows a live, toggleable "Study days" and "Tennis days" row for categories that don't exist — directly contradicts the page's own "Make Lodestone yours" promise and the product's stated renaming flexibility. → /impeccable clarify

**[P2] Auto-saved fields give no save confirmation or error feedback.** Name, Area name/icon, and Planner-weight sliders all mutate on blur/change with nothing shown on success or failure — no toast, checkmark, or inline error, unlike push/billing mutations elsewhere on the same page which do surface errors. → /impeccable harden

**[P2] Native `window.confirm()` breaks the crafted visual identity.** Area deletion uses the browser's unstyled native confirm dialog, clashing with the deliberately-designed dark theme used for every other confirmation on the page — including the much more careful Delete Account flow two sections down. → /impeccable polish

**[P2] Touch targets under the 44×44pt minimum on the primary mobile surface.** Weekly Schedule's day-toggle circles are 32×32px packed 7-across; Areas' ↑/↓/✕ controls are similarly small glyph buttons — both under platform guidance on a product whose primary surface is native Android. → /impeccable harden

**[P2] Real contrast failures beyond the likely-false-positive cluster.** Primary buttons/badges (Add calendar, Manage billing, Replay tour, Active badge) at 2.8:1 and 4.3:1, both under the 4.5:1 minimum. (The largest detector cluster — 9 hits on the Areas color-swatch buttons — is likely a false positive: those render as plain color circles with no visible text, so the flagged pairing is almost certainly a visually-hidden accessibility label, not a real visible-contrast defect.) → /impeccable harden

## Persona Red Flags
- **Jordan (first-timer)**: renames "Study" to "Uni work," feels good about it, then hits Weekly Schedule and sees "Study days"/"Tennis days" for categories that don't match anything they set up — may conclude the rename silently failed.
- **Sam (accessibility)**: day-toggle buttons render only "S"/"M"/"T" with no aria-label — Sunday and Saturday both announce identically as "S". Planner-tuning slider labels are sibling spans, not associated `<label>`s, so a screen reader landing on the range input may get no accessible name at all.
- **Casey (mobile)**: 32px day-toggle circles and small glyph controls are easy to mis-tap one-handed; this is a 10-section continuous scroll with no anchor/jump nav, so flipping one notification toggle mid-commute means scrolling past 6+ unrelated sections.

## Minor Observations
- Billing/checkout/sync errors render the raw thrown `Error.message` verbatim with no friendly fallback — one bad Stripe/network string from a jarring, off-tone message.
- `line-length` ×2 (~87-88 chars/line) on the Weekly-schedule and Danger-zone description paragraphs.
- `nested-cards`: the Google Calendar row renders as a card nested inside the Calendar-connections card.
- `overused-font` (Geist) — same low-signal caveat as other surfaces, likely a deliberate single-font choice, not a defect.
- Theme toggle communicates current state (light/dark/system) only via hover title, with no visible on-screen label — a sighted first-time user can't tell current state without hovering or clicking blind.
- The past_due (payment issue) Subscription state uses the same visual weight as healthy Active, differing only by pill color — a real billing problem doesn't escalate much visually.

## Questions
- What would it look like if Weekly Schedule read from the same `categories` list Areas already renders above it, so a rename anywhere instantly retitles its schedule row?
- Would the "no Save button, auto-save on blur" pattern feel trustworthy if every save confirmed itself the way push-notification errors already do?
- Given this is the one page explicitly about personalization, does a hardcoded, unrenamable "Tennis" row belong here at all?
- Would this page work better split into 2-3 shorter screens (Account & Appearance / Planner & Areas / Billing & Danger Zone) than one long scroll, given the product is mobile-first?
