"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Segmented toggle that unifies the two Progress views (weekly summary + charts)
// into one section, so Trends doesn't need its own top-nav slot.
const TABS = [
  { href: "/review", label: "This week" },
  { href: "/trends", label: "Trends" },
];

export default function ProgressTabs() {
  const pathname = usePathname();
  return (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-1)" }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex-1 rounded-full py-1.5 text-center text-sm font-medium transition-all"
            style={{
              background: active ? "var(--primary)" : "transparent",
              color: active ? "#fffdf9" : "var(--muted)",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
