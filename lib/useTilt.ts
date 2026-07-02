import { useEffect, useRef } from "react";

// Gentle cursor-follow 3D tilt for hero cards. Desktop pointers only, and a
// no-op under prefers-reduced-motion. Manipulates transform directly (via rAF)
// so pointer moves never trigger React re-renders.
export function useTilt<T extends HTMLElement>(enabled = true, maxDeg = 5) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height; // 0..1
      const rx = (0.5 - py) * maxDeg * 2;
      const ry = (px - 0.5) * maxDeg * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el!.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });
    }
    function reset() {
      cancelAnimationFrame(raf);
      el!.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }

    // Note: the transition is owned by the consumer (via CSS class or inline
    // style) so React re-renders don't fight the hook over the transition prop.
    el.style.transformStyle = "preserve-3d";
    el.style.willChange = "transform";
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      el.style.transform = "";
      el.style.willChange = "";
    };
  }, [enabled, maxDeg]);

  return ref;
}
