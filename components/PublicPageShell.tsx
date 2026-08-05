import Link from "next/link";
import { APP_VARIANT } from "@/lib/appVariant";

// Minimal chrome for pages that bypass AuthGate entirely (see PUBLIC_PATHS in
// AuthGate.tsx) — no Nav, no Fireflies, just enough layout so a legal page
// doesn't render flush against the viewport edge with no branding at all.
export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header
        className="flex items-center px-4 py-4"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <Link href="/" className="text-sm font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          {APP_VARIANT.name}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16">{children}</main>
    </div>
  );
}
