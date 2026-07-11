"use client";

import { useEffect, useState } from "react";

type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "compass-theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

function apply(pref: ThemePref) {
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

const ICONS: Record<ThemePref, React.ReactNode> = {
  light: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
  system: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </svg>
  ),
};

const LABELS: Record<ThemePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "Following system",
};

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };

// A standalone in-app light/dark/system switch, independent of the OS-level
// setting AuthGate/globals.css otherwise follow. Cycles system -> light ->
// dark -> system; persists the choice so it survives reloads, and — while on
// "system" — keeps following a live OS theme change.
export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePref | null;
    const initial = stored === "light" || stored === "dark" ? stored : "system";
    setPref(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      // Only react live if the user hasn't pinned an explicit choice.
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePref | null;
      const currentPref = stored === "light" || stored === "dark" ? stored : "system";
      if (currentPref === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = NEXT[pref];
    setPref(next);
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  // Avoid rendering an icon that might not match the pre-hydration DOM state.
  if (!mounted) return <div className="h-8 w-8 shrink-0" aria-hidden />;

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${LABELS[pref]}. Click to change.`}
      title={`Theme: ${LABELS[pref]}`}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-all hover:scale-105 hover:text-[var(--foreground)]"
    >
      {ICONS[pref]}
    </button>
  );
}
