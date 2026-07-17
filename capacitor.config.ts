import type { CapacitorConfig } from '@capacitor/cli';

// Lodestone is a dynamic Next.js app (SSR + API routes, no static export),
// so the native shell loads the live deployed site directly rather than
// bundling a static build — webDir is required by the type but unused
// whenever server.url is set.
const config: CapacitorConfig = {
  appId: 'app.mylodestone.android',
  appName: 'Lodestone',
  webDir: 'public',
  server: {
    url: 'https://mylodestone.app',
    cleartext: false,
  },
};

export default config;
