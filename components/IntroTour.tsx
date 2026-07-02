"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSaveSettings, useSettings } from "@/lib/queries";

interface IntroTourProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

// ── Tour step definitions ─────────────────────────────────────────────────────

interface TourStep {
  path: string;
  selector?: string; // [data-tour="…"] — if absent the tooltip is centred
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    path: "/",
    title: "Welcome to Compass 🧭",
    body: "A calm daily companion that shapes your plan around your energy and goals. Let's take a 60-second look around.",
  },
  {
    path: "/checkin",
    selector: "[data-tour='checkin-card']",
    title: "Start every morning here",
    body: "Tell Compass how you feel today — takes 30 seconds. It adjusts your suggestions to match: lighter on a rough day, more ambitious on a big one.",
  },
  {
    path: "/",
    selector: "[data-tour='suggestions']",
    title: "Your personalised plan",
    body: "After your check-in, suggestions appear here — built around your goals, your energy, and what you haven't done lately. Tap the circle to log one done.",
  },
  {
    path: "/calendar",
    selector: "[data-tour='calendar-connect']",
    title: "Connect your calendar",
    body: "Link Google or Apple Calendar. Compass reads your schedule and never suggests the gym on a day you're already booked — no conflicts, no guilt.",
  },
  {
    path: "/review",
    selector: "[data-tour='review-stats']",
    title: "Close the loop here",
    body: "The Review tab shows sessions, streaks, and a preview of what next week could look like. Worth a glance at the end of each week.",
  },
];

// ── Spotlight overlay ─────────────────────────────────────────────────────────

const PAD = 10; // px padding around the highlighted element

function useTargetRect(selector: string | undefined, pathname: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    setRect(null);
    if (!selector) return;

    attemptsRef.current = 0;

    function tryFind() {
      const el = document.querySelector(selector!);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-measure after scroll settles
        setTimeout(() => {
          const updated = el.getBoundingClientRect();
          setRect(updated);
        }, 350);
        return true;
      }
      return false;
    }

    if (tryFind()) return;

    const interval = setInterval(() => {
      attemptsRef.current++;
      if (tryFind() || attemptsRef.current >= 25) clearInterval(interval);
    }, 120);

    return () => clearInterval(interval);
  // Re-run when selector OR pathname changes (navigation completed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, pathname]);

  // Update rect on resize
  useEffect(() => {
    if (!selector || !rect) return;
    function onResize() {
      const el = document.querySelector(selector!);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, !!rect]);

  return rect;
}

// ── Tooltip positioning ───────────────────────────────────────────────────────

function tooltipStyle(rect: DOMRect | null): React.CSSProperties {
  const W = typeof window !== "undefined" ? window.innerWidth : 400;
  const H = typeof window !== "undefined" ? window.innerHeight : 700;
  const TW = 300; // tooltip width

  if (!rect) {
    // Centred modal
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: TW,
      zIndex: 60,
    };
  }

  const spotTop = rect.top - PAD;
  const spotBottom = rect.bottom + PAD;
  const spotCentreX = (rect.left + rect.right) / 2;

  // Horizontal: centre on the element, clamped to viewport
  const rawLeft = spotCentreX - TW / 2;
  const left = Math.max(12, Math.min(rawLeft, W - TW - 12));

  // Vertical: go below if spotlight is in the top half, else go above
  if (spotTop < H / 2) {
    return { position: "fixed", top: spotBottom + 12, left, width: TW, zIndex: 60 };
  }
  return { position: "fixed", bottom: H - spotTop + 12, left, width: TW, zIndex: 60 };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntroTour({ forceOpen, onClose }: IntroTourProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: settings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();

  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-show: onboarding done but tour not yet seen
  const shouldAutoShow =
    !isLoading &&
    !!settings?.onboarding_completed_at &&
    !settings?.tour_completed_at;

  const isHiddenRoute = pathname?.startsWith("/onboarding");

  useEffect(() => {
    if (forceOpen) { setStepIndex(0); setVisible(true); }
    else if (shouldAutoShow && !isHiddenRoute) { setStepIndex(0); setVisible(true); }
  }, [forceOpen, shouldAutoShow, isHiddenRoute]);

  // Navigate when the current step is on a different page
  const currentStep = STEPS[stepIndex];
  useEffect(() => {
    if (!visible || !currentStep) return;
    if (pathname !== currentStep.path) {
      router.push(currentStep.path);
    }
  }, [visible, stepIndex, currentStep, pathname, router]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex]);

  const isOnCorrectPage = pathname === currentStep?.path;
  const targetRect = useTargetRect(
    visible && isOnCorrectPage ? currentStep?.selector : undefined,
    pathname ?? "",
  );

  function finish() {
    setVisible(false);
    if (!forceOpen) {
      saveSettings.mutate({ tour_completed_at: new Date().toISOString() });
    }
    onClose?.();
  }

  const advance = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else finish();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!visible) return null;
  if (isHiddenRoute && !forceOpen) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const hasElement = !!currentStep?.selector;

  // While navigating to the target page, show a bare dark overlay
  const showSpotlight = isOnCorrectPage && hasElement && !!targetRect;
  const showCentred = !hasElement || (!showSpotlight && isOnCorrectPage);

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.55)", zIndex: 55, pointerEvents: "auto" }}
      />

      {/* Spotlight ring — sits over the target element, box-shadow creates the dark surround */}
      {showSpotlight && targetRect && (
        <div
          style={{
            position: "fixed",
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
            borderRadius: 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            border: "2px solid rgba(255,255,255,0.18)",
            zIndex: 56,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          ...tooltipStyle(showCentred ? null : targetRect),
          pointerEvents: "auto",
        }}
      >
        <div
          className="rounded-2xl p-5 shadow-2xl space-y-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Progress dots */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-200"
                  style={{
                    width: i === stepIndex ? 18 : 6,
                    background: i === stepIndex ? "var(--primary)" : "var(--border)",
                  }}
                />
              ))}
            </div>
            <button
              onClick={finish}
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              Skip
            </button>
          </div>

          <div>
            <h3 className="font-bold text-base leading-snug">{currentStep.title}</h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {currentStep.body}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={goBack}
              className="text-sm transition-opacity hover:opacity-80"
              style={{
                color: "var(--muted)",
                visibility: isFirst ? "hidden" : "visible",
              }}
            >
              ← Back
            </button>
            <button
              onClick={advance}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:brightness-105"
              style={{ background: "var(--primary)", color: "#fffdf9" }}
            >
              {isLast ? "Done →" : isOnCorrectPage ? "Next →" : "Go there →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
