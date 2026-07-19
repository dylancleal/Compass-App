import type { CapacitorConfig } from '@capacitor/cli';

// Lodestone is a dynamic Next.js app (SSR + API routes, no static export),
// so the native shell loads the live deployed site directly rather than
// bundling a static build — webDir is required by the type but unused
// whenever server.url is set.
//
// For local testing against `npm run dev` instead of production (e.g. to
// get the dev-login button, which only exists in development and must
// never exist in a real build — see app/api/dev-auth/route.ts), set
// CAPACITOR_SERVER_URL before running `npx cap sync android`:
//
//   CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android
//
// 10.0.2.2 is the Android emulator's fixed address for the host machine's
// own localhost. This is a one-off env var at sync time, never committed —
// re-run `npx cap sync android` with no override to point back at
// production before ever building something you'd actually share.
const devServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'app.mylodestone.android',
  appName: 'Lodestone',
  webDir: 'public',
  server: {
    url: devServerUrl ?? 'https://mylodestone.app',
    // Android blocks plain HTTP by default — only relaxed for the local
    // http://10.0.2.2 override above, never for the real HTTPS production URL.
    cleartext: Boolean(devServerUrl),
  },
  // targetSdk 36 makes edge-to-edge mandatory app-wide — without this, the
  // WebView draws underneath the status bar on every device, and the exact
  // overlap depends on that device's own status bar height (notch, punch-hole,
  // plain bar all differ), which CSS safe-area insets alone don't reliably
  // pick up inside an Android WebView. overlaysWebView: false has Android
  // reserve that space natively per-device instead, so the WebView content
  // simply never extends under it — no per-device tuning needed. Initial
  // colour/style here matches Lodestone's dark default (see ThemeToggle.tsx,
  // which keeps this in sync if the user switches to light).
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#1a211c',
    },
  },
};

export default config;
