import { useEffect, useRef, useState } from "react";

// Animate a number from 0 → target on mount (and whenever target changes).
// easeOutCubic for a lively-but-calm settle. Respects prefers-reduced-motion.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || durationMs <= 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
