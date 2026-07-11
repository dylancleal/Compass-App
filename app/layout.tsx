import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";
import IntroTour from "@/components/IntroTour";
import Fireflies from "@/components/Fireflies";
import { APP_VARIANT } from "@/lib/appVariant";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${APP_VARIANT.name} — your calm life dashboard`,
  description: APP_VARIANT.tagline,
  // manifest link is auto-injected by the app/manifest.ts route convention
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_VARIANT.name },
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
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <Fireflies />
          <Nav />
          <main className="mx-auto w-full max-w-2xl px-4 pt-20 pb-10">
            {children}
          </main>
          <IntroTour />
        </Providers>
      </body>
    </html>
  );
}
