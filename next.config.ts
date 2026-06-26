import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical uses BigInt at module init time, which Turbopack can't bundle.
  // Exclude it so it's required natively at runtime instead.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;
