import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";
import IntroTour from "@/components/IntroTour";
import Fireflies from "@/components/Fireflies";
import AndroidBackButton from "@/components/AndroidBackButton";
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
    <html
      lang="en"
      data-variant={APP_VARIANT.id}
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/*
          DIRECTION CONTRACT (Lodestone only — see app/layout.tsx history for why this
          can't be a literal HTML comment: JSX has no way to emit a bare comment node
          into rendered output, so this is a source-level record instead).

          THESIS: Lodestone stops reading as a wellness app apologizing for asking you to do
          something, and starts reading as the sports watch already on your wrist — every
          screen is a live instrument reporting your actual state, not a soft card.
          OWN-WORLD: matte-black instrument face; tabular/monospace numerals at real size for
          every stat; category colors as committed "channels" (not pastel accents); cards as
          bezel-outlined instrument panels with a channel-color LED dot, replacing the old
          side-tab border; progress as lap-arcs, not flat fills.
          STORY: opens the app like checking a watch mid-run — readiness dial front and
          center, today's sessions as instrument "splits," streak as a lap counter that only
          advances on real effort.
          FIRST VIEWPORT: Today's check-in becomes a tap-to-set readiness dial; planned
          sessions render as a horizontal split-strip, not stacked cards; the conflict
          indicator becomes a bounded amber signal LED in the bezel corner, never an
          unbounded alarm banner.
          FORM: Instrument Readout, candidate 4 of 7, seed key c72a5b91.
          REVISION: the fully flat/atmosphere-free first pass (no glow blobs, no Fireflies,
          zero card elevation) read as cold, not "instrument" — reverted per feedback to keep
          the bezel-panel/LED-dot/tabular-numeral structure but restore the green/apricot glow
          blobs, ambient starfield, and card lift. See DESIGN.md.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
          review, the verdict, and DESIGN.md.
        */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>
          <AndroidBackButton />
          {/* Restored per feedback — the fully "crisp, not atmospheric"
              instrument treatment read as too cold for a wellness app.
              Fireflies now runs for both variants; only hidden in light
              mode / reduced-motion (see .fireflies rules in globals.css). */}
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
