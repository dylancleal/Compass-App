"use client";

import { useEffect, useId, useState } from "react";

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color,
  track = "var(--border)",
  animate = true,
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  animate?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, value));
  const gid = "ring-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const complete = target >= 1;

  // Fill from 0 → target on mount so the arc "draws in".
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) {
      setShown(target);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  return (
    <div style={{ width: size, height: size }} className="relative grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${color} 55%, white)` }} />
            <stop offset="100%" style={{ stopColor: color }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 1px 3px color-mix(in srgb, ${color} 45%, transparent))`,
          }}
        />
      </svg>
      <div
        className={`absolute inset-0 grid place-items-center text-sm font-semibold ${complete ? "animate-check" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

// A dimensional "squircle" icon holder — soft radial tint of the category colour,
// inner top highlight + drop shadow so emoji read as raised chips, not flat glyphs.
export function IconChip({
  emoji,
  color,
  size = 36,
}: {
  emoji: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: "34%",
        background: `radial-gradient(circle at 32% 26%, color-mix(in srgb, ${color} 26%, var(--surface)), color-mix(in srgb, ${color} 10%, var(--surface)))`,
        boxShadow: "inset 0 1px 0 var(--card-highlight), var(--shadow-1)",
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
}

// A progress bar that fills from 0 → pct on mount, so goals feel like they're
// "filling up" rather than snapping to a static value.
export function AnimatedBar({
  pct,
  color,
  height = 8,
  track,
}: {
  pct: number; // 0..100
  color: string;
  height?: number;
  track?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, pct))));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div
      className="overflow-hidden rounded-full"
      style={{ height, background: track ?? "var(--background)" }}
    >
      <div
        style={{
          width: `${w}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="card animate-fade-slide relative z-10 w-full max-w-md rounded-b-none rounded-t-3xl p-5 sm:rounded-3xl">
        {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ScalePicker({
  value,
  onChange,
  color,
  labels = ["1", "2", "3", "4", "5"],
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  color: string;
  labels?: string[];
}) {
  return (
    <div className="flex gap-2">
      {labels.map((lab, i) => {
        const v = i + 1;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="flex-1 rounded-xl border py-3 text-sm font-medium transition-all hover:scale-[1.04] hover:opacity-100"
            style={{
              borderColor: active ? color : "var(--border)",
              background: active ? color : "var(--surface)",
              color: active ? "#fff" : "var(--foreground)",
              transform: active ? "scale(1.03)" : "scale(1)",
            }}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: color + "22", color }}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  color = "#3e6b54",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost";
  color?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50";
  const variantClass =
    variant === "primary"
      ? "btn-life"
      : "hover:scale-[1.03] hover:brightness-110 hover:opacity-100 active:scale-95";
  const style: React.CSSProperties =
    variant === "primary"
      ? {
          backgroundColor: color,
          // top-light sheen sits over the solid colour for a subtle dimensional feel
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          color: "#fff",
          ["--btn-color" as string]: color,
        }
      : variant === "soft"
        ? { background: color + "1a", color }
        : { background: "transparent", color: "var(--muted)" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
