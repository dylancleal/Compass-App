import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical uses BigInt at module init time, which Turbopack can't bundle.
  // Exclude it so it's required natively at runtime instead.
  serverExternalPackages: ["node-ical"],
  // 10.0.2.2 is the Android emulator's fixed address for the host's own
  // localhost — needed so the CAPACITOR_SERVER_URL local-dev override
  // (capacitor.config.ts) can actually load the page instead of Next.js
  // silently blocking its dev-resource requests as cross-origin. Dev-only:
  // this setting has no effect on `next build`/production.
  allowedDevOrigins: ["10.0.2.2"],
  devIndicators: false,
};

export default nextConfig;
