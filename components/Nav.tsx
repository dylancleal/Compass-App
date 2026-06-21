"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", icon: "🧭" },
  { href: "/categories", label: "Areas", icon: "🗂️" },
  { href: "/uni", label: "Uni", icon: "📘" },
  { href: "/trends", label: "Trends", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop side nav */}
      <nav className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-[var(--border)] md:bg-[var(--surface)] md:p-4">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <span>🧭</span> Compass
        </div>
        {ITEMS.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--background)" : "transparent",
                color: active ? "var(--foreground)" : "var(--muted)",
              }}
            >
              <span className="text-lg">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
        {ITEMS.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
              style={{ color: active ? "var(--foreground)" : "var(--muted)" }}
            >
              <span className="text-xl" style={{ opacity: active ? 1 : 0.6 }}>
                {it.icon}
              </span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
