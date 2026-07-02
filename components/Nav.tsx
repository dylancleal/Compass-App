"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/categories", label: "Areas" },
  { href: "/uni", label: "Uni" },
  { href: "/review", label: "Review" },
  { href: "/trends", label: "Trends" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const activeIndex = ITEMS.findIndex((it) => isActive(pathname ?? "", it.href));

  // Measure the active link and slide the pill behind it. Recomputed on route
  // change, on resize, and once more shortly after mount (fonts can shift widths).
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
      <Link
        href="/"
        className="flex shrink-0 items-center gap-1.5 text-sm font-bold tracking-tight"
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-[13px]"
          style={{ background: "var(--primary-soft)" }}
          aria-hidden
        >
          🧭
        </span>
        Compass
      </Link>

      {/* Divider */}
      <div className="h-4 w-px shrink-0 bg-[var(--border)]" />

      {/* Nav pills — horizontally scrollable on narrow screens */}
      <nav
        ref={navRef}
        className="relative flex min-w-0 gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {/* Sliding indicator pill — sits behind the links */}
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
            transition: "left 0.28s cubic-bezier(0.22,1,0.36,1), width 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
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
    </header>
  );
}
