"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_VARIANT } from "@/lib/appVariant";

// Consolidated top nav: Today · Calendar · Progress · Areas, with Settings as a
// right-aligned gear. "Progress" is the hub for both the weekly summary (/review)
// and charts (/trends). Uni is reachable from its area, not the global nav.
const ITEMS: { href: string; label: string; match?: string[] }[] = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/review", label: "Progress", match: ["/review", "/trends"] },
  { href: "/categories", label: "Areas" },
];

function matchesItem(pathname: string, it: (typeof ITEMS)[number]) {
  const paths = it.match ?? [it.href];
  return paths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
}

export default function Nav() {
  const pathname = usePathname();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const activeIndex = ITEMS.findIndex((it) => matchesItem(pathname ?? "", it));

  useEffect(() => {
    function measure() {
      const el = itemRefs.current[activeIndex];
      if (!el) {
        setPill((p) => ({ ...p, ready: false }));
        return;
      }
      setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    }
    measure();
    const t = window.setTimeout(measure, 180);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, pathname]);

  if (pathname?.startsWith("/onboarding")) return null;

  const settingsActive = pathname?.startsWith("/settings");

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-13 items-center gap-3 px-4"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-bold tracking-tight">
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-[13px]"
          style={{ background: "var(--primary-soft)" }}
          aria-hidden
        >
          🧭
        </span>
        {APP_VARIANT.name}
      </Link>

      {/* Divider */}
      <div className="h-4 w-px shrink-0 bg-[var(--border)]" />

      {/* Nav pills — horizontally scrollable on narrow screens */}
      <nav
        className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {/* Sliding indicator pill */}
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            top: "50%",
            left: pill.left,
            width: pill.width,
            height: "1.75rem",
            transform: "translateY(-50%)",
            background: "var(--primary)",
            opacity: pill.ready ? 1 : 0,
            transition:
              "left 0.28s cubic-bezier(0.22,1,0.36,1), width 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
          }}
        />

        {ITEMS.map((it, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={it.href}
              href={it.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`relative z-10 shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                active ? "" : "hover:text-[var(--primary)]"
              }`}
              style={{ color: active ? "#fffdf9" : "var(--muted)" }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Settings gear — right aligned */}
      <Link
        href="/settings"
        aria-label="Settings"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all hover:scale-105"
        style={{
          background: settingsActive ? "var(--primary)" : "transparent",
          color: settingsActive ? "#fffdf9" : "var(--muted)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </header>
  );
}
