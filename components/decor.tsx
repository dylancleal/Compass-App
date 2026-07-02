"use client";

import { useEffect, useRef } from "react";

// A small eucalyptus leaf glyph (Lucide "leaf"), for empty states.
export function LeafMark({ size = 40, color = "var(--muted)" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

// A faint branch that drifts slightly with scroll behind the page header —
// adds quiet depth. Direct transform writes (no re-render); reduced-motion safe.
export function ParallaxLeaf() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el!.style.transform = `translateY(${window.scrollY * -0.08}px) rotate(-8deg)`;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <svg
      ref={ref}
      className="pointer-events-none absolute -right-6 -top-10 -z-10"
      width={160}
      height={160}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth={0.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.08, transform: "rotate(-8deg)" }}
      aria-hidden
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
