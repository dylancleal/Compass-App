"use client";

import { useRef, useState } from "react";

const CONFETTI_COLORS = ["#5b8a72", "#a8c3b5", "#d98e63", "#c9b46b", "#7faf97"];

// A satisfying circular check (SPEC §3.2): colour pulse + a small confetti
// burst when you complete something. Calm, not loud.
export default function TickCircle({
  checked,
  onChange,
  accent,
  size = 26,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  accent: string;
  size?: number;
  label?: string;
}) {
  const hostRef = useRef<HTMLButtonElement>(null);
  const [bursting, setBursting] = useState(false);

  function burst() {
    setBursting(true);
    window.setTimeout(() => setBursting(false), 750);
  }

  function toggle() {
    const next = !checked;
    if (next) burst();
    onChange(next);
  }

  return (
    <button
      ref={hostRef}
      type="button"
      aria-pressed={checked}
      aria-label={label ?? (checked ? "Mark not done" : "Mark done")}
      onClick={toggle}
      className="relative grid place-items-center rounded-full border-2 transition-all hover:scale-110 hover:opacity-100"
      style={{
        width: size,
        height: size,
        borderColor: checked ? accent : "#c7cfc3",
        background: checked ? accent : "transparent",
      }}
    >
      {checked && (
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          className="animate-check"
          stroke="#fff"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {bursting &&
        Array.from({ length: 10 }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / 10 + Math.random();
          const dist = 22 + Math.random() * 18;
          return (
            <span
              key={i}
              className="confetti-piece"
              style={
                {
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  left: "50%",
                  top: "50%",
                  "--cx": `${Math.cos(angle) * dist}px`,
                  "--cy": `${Math.sin(angle) * dist}px`,
                  "--cr": `${Math.random() * 360}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
    </button>
  );
}
