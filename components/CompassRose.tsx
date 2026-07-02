"use client";

// A small CSS-3D compass: a dial tilted back in perspective with a needle that
// settles to north. `spin` plays the needle-spin once on mount (day-complete
// moment); `onDark` recolours it to read on a coloured/gradient card.
export default function CompassRose({
  size = 64,
  spin = false,
  onDark = false,
}: {
  size?: number;
  spin?: boolean;
  onDark?: boolean;
}) {
  const ring = onDark ? "rgba(255,255,255,0.4)" : "var(--border)";
  const face = onDark
    ? "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16), rgba(255,255,255,0.04))"
    : "radial-gradient(circle at 50% 38%, var(--surface), var(--primary-soft))";
  const needleN = onDark ? "#fffdf9" : "var(--accent)";
  const needleS = onDark ? "rgba(255,255,255,0.35)" : "var(--primary)";
  const mark = onDark ? "rgba(255,255,255,0.75)" : "var(--muted)";

  return (
    <div
      className="mx-auto grid place-items-center"
      style={{ width: size, height: size * 0.72, perspective: size * 4 }}
      aria-hidden
    >
      <div
        style={{
          width: size,
          height: size,
          transform: "rotateX(55deg)",
          transformStyle: "preserve-3d",
          position: "relative",
        }}
      >
        {/* dial face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${ring}`,
            background: face,
            boxShadow: onDark ? "0 6px 14px rgba(0,0,0,0.3)" : "var(--shadow-2)",
          }}
        />
        {/* north marker */}
        <span
          style={{
            position: "absolute",
            top: 4,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: size * 0.16,
            fontWeight: 700,
            color: mark,
          }}
        >
          N
        </span>
        {/* needle */}
        <div
          className={spin ? "animate-needle" : undefined}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transform: "translate(-50%, -50%) rotate(0deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -3,
              bottom: 0,
              width: 6,
              height: size * 0.34,
              background: `linear-gradient(${needleN}, ${needleN})`,
              clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -3,
              top: 0,
              width: 6,
              height: size * 0.34,
              background: needleS,
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />
        </div>
        {/* hub */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 0.12,
            height: size * 0.12,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: needleN,
          }}
        />
      </div>
    </div>
  );
}
