---
timestamp: 2026-08-04T04-13-43Z
slug: app-calendar-page-tsx
---
---
target: app/calendar/page.tsx
score: 23
score_max: 40
p0_count: 2
p1_count: 3
p2_count: 2
---

# Critique: Lodestone Calendar page (app/calendar/page.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence). Data caveat applied per user instruction: the seeded test account has messy sync data producing an inflated conflict count (44 groups / 201 raw detector findings) — neither assessment treated the raw count as a finding; both evaluated the design pattern for handling conflicts, which holds regardless of count.

## Design Health Score: 23/40 — Acceptable

## Design Specificity Verdict
The chrome is genuinely authored: dark nebula theme, warm-green primary, one consistent amber/rose state language reused identically across ConflictBanner, BlockChip, QuickAddSheet, and the block-detail modal — a real design system. But the content pattern (hour-row week grid + flat agenda + generic "+Add") is interchangeable with any calendar app, and the unbounded conflict banner directly contradicts the "calm, low-stimulation" product principle — this is the most brand-incoherent page found so far.

## What's Working
1. One consistent conflict/destructive color system reused across every conflict-touching component.
2. Proactive error prevention: QuickAddSheet warns "Overlaps 'X'" live, before submit.
3. Specific, well-written sync diagnostics ("found 0 events — wrong account?", per-error-code OAuth messages).

## Priority Issues

**[P0] Event-title text is nearly invisible — 1.2:1 contrast.** Detector confirmed `#e8ede7` on `#fffdf8` on primary event-title text (`p.truncate.text-sm.font-medium`) — the worst contrast failure found across any surface so far, far below the 4.5:1 minimum. → /impeccable harden

**[P0] Conflict banner has no cap, collapse, or progressive disclosure.** Structurally unbounded — confirmed pushing the actual week grid 2,773px down (mobile) and Agenda's "Today" heading 5,259px down, at both 375px and 1280px widths. Not test-data-specific: any real account with recurring double-booked events hits the same wall. → /impeccable clarify

**[P1] Calendar blocks are entirely inaccessible.** Confirmed via accessibility tree: zero blocks are keyboard-reachable or screen-reader-labeled — BlockChip has no role/tabIndex/aria-label. The core content of this page is a dead zone for keyboard/SR users. → /impeccable harden

**[P1] Destructive actions (Remove, Delete) fire instantly with no confirm or undo.** One mistap permanently deletes a real calendar commitment — contradicts the "respect real commitments" product principle. → /impeccable harden

**[P1] The "side-tab" AI-tell pattern recurs here too** (AgendaView.tsx:68, colored left-border + soft background) — same signature flagged on Today. Two-for-two surfaces so far; worth treating as a systemic pattern to fix once across the design system, not per-component. → /impeccable layout or /impeccable typeset

## Persona Red Flags
- **Casey (mobile)**: opens Calendar to check today's plan, scrolls through screens of amber rows before reaching anything resembling "today"; Week view also demands horizontal scroll on top of that.
- **Sam (accessibility)**: cannot tab to or activate a single calendar block; conflict-resolution buttons are reachable, the calendar surface itself is not.
- **Jordan (first-timer)**: a first real Calendar sync commonly produces overlapping events from recurring-meeting edits — an unexplained wall of "conflict" warnings with no context reads as "the app is broken."

## Minor Observations
- Mobile Week grid shows ~4.3 of 7 days with hard-truncated chip titles ("Gy…", "Wo…") — condense to 3-day mobile default or reconsider Agenda as mobile default.
- Tapping a block opens a detail modal with zero conflict context or resolve path — disconnected from the top banner's resolution flow.
- Undersized text: hour-axis labels and event time labels render at 10px, under the 11px floor.
- `overused-font` (Geist) flagged by detector — likely false positive, it's Next.js's own default single font, not a mashup; detector's allowlist just doesn't cover localhost.
- `+Add` button placement (always reachable in header) and the Week grid's restrained "Today" indicator are well executed — the chrome honors the calm identity even where the content below doesn't.

## Questions
- Should sync itself deduplicate before writing conflicting blocks, so this banner is rarely needed regardless of account?
- What would a "calm" conflict resolution look like — a single summary card opening a focused one-at-a-time flow instead of an ever-growing list competing with the calendar for the page?
- Does Week need to be the mobile default given the scroll + truncation there, or would Agenda serve the mobile-first persona better?
