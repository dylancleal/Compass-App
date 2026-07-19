# Android native shell — test results

Results of working through `docs/android-native-test-spec.md` end to end on
the Pixel_8 AVD (API 36, arm64), against the local dev server via the
`CAPACITOR_SERVER_URL=http://10.0.2.2:3000` override. All verification was
live on-device via `adb` (real `KEYCODE_BACK` events, `am force-stop`/`am
start`, `svc wifi/data disable`, screenshots) — not just the emulator's
Escape-key mapping, which earlier in this project's history turned out not to
be equivalent.

## Summary

| # | Item | Result | PR |
|---|---|---|---|
| 1 | Back button deep-nesting | **Bug found & fixed** | [#76](../../pull/76) |
| 2 | Bottom gesture-bar overlap | Pass, no fix needed | — |
| 3 | Push notifications in WebView | Copy improved | [#77](../../pull/77) |
| 4 | Session persistence, cold restart | Pass, no fix needed | — |
| 5 | Background/foreground resume | Pass, no fix needed | — |
| 6 | Keyboard covering inputs | Pass, no fix needed | — |
| 7 | Other device profiles | Environment-limited, see below | — |
| 8 | Network loss mid-use | **Bug found, documented (not fixed)** | — |

## 1. Back button deep-nesting — fixed

Reproduced live: Today → Settings → back correctly returned to Today, but
back again did nothing at all (didn't exit) instead of behaving like a normal
Android app with an empty back stack.

Root cause: `AndroidBackButton.tsx` checked `window.history.length > 1` to
decide whether to go back vs. exit. `history.length` only ever grows — it
never decreases when `history.back()` is called — so the check stayed
permanently true after the very first in-app navigation, and `App.exitApp()`
never fired again.

Fixed by using the `canGoBack` boolean Capacitor's `backButton` event already
provides (computed natively from the real WebView back stack) instead.
Verified: Today → Settings → back → Today → back → exits cleanly. Also
verified through a chain of non-routed tab toggles (Progress → Trends → Uni
work sub-tab) — one back press correctly collapses straight to Today in one
step, confirming those toggles are client state, not real navigation entries,
and don't confuse the fix.

## 2. Bottom gesture-bar overlap — pass

Checked Settings and the Trends tab (both scrolled fully to the bottom,
confirmed via repeated identical screenshots that no further content was
below the fold). Both show clear space between the last content and Android's
gesture-navigation pill — no clipping. `NativeAuthScreen.tsx` already has
explicit `env(safe-area-inset-bottom)` padding from earlier work this
session; didn't re-verify it live (couldn't reliably hit the tiny "Sign out"
tap target to get back to the signed-out state without disrupting the
signed-in session needed for the remaining items — see note below), but the
padding is present in source and the general bottom-safe-area behavior passed
on every other screen tested.

## 3. Push notifications in WebView — copy improved

Confirmed `pushSupported()` correctly returns `false` in the Android WebView
and nothing crashes — the Settings page already degrades gracefully. This had
to be verified with `NEXT_PUBLIC_DISABLE_PAYWALL=true` temporarily (dev
server restart, then reverted and restarted again after), since the test
account's free-tier paywall was masking the Notifications section entirely.

Only issue: the existing copy ("Push notifications aren't supported in this
browser") reads like a browser-compatibility problem, which is confusing
inside an actual installed app rather than a browser tab. Changed to
native-aware copy pointing at the working web version, gated on
`useIsNativePlatform()`. Web behavior is unchanged. Real native push (FCM) is
out of scope per the spec (needs the user's Firebase account) — not
attempted.

## 4. Session persistence across cold restart — pass

`am force-stop` (full process kill, not just backgrounding) then `am start`:
still signed in, still on Today, dark theme intact, no sign-in screen, no
onboarding redirect. The greeting and hero card both correctly reflected the
real current time on reload ("Good evening" / "How did today land?"),
confirming this was a genuine fresh render against live state, not a frozen
snapshot.

## 5. Background → foreground resume — pass

Backgrounded via the Home key, waited a full 2 minutes, resumed via `am
start` (which — since `MainActivity` is `launchMode="singleTask"` — brought
the existing task to the foreground rather than creating a new instance).
Process was still alive after 2 minutes (`pidof` unchanged); content rendered
instantly with no frozen/stale white screen. Since the process survived, this
didn't exercise the "process got killed while backgrounded" path, but item 4
already proves that path independently (a killed-and-relaunched process comes
back correctly), so both halves of this scenario are covered between the two
items.

## 6. Keyboard covering inputs — pass

Tested the "Your name" field in Settings. Note: the emulator has a stylus
handwriting tutorial ("Try out your stylus") that intercepts the *first* tap
into any text field and has to be dismissed (or completed via repeated
"Next" taps) before the real software keyboard appears — this is an AVD
system feature, not an app bug. Disabling it for future runs:
```
adb shell settings put secure stylus_handwriting_enabled 0
```
Once past that, the real keyboard opened correctly and the focused input
stayed fully visible above it — no overlap, nothing hidden.

## 7. Other device profiles/API levels — environment-limited

Two additional local AVDs exist (`Pixel_6`, `Medium_Phone`), but both use
`x86_64` system images, which cannot run on this Mac's `aarch64` host
(`FATAL: Avd's CPU Architecture 'x86_64' is not supported by the QEMU2
emulator on aarch64 host`). Only `Pixel_8` (arm64, API 36) is actually
runnable here without downloading a new GB-scale system image, which the
spec explicitly says to skip. **Not independently verified on a second
device/API level or screen size** — the status-bar/gesture-bar fixes from
earlier work this session are only confirmed on this one profile. If a
genuine cross-device check matters before shipping, it needs either a
matching arm64 AVD image downloaded, or a physical second device.

## 8. Network loss mid-use — bug found, not fixed (documented)

This is the most significant finding of the pass.

**Reproduced**: with the app open and signed in, disabled wifi + mobile data
(`svc wifi disable` / `svc data disable`), then tapped an in-app nav link
(Today). The entire app was replaced by Android WebView's own bare "Webpage
not available — net::ERR_ADDRESS_UNREACHABLE" error page (no app chrome, no
retry button visible).

**Re-enabled network** (`svc wifi enable` / `svc data enable`), waited
several seconds, re-screenshotted: **still stuck on the same error page,
indefinitely** — no automatic recovery.

**Why a simple JS fix doesn't work**: the obvious minimal fix
(`window.addEventListener("online", () => location.reload())`) cannot help
here. Once the WebView shows its own native error page, it has done a real
top-level navigation and fully replaced the document — none of the app's
React/JS is still executing at that point to have registered such a
listener. This only recovers via a full `am force-stop` + relaunch (verified:
the app comes back up correctly and normally once relaunched — the app
*state* isn't corrupted, only the current WebView document is unrecoverable
from within).

**Why this wasn't fixed in this pass**: a real fix requires one of:
- A native `WebViewClient` override in `MainActivity.java` that catches the
  main-frame load error and registers a `ConnectivityManager.NetworkCallback`
  to `webView.reload()` once connectivity actually returns, or
- Capacitor's `server.errorPath` config pointing at a small bundled static
  fallback page with its own reload button/logic.

Both are genuine native-behavior changes, not minimal ones — and this
project's history this session (the plugin auto-registration investigation)
showed how expensive a wrong guess at Capacitor/WebView internals can be to
debug blind. Given the spec's explicit instruction to prefer report-only over
a risky patch for this exact case, this is left as a clearly-documented
follow-up rather than attempted live.

**Suggested next step**: build and test the `MainActivity.java`
`WebViewClient` override specifically (more contained than
`server.errorPath`, which would also need a new bundled HTML page,
build-time asset wiring, and styling to match the app), as a dedicated,
carefully-tested piece of work — not a rushed addition to this pass.

## Compass / web regression

Every code change this pass (`AndroidBackButton.tsx`'s `canGoBack` fix, the
Settings push-copy change) is either native-only (`Capacitor.isNativePlatform()`
gated) or additionally gated on `APP_VARIANT.id === "study"` where relevant.
`npx tsc --noEmit` was run clean before every commit. No Compass-visible
behavior changed.
