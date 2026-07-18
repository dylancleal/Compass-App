import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";
import IntroTour from "@/components/IntroTour";
import Fireflies from "@/components/Fireflies";
import { APP_VARIANT } from "@/lib/appVariant";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// Every screen here sits behind AuthGate and is per-user — there's no static
// shell worth prerendering. Forcing dynamic rendering stops Vercel's edge
// from caching the HTML (including the variant-dependent <title>) across
// deployments, which otherwise kept serving Compass's shell on Lodestone's
// domain long after a fresh build had gone out.
export const dynamic = "force-dynamic";

// Runs before first paint so switching themes (or loading with a saved
// preference) never flashes the wrong colours. Kept as a plain, unbundled
// string — it has to run standalone, before React/hydration, so it can't
// import from lib/theme.ts; ThemeToggle.tsx mirrors this same logic in TS.
// Lodestone defaults to dark regardless of OS preference (baked in at build
// time here, since APP_VARIANT is resolved server-side) — Compass keeps
// following the OS setting as before.
const FALLBACK_THEME_EXPR =
  APP_VARIANT.id === "study" ? `"dark"` : `(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")`;
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("compass-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : ${FALLBACK_THEME_EXPR};
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: `${APP_VARIANT.name} — your calm life dashboard`,
  description: APP_VARIANT.tagline,
  // manifest link is auto-injected by the app/manifest.ts route convention
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_VARIANT.name },
  // Overrides the shared app/favicon.ico (Compass's icon) for Lodestone only —
  // app/favicon.ico has no per-variant equivalent, so this <link rel="icon">
  // takes priority in browsers that support it instead.
  ...(APP_VARIANT.id === "study" && {
    icons: { icon: "/favicon-lodestone.png", apple: "/apple-icon-lodestone.png" },
  }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_VARIANT.backgroundColor },
    { media: "(prefers-color-scheme: dark)", color: "#1a211c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>
          <Fireflies />
          <Nav />
          <main
            className="mx-auto w-full max-w-2xl px-4 pb-10"
            style={{ paddingTop: "calc(5rem + env(safe-area-inset-top))" }}
          >
            {children}
          </main>
          <IntroTour />
        </Providers>
      </body>
    </html>
  );
}
