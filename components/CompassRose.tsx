"use client";

import { useId } from "react";

// A clean, modern compass rose (flat top-down, refined ticks + a sharp two-tone
// needle with a soft glow). `spin` plays the needle settling to north on mount;
// `onDark` recolours it for a dark/starry backdrop.
export default function CompassRose({
  size = 64,
  spin = false,
  onDark = false,
}: {
  size?: number;
  spin?: boolean;
  onDark?: boolean;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glowId = `glow-${raw}`;
  const nGradId = `n-${raw}`;

  const north = onDark ? "#fffef8" : "var(--accent)";
  const northDeep = onDark ? "#ffd9a8" : "var(--primary)";
  const south = onDark ? "rgba(255,255,255,0.22)" : "color-mix(in srgb, var(--primary) 45%, transparent)";
  const ring = onDark ? "rgba(255,255,255,0.30)" : "var(--border)";
  const tick = onDark ? "rgba(255,255,255,0.45)" : "var(--muted)";
  const hubFill = onDark ? "#0c1310" : "var(--surface)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ overflow: "visible", display: "block", margin: "0 auto" }}
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={north} stopOpacity={onDark ? 0.45 : 0.35} />
          <stop offset="70%" stopColor={north} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={nGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={north} />
          <stop offset="100%" stopColor={northDeep} />
        </linearGradient>
      </defs>

      {/* soft glow halo */}
      <circle cx="50" cy="50" r="48" fill={`url(#${glowId})`} />

      {/* concentric rings */}
      <circle cx="50" cy="50" r="38" fill="none" stroke={ring} strokeWidth="1.1" />
      <circle cx="50" cy="50" r="29" fill="none" stroke={ring} strokeWidth="0.6" opacity="0.5" />

      {/* tick marks — long at cardinals, short between */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const long = i % 3 === 0;
        const r1 = long ? 31 : 34.5;
        const x1 = 50 + r1 * Math.sin(a);
        const y1 = 50 - r1 * Math.cos(a);
        const x2 = 50 + 38 * Math.sin(a);
        const y2 = 50 - 38 * Math.cos(a);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={tick}
            strokeWidth={long ? 1.4 : 0.7}
            strokeLinecap="round"
            opacity={long ? 0.9 : 0.45}
          />
        );
      })}

      {/* N marker */}
      <text
        x="50"
        y="15.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.5"
        fill={north}
      >
        N
      </text>

      {/* needle — a sharp compass star, spins to north */}
      <g
        className={spin ? "animate-needle-svg" : undefined}
        style={spin ? undefined : { transformBox: "view-box", transformOrigin: "50% 50%" }}
      >
        <path
          d="M50 21 L56 50 L50 45 L44 50 Z"
          fill={`url(#${nGradId})`}
          style={{ filter: `drop-shadow(0 0 3px ${north})` }}
        />
        <path d="M50 79 L44 50 L50 55 L56 50 Z" fill={south} />
      </g>

      {/* hub */}
      <circle cx="50" cy="50" r="4.6" fill={hubFill} stroke={north} strokeWidth="1.6" />
      <circle cx="50" cy="50" r="1.4" fill={north} />
    </svg>
  );
}
