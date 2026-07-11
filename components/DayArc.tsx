"use client";

// A small day-arc: a sun (or moon) tracing a horizon arc by time of day.
// Purely decorative — gives the header a living, time-aware "companion" feel,
// and doubles as the anchor point for the top-right glow that now runs
// through the rest of the app (see the boosted body::before blob in
// globals.css) — same visual language as the day-complete celebration card.
export default function DayArc({ width = 132, height = 46 }: { width?: number; height?: number }) {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;

  // Daytime window 6:00 → 20:00 maps left→right along the arc; outside that we
  // sit near the edges with a moon.
  const t = Math.max(0, Math.min(1, (h - 6) / 14));
  const isNight = h < 6 || h >= 20;

  const pad = 8;
  const r = (width - pad * 2) / 2;
  const cx = width / 2;
  const cy = height - 6;
  const theta = Math.PI * (1 - t); // π (left) → 0 (right)
  const px = cx + r * Math.cos(theta);
  const py = cy - r * Math.sin(theta);

  const arcColor = "color-mix(in srgb, var(--primary) 45%, transparent)";
  const bodyColor = isNight ? "var(--info-text)" : "var(--accent)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      {/* horizon */}
      <line x1={pad} y1={cy} x2={width - pad} y2={cy} stroke="var(--border)" strokeWidth={1} />
      {/* arc path */}
      <path
        d={`M ${pad} ${cy} A ${r} ${r} 0 0 1 ${width - pad} ${cy}`}
        stroke={arcColor}
        strokeWidth={1.5}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      {/* outer glow halo — wider and brighter so the marker reads as a real
          glow source, matching the compass rose's halo treatment */}
      <circle cx={px} cy={py} r={16} fill={bodyColor} opacity={0.14} />
      <circle cx={px} cy={py} r={10} fill={bodyColor} opacity={0.22} />
      {/* body */}
      <circle
        cx={px}
        cy={py}
        r={5}
        fill={bodyColor}
        style={{ filter: `drop-shadow(0 0 9px color-mix(in srgb, ${bodyColor} 75%, transparent))` }}
      />
    </svg>
  );
}
