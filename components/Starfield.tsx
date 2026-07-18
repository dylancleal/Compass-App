// Deep-space nebula + twinkling starfield — the site's green + apricot glow
// over a near-black base. Shared by the day-complete celebration card
// (Plan.tsx) and the native app's full-bleed sign-in screen (NativeAuthScreen)
// so the two don't drift into two different "space" looks. Renders two
// absolutely-positioned layers; the parent must be `position: relative` (or
// `fixed`) with `overflow: hidden`.

export const STARS: { x: number; y: number; r: number; o: number; d: number; c: string }[] = [
  { x: 8, y: 22, r: 2.2, o: 0.95, d: 0, c: "#ffffff" },
  { x: 20, y: 12, r: 1.3, o: 0.7, d: 1.4, c: "#ffffff" },
  { x: 33, y: 30, r: 1, o: 0.5, d: 0.7, c: "var(--accent)" },
  { x: 15, y: 55, r: 1.6, o: 0.8, d: 2.1, c: "#ffffff" },
  { x: 6, y: 78, r: 1.2, o: 0.6, d: 0.3, c: "#ffffff" },
  { x: 26, y: 84, r: 2, o: 0.85, d: 1.8, c: "var(--primary-mid)" },
  { x: 44, y: 16, r: 1.1, o: 0.55, d: 2.6, c: "#ffffff" },
  { x: 50, y: 88, r: 1.4, o: 0.7, d: 0.9, c: "#ffffff" },
  { x: 63, y: 12, r: 1.8, o: 0.9, d: 1.2, c: "#ffffff" },
  { x: 72, y: 28, r: 1, o: 0.5, d: 2.3, c: "var(--accent)" },
  { x: 88, y: 18, r: 1.5, o: 0.75, d: 0.5, c: "#ffffff" },
  { x: 94, y: 42, r: 1.2, o: 0.6, d: 1.9, c: "#ffffff" },
  { x: 82, y: 58, r: 2.1, o: 0.9, d: 0.2, c: "#ffffff" },
  { x: 92, y: 80, r: 1.3, o: 0.65, d: 1.5, c: "var(--primary-mid)" },
  { x: 70, y: 86, r: 1.1, o: 0.55, d: 2.8, c: "#ffffff" },
  { x: 58, y: 68, r: 0.9, o: 0.45, d: 1.0, c: "#ffffff" },
  { x: 38, y: 62, r: 1, o: 0.5, d: 2.0, c: "#ffffff" },
  { x: 78, y: 40, r: 0.9, o: 0.45, d: 0.6, c: "var(--accent)" },
];

export function NebulaBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background: [
            "radial-gradient(135% 115% at 16% 10%, color-mix(in srgb, var(--primary-mid) 60%, transparent), transparent 58%)",
            "radial-gradient(125% 115% at 90% 94%, color-mix(in srgb, var(--accent) 52%, transparent), transparent 58%)",
            "radial-gradient(90% 80% at 62% 42%, color-mix(in srgb, var(--mist) 34%, transparent), transparent 68%)",
            "#0a110e",
          ].join(", "),
        }}
      />
      <div className="absolute inset-0" aria-hidden>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.r,
              height: s.r,
              background: s.c,
              boxShadow: s.r >= 1.8 ? `0 0 ${s.r * 2.5}px ${s.c}` : undefined,
              ["--star-o" as string]: s.o,
              animationDelay: `${s.d}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
