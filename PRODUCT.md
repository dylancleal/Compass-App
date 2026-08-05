# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: university/college-age students building consistent study and gym habits without rigid, guilt-driven scheduling. They want calm daily structure that adapts to their actual energy and readiness rather than a fixed plan they're set up to fail. Comfortable paying for real utility (calendar sync, multiple tracked areas, AI coaching) once it proves itself in the free tier.

## Product Purpose

Lodestone is a daily habit/study/gym companion that shapes each day's plan around a morning check-in (mood, readiness) instead of a fixed schedule. Users track self-defined "areas" (Study and Gym by default, fully renameable to anything), log sessions, build streaks, sync Google Calendar so suggestions never conflict with real commitments, and can ask an AI coach for progress insights. Success is daily return usage driven by the app adapting to the user, not by guilt or streak-shaming.

## Positioning

Distinct from typical habit trackers that rely on guilt, streak-shaming, or rigid fixed schedules. Lodestone's mechanism a guilt-driven competitor couldn't truthfully copy without changing its business model: a genuinely usable free tier (one real area, not a crippled trial), an honest downgrade after the 7-day paid trial (one area stays fully usable, nothing locks out), and calendar-aware suggestions that actively avoid double-booking rather than ignoring the user's real schedule.

## Operating Context

- Native Android app (Capacitor shell loading the live Next.js site at https://mylodestone.app) plus responsive web.
- Daily loop: morning check-in → today's plan/suggestions → log sessions → evening wrap/review.
- Weekly loop: Progress tab (This week / Trends), AI coach insights, streaks.
- Google Calendar OAuth sync (paid tier) drives schedule-aware suggestions and conflict detection.
- Subscription via Stripe (web) and Google Play Billing through RevenueCat (native Android) — $4.99/mo, 7-day free trial.
- Currently pre-launch: finishing Google Play Console setup, about to start the mandatory closed-testing track (12 testers / 14 days) before public release.

## Capabilities and Constraints

- Shares a codebase with Compass, a separate personal-use product for the same developer, switched via `APP_VARIANT` (`lib/appVariant.ts`). Standing constraint, enforced throughout this project's history: Lodestone-specific work must never change Compass's behavior or appearance.
- Backend: Supabase (Postgres + Auth). Sign-in is email one-time-code only — no passwords anywhere in the product.
- AI coach calls Anthropic's API server-side, rate-limited, and the conversation itself is not persisted (ephemeral by design).
- Free tier: one active area, 7-day history/trends window.
- Paid tier ("Lodestone Plus"): both areas active, full history, calendar sync, AI coach deep insights, monthly recap.
- Native Android shell has already been hardened this project (back-button handling, edge-to-edge status bar); the app icon and splash screen were only just fixed from an unbranded placeholder to the real brand mark.

## Brand Commitments

- Name: Lodestone. Tagline: "Study, training, and the pull that keeps you on course."
- Existing visual identity, already locked into submitted Play Store assets this session: a dark "nebula" backdrop (deep green + apricot glow over near-black, twinkling starfield), a geodesic-rock-with-lightning-bolt icon mark, warm off-white (#fffef8) wordmark, Geist typeface.
- These exact assets (app icon, feature graphic, splash screen, screenshots) are already prepared/submitted for the Play Store listing as of this session. Replacing the visual identity has a real, non-trivial cost: redone store assets, a regenerated native icon, and possibly a fresh review.
- The calm, low-saturation dark theme is a stated identity carried through the whole product (not just the sign-in screen) — `components/Starfield.tsx`'s nebula backdrop is deliberately reused across the sign-in screen and celebration states to keep one consistent "world."

## Evidence on Hand

- Full live implementation under `app/` — Today, Calendar, Progress/Trends, Categories/Areas, Settings, onboarding.
- Store listing copy, screenshots, and feature graphic already produced this session, in `store-assets/`.
- No user research, testimonials, or real usage data yet — pre-launch, no users beyond the developer's own testing.

## Product Principles

1. Adapt to the user's actual state (energy/readiness) rather than enforce a fixed schedule — the check-in is the entry point to everything else.
2. Never use guilt, shame, or artificial scarcity as a retention mechanic, including in the free tier — it must stay genuinely usable, not bait.
3. Respect the user's real-world commitments — calendar-aware, conflict-avoiding suggestions are a core promise, not a nice-to-have.
4. Calm, low-stimulation visual and interaction design is a stated identity, not an incidental choice — "improvement" here is not synonymous with louder or busier.
5. Trust and transparency in billing and data — reflected in this session's subscription work: a real free tier, explicit downgrade messaging, and self-serve account deletion.
