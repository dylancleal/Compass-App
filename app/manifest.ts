import type { MetadataRoute } from "next";
import { APP_VARIANT } from "@/lib/appVariant";

// Dynamic PWA manifest so the installed-app name/theme follow the same
// NEXT_PUBLIC_APP_VARIANT switch as the rest of the branding. Replaces the old
// static public/manifest.webmanifest — Next serves this at the same URL.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_VARIANT.name} — life dashboard`,
    short_name: APP_VARIANT.shortName,
    description: APP_VARIANT.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_VARIANT.backgroundColor,
    theme_color: APP_VARIANT.themeColor,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
