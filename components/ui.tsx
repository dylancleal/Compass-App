"use client";

import { useEffect } from "react";

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color,
  track = "#eef0f4",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div style={{ width: size, height: size }} className="relative grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">
        {children}
      </div>
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
            className="flex-1 rounded-xl border py-3 text-sm font-medium transition-all"
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
  color = "#334155",
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
  const style: React.CSSProperties =
    variant === "primary"
      ? { background: color, color: "#fff" }
      : variant === "soft"
        ? { background: color + "1a", color }
        : { background: "transparent", color: "var(--muted)" };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${className}`} style={style}>
      {children}
    </button>
  );
}
