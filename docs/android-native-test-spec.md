# Android native shell — test & hardening spec

Self-contained spec for working through the known Android-specific risks in
Lodestone's Capacitor shell **without needing the user's input**. Everything
here is testable from the terminal against the already-running emulator; no
Android Studio interaction is required (Gradle CLI covers rebuilds).

## Context you need before starting

- **What the app is**: Lodestone is a Next.js 16 web app (SSR + API routes, no
  static export) wrapped in a Capacitor Android shell. The shell just points a
  WebView at a URL (`capacitor.config.ts` → `server.url`); there is no bundled
  JS. Production URL is `https://mylodestone.app`; for local testing the
  emulator is pointed at the dev server on the host machine via
  `http://10.0.2.2:3000` (the emulator's fixed alias for host localhost).
- **Variant gating**: this codebase builds two products. `NEXT_PUBLIC_APP_VARIANT=study`
  = Lodestone (the commercial app, what the Android shell wraps); unset =
  Compass (the user's personal app — must never be affected by changes here).
  All Lodestone-specific behavior is gated on `APP_VARIANT.id === "study"`
  (`lib/appVariant.ts`). `.env.local` already sets the study variant for local dev.
- **Native plugins**: `@capacitor/app` (back button) and `@capacitor/status-bar`
  are installed. **Capacitor's plugin auto-discovery does not work in this
  project** (root cause never found — plugin classes compile into the APK but
  don't register at runtime, JS calls throw `"X" plugin is not implemented on
  android`). Every plugin must be explicitly registered in
  `android/app/src/main/java/app/mylodestone/android/MainActivity.java` via
  `registerPlugin(...)` before `super.onCreate(...)`. If you add a plugin and
  forget this, it will silently fail exactly like that.
- **Predictive back is opted out** (`android:enableOnBackInvokedCallback="false"`
  on `<application>` in `AndroidManifest.xml`). Do not remove it — with it on,
  Android 15 handles back itself and Capacitor's `backButton` listener never
  fires (targetSdk is 36).

## Standing constraints (do not violate)

- **Never** weaken `app/api/dev-auth/route.ts`'s `NODE_ENV === "development"`
  gate. It uses the service-role key to mint a session for any email; it must
  stay dev-only, no native-app exception.
- **Never** commit a `capacitor.config.json` (it's gitignored under `android/`)
  or any config pointing at `10.0.2.2` — the dev-server override is applied
  only via the `CAPACITOR_SERVER_URL` env var at sync time.
- **Do not set up Firebase/FCM or any service needing the user's account or
  credentials.** If a finding's proper fix needs that (push notifications
  will — see item 3), scope your change to graceful degradation + a written
  recommendation, and stop there.
- Don't touch `.env.local` beyond reading it.
- Compass regression check on any shared-code change: nothing here may change
  Compass's web behavior. When in doubt, gate on `Capacitor.isNativePlatform()`
  (via `lib/platform.ts`'s `useIsNativePlatform()` in React code — resolve it in
  an effect, never at render time, to avoid hydration mismatches) or on
  `APP_VARIANT.id === "study"`.

## Command reference (all verified working on this machine)

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"

# Is the emulator up? (If empty, STOP and report — you cannot launch the
# emulator GUI yourself; ask for it to be opened. Everything else is on you.)
$ADB devices

# Real Android BACK key (do NOT trust the IDE's Escape mapping)
$ADB shell input keyevent 4

# Screenshot the device — then Read the png to actually look at it.
$ADB exec-out screencap -p > /tmp/emu.png

# Type text / tap / swipe
$ADB shell input text "hello"
$ADB shell input tap 400 900
$ADB shell input swipe 400 1400 400 400 300   # scroll down

# Cold-kill and relaunch the app
$ADB shell am force-stop app.mylodestone.android
$ADB shell am start -n app.mylodestone.android/.MainActivity

# Network off/on (emulator)
$ADB shell svc wifi disable && $ADB shell svc data disable
$ADB shell svc wifi enable  && $ADB shell svc data enable

# Currently installed APK's manifest (ground truth for "did my native change
# actually get installed" — use this before blaming anything else):
APK=$($ADB shell pm path app.mylodestone.android | sed 's/^package://' | tr -d '\r')
$ADB pull "$APK" /tmp/base.apk
"$HOME/Library/Android/sdk/build-tools/36.1.0/aapt2" dump xmltree /tmp/base.apk --file AndroidManifest.xml
```

Rebuild-and-install loop after any **native** change (Java, manifest, plugin
added, `capacitor.config.ts`) — JS/React changes need none of this, the dev
server hot-reloads into the WebView:

```bash
cd /Users/dylancleal/Documents/Compass
CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew installDebug && cd ..
"$HOME/Library/Android/sdk/platform-tools/adb" shell am start -n app.mylodestone.android/.MainActivity
```

The dev server must be running (`npm run dev`, port 3000) for the app to load
anything. If the app shows `ERR_CONNECTION_REFUSED`, that's the dev server
being down, not a bug.

Logcat does **not** surface WebView console output in this environment — it
was tried and came up empty. If you need JS-side visibility on-device, render
a temporary fixed-position debug element on screen and screenshot it (this is
how the plugin-registration bug was found), and remove it before committing.

## Workflow

Work through the items in order. One branch + PR per item that results in a
code change (branch off latest `main`, re-fetch before each — the user merges
fast). Items that turn out fine, or are report-only, go in a single summary
document at the end: `docs/android-test-results.md` (new PR), with a
screenshot-verified pass/fail per item and recommendations. Run
`npx tsc --noEmit` before every commit. Never `git add -A` — stage files
explicitly (there are untracked scratch files in the repo that must not land).

---

## 1. Back button/gesture — deep-nesting + root-page edge cases

**Status: mostly fixed, edge cases unverified.** The listener
(`components/AndroidBackButton.tsx`) is registered and confirmed working for
one level (Progress → Today) via real adb BACK keys.

Known weakness to test first: the handler uses `window.history.length > 1`,
but `history.length` counts *total session entries, not entries behind the
current position*. Reproduce: Today → Settings → BACK (returns to Today) →
BACK again. If the app neither exits nor moves (dead back button), that's this
bug: length stays > 1 while there's nothing behind the pointer, so
`history.back()` no-ops.

**Fix direction if confirmed**: Capacitor's `backButton` event passes
`{ canGoBack }` computed natively from the WebView's real back stack — use
`App.addListener("backButton", ({ canGoBack }) => canGoBack ? window.history.back() : App.exitApp())`
instead of inspecting `history.length`.

Also verify: 2+ levels deep (Today → Progress → Trends tab → back → back),
and that BACK from a freshly-launched Today exits cleanly. Immediate exit from
Today is the accepted behavior — do not build a "press again to exit" toast.

## 2. Bottom gesture-bar overlap

`overlaysWebView: false` (status-bar plugin) only reserves the **top**. The
bottom gesture bar under Android 15+ edge-to-edge may overlay page content.

Test: navigate to a long page (`/trends`, or Settings), scroll to the very
bottom (`input swipe` repeatedly), screenshot, and look at whether the last
row of content can scroll fully clear of the gesture bar or is permanently
clipped under it. Check on both a page with bottom padding and the sign-in
screen (`components/NativeAuthScreen.tsx` already pads with
`env(safe-area-inset-bottom)` — confirm that actually resolves to a nonzero
inset on-device by comparing its bottom gap to a non-padded page).

**Fix direction**: add `paddingBottom: calc(existing + env(safe-area-inset-bottom))`
to `<main>` in `app/layout.tsx` (there is already a `.safe-bottom` utility in
`app/globals.css`). If `env()` resolves to 0 inside the WebView (possible —
the top inset needed native handling), the equivalent native-side fix is in
scope: it must apply to the bottom only, without re-breaking the top.

## 3. Push notifications inside the wrapped app — check FIRST, likely broken

Web Push was built against browser service workers (`public/sw.js`,
`lib/pushNotifications.ts`, cron sender at
`app/api/cron/send-reminders/route.ts`). **Android System WebView does not
implement the Web Push API**, so expectation: `pushSupported()` returns false
in the native app and Settings → Notifications shows the "not supported in
this browser" card.

Test: in the app, Settings → Notifications; screenshot what renders. Also
verify nothing crashes on that screen.

**In-scope fix**: if unsupported (expected), change the native-app rendering of
that section to honest, useful copy — e.g. "Reminders aren't available in the
Android app yet — they work today from the browser at mylodestone.app" — gated
on native platform, web behavior unchanged.
**Out of scope**: real native push needs `@capacitor/push-notifications` +
Firebase Cloud Messaging, which requires the user to create a Firebase
project. Do not start this. Write it up in the results doc as the follow-up,
including that the server side (`push_subscriptions` table + cron) would need
an FCM sender path alongside the existing web-push one.

## 4. Session persistence across cold restart

Test: confirm signed in (screenshot Today), then `am force-stop`, relaunch via
`am start`, screenshot. Expect: still signed in, lands on Today, no sign-in
screen and no onboarding redirect. WebView localStorage should persist, but
verify rather than assume. Also confirm the theme stays dark after restart.

If sign-in is lost: check whether localStorage survived at all (temporary
on-screen debug element reading `localStorage.length`) before touching auth
code — the fix differs completely depending on whether storage was wiped
(WebView data config issue, native side) or Supabase's session refresh failed
(JS side, likely token refresh on resume).

## 5. Background → foreground resume

Test: HOME key (`input keyevent 3`), wait ~2 minutes, relaunch from recents
(`am start` works). Expect: app resumes showing current state, no frozen
white screen, no stale "Loading…". Then a longer variant if practical (10+
min) — Android may kill the process in between, which turns this into item 4's
path and should behave identically to it.

**Fix direction if stale**: `@capacitor/app`'s `resume` event (plugin already
installed + registered) → trigger a React Query `invalidateQueries()` on
resume, mounted once near `AndroidBackButton`'s pattern. Keep it
native-gated.

## 6. Keyboard covering inputs

Test: sign-out isn't necessary — use any writable input reachable while signed
in (Settings → "Your name", or QuickAddTask on Today). Tap the field, wait for
the keyboard, screenshot: is the focused input visible above the keyboard, or
hidden under it? Also specifically the OTP flow if reachable (sign-in screen)
since that's the highest-stakes input.

**Fix direction**: `android:windowSoftInputMode="adjustResize"` on the
`<activity>` in `AndroidManifest.xml` is the standard Capacitor answer.
Edge-to-edge on SDK 35+ complicates `adjustResize`; if the manifest flag alone
doesn't do it, prefer the WebView getting real viewport resize events over any
JS scroll-hacking.

## 7. Other device profiles / API levels

The only AVD exercised so far is a Pixel-class API-36 image. Try to cover:
one small/older profile (API 30-ish) and one different form factor if images
are available locally. Check what's installed:
`$HOME/Library/Android/sdk/cmdline-tools/*/bin/avdmanager list avd` (also try
`emulator -list-avds`; the emulator binary is at
`$HOME/Library/Android/sdk/emulator/emulator`). You may launch an existing AVD
headlessly: `emulator -avd <name> -no-window -no-audio &` then use adb as
normal (screenshots still work headless).

If no second AVD exists and system images would need downloading (slow,
GB-scale), skip creating one — record in the results doc exactly which
image was tested and that other profiles remain unverified. Do not spend an
hour downloading system images.

Per-profile checks (fast pass): status bar not overlapping header; bottom not
clipped; sign-in screen renders full-bleed; back button behaves.

## 8. Network loss mid-use

Test: with the app open and signed in, kill connectivity (`svc wifi disable`,
`svc data disable`), then navigate between tabs and pull-refresh-like
interactions. Screenshot what the failure actually looks like (expected:
in-app navigations partially work from cache/React Query memory; a hard
reload shows Chromium's error page). Re-enable network, confirm the app
recovers without a force-stop.

**Report-only**: whatever is found goes in the results doc with screenshots.
A designed offline/error screen (Capacitor `server.errorPath` pointing at a
bundled fallback page, plus an in-app online/offline listener) is the likely
future fix — recommend, don't build, unless the recovery path is actually
broken (app permanently wedged after network returns), in which case a minimal
fix (e.g. reload-on-online listener) is in scope.

---

## Done criteria

- Items 1–6 each either verified-pass (screenshot evidence) or fixed via a
  small PR + re-verified on-device.
- Items 7–8 verified as far as local resources allow, findings written up.
- `docs/android-test-results.md` PR'd: per-item pass/fail, evidence,
  what was fixed where (PR links), and the two known follow-ups requiring the
  user (FCM push; additional AVD coverage if skipped).
- Web (both variants) unaffected: `npx tsc --noEmit` clean, no behavior change
  outside `Capacitor.isNativePlatform()` / study-variant gates.
