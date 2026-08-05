---
timestamp: 2026-08-04T05-50-39Z
slug: components-nativeauthscreen-tsx
---
---
target: components/NativeAuthScreen.tsx
score: 21
score_max: 40
p0_count: 1
p1_count: 3
p2_count: 1
---

# Critique: Lodestone Sign-in screen (components/NativeAuthScreen.tsx + components/AuthGate.tsx)

Method: dual-agent (A: design review · B: detector/browser evidence). Scoping note: a plain browser can never render NativeAuthScreen.tsx (gated behind Capacitor.isNativePlatform(), always false outside the real native shell) — browser testing actually exercises AuthGate.tsx's separate web-fallback form. Both assessments correctly split findings into live-confirmed (web fallback) vs. source-derived (native screen), never conflating the two. One agent was cancelled mid-run by the user and a fresh Assessment A was spawned with Assessment B's already-completed findings folded in as context, avoiding duplicate work.

## Design Health Score: 21/40 — Acceptable

## Design Specificity Verdict
Split. Native (source-derived): genuinely bespoke — the full-bleed NebulaBackdrop, glowing wordmark, and deliberate departure from theme tokens add up to a real brand moment matching the already-submitted Play Store identity. Web fallback (live-tested): structurally generic — a centered card on a flat near-black field, literally the same component Compass renders with different strings. PRODUCT.md calls this "one of the most distinctive screens" — true only of the native version; the web version most non-native users would actually meet first doesn't carry that distinction at all.

## What's Working
1. Native visual identity is real and specific (source-derived) — a distinctive first impression, not a generic template.
2. Cognitive load is well-managed structurally — single-field entry, progressive disclosure, re-displaying the target email so users never recall it.
3. Keyboard focus is visible on the web fallback (live-confirmed by real interaction) — an easy thing to get wrong that this surface got right.

## Priority Issues

**[P0] Failed sign-in renders the literal text "{}" — root cause now confirmed.** Live-reproduced: a failed auth call leaves the user staring at a meaningless `{}` with no indication of what happened. Traced to `setErr(error.message)` at AuthGate.tsx lines 82, 118, 124, 139 with no fallback for a message-less error object — NativeAuthScreen.tsx receives the same string as a prop and just styles it, doesn't sanitize it, so this is a shared defect across BOTH the web fallback and the native screen, not a fallback-only bug. This is the same underlying bug the Onboarding critique found from the outside (a raw "{}" on a failed sign-in attempt) — now confirmed at the exact source. This is the single gate the entire product sits behind. → /impeccable harden

**[P1] The CTA promises a "magic link," but the actual reliable path is typing a code — and native/web have already drifted apart on this.** Web button reads "Send magic link" (live-confirmed), priming a wrong mental model — the code's own comments say the emailed link won't actually authenticate the app in most cases, typing the code is the intended path. Native's identical button already says "Continue" instead (source-confirmed) — the two hand-maintained trees have diverged on exactly the copy point that matters most. → /impeccable clarify

**[P1] Native inputs strip the focus outline with nothing to replace it — a real accessibility regression, worse than the web fallback.** Source-confirmed: both native inputs use `outline-none` with no focus variant — a WCAG 2.4.7 violation for keyboard/switch-control users. The web fallback's equivalent inputs do carry a visible focus ring (live-verified) — the more commonly-shipped native surface is objectively worse here. → /impeccable harden

**[P1] Low-contrast on interactive text.** Primary CTA "Send magic link" at 2.8:1, "Dev login" at 4.3:1 — both under the 4.5:1 minimum. The primary CTA is the one required action on the whole screen. → /impeccable harden

**[P2] Touch targets under 44×44pt with zero horizontal padding on every button in both files.** Live-measured: "Send magic link" 40px tall, "Dev login" 32px tall, both 0px horizontal padding — looks fine only because English strings are short; breaks the moment copy localizes or a user zooms. → /impeccable harden

## Persona Red Flags
- **Jordan (first-timer, most relevant here)**: expects a clickable emailed link per the button copy, but the app actually wants a typed code; if the send call fails, their first-ever interaction with the product is the text "{}".
- **Sam (accessibility)**: 2.8:1 contrast fails AA on the one required CTA; both email inputs rely on placeholder-only labeling with no aria-label (live-verified on web); native's missing focus outline blocks keyboard/switch-control users entirely.
- **Casey (mobile)**: both buttons under the 44pt tap minimum; neither input sets autoComplete="email", blocking iOS/Android autofill that would let her avoid typing entirely.

## Minor Observations
- Flat type hierarchy on web fallback (12/14/16/20px, only 1.7:1 ratio) — the title doesn't dominate enough for a first-impression screen.
- Weak validation: email accepts anything containing "@"; code button enables at 4 digits though the actual OTP length is 8 per source comment — both funnel into the same opaque-error problem rather than a helpful inline hint.
- The web card sits correctly centered on a tall mobile viewport but leaves a large, unfilled dark void above/below — no logo, no illustration — reinforcing how far it's drifted from the nebula identity.
- Native's disabled-button state is only opacity-50, against several already-translucent text elements — disabled vs. enabled may read as barely distinguishable against the glowing backdrop (source judgment, unverified visually).

## Questions
- If typing the code is the actually-reliable path per the code's own comments, should either screen still lead with "magic link" language at all?
- What should a user see, right at this gate, when the failure has nothing to do with them? Right now: "{}"
- Does the plain web fallback still belong to the "one consistent nebula world" PRODUCT.md describes, or has it quietly become a second, unbranded product that most non-native users meet first?
- Now that native and web have already diverged on the one thing that should be identical (the CTA's promise), is a single shared component with two rendering modes safer going forward than two hand-maintained trees?
