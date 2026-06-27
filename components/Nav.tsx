"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/categories", label: "Areas" },
  { href: "/uni", label: "Uni" },
  { href: "/trends", label: "Trends" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return null;

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
        className="flex min-w-0 gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {ITEMS.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-all duration-150 ${
                active
                  ? "hover:brightness-110 hover:scale-[1.04]"
                  : "hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] hover:scale-[1.04]"
              }`}
              style={{
                background: active ? "var(--primary)" : "transparent",
                color: active ? "#fffdf9" : "var(--muted)",
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
