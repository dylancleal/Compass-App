"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSaveSettings, useSettings } from "@/lib/queries";

interface IntroTourProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

// ── Mini mocks (styled divs that look like real UI elements) ──────────────────

function MockCheckinRow() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-2xl">🙂</span>
      <div>
        <p className="text-sm font-semibold">Medium day</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Mind 4/5 · Uni readiness 3/5</p>
      </div>
    </div>
  );
}

function MockSuggestionCard() {
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid #5b8a72" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2"
          style={{ borderColor: "#5b8a72" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Push day — upper body strength</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#5b8a7222", color: "#3e6b54" }}>
              💪 Gym
            </span>
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "var(--border)", color: "var(--muted)" }}>
              ~55 min
            </span>
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "var(--border)", color: "var(--muted)" }}>
              🕐 ~9am
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "#5b8a7233", color: "#3e6b54" }}
            >
              2/3 sessions this week ✓
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>← Compass learning</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCaptureRow() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {["📚 Uni work", "💪 Gym", "🎾 Tennis"].map((label) => (
          <span
            key={label}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {label}
          </span>
        ))}
      </div>
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2.5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid #7a9bb5" }}
      >
        <div>
          <p className="text-sm font-medium">SIT221 lecture</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>11:00 am–12:30 pm · google</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--border)", color: "var(--muted)" }}
        >
          done?
        </span>
      </div>
    </div>
  );
}

function MockCloseLoop() {
  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-3">
        {[["🌟", "Great"], ["😌", "Okay"], ["😕", "Rough"]].map(([emoji, label]) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 72 }}
          >
            <span className="text-2xl">{emoji}</span>
            <p className="text-xs font-semibold">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["7", "sessions"], ["4h 40m", "total time"], ["3d", "streak"]].map(([val, label]) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{val}</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card content ──────────────────────────────────────────────────────────────

const CARDS = [
  {
    emoji: "🧭",
    heading: "Welcome to Compass",
    body: "A calm daily companion. Each morning it shapes a gentle plan around your energy and your goals. No pressure, no guilt — just a nudge in the right direction.",
    mock: null,
  },
  {
    emoji: "🌿",
    heading: "Start with a 30-second check-in",
    body: "Tell Compass how today feels and it shapes the plan to match — a lighter list on a rough day, more on a big one.",
    mock: <MockCheckinRow />,
  },
  {
    emoji: "✅",
    heading: "Tick to log — that's the whole trick",
    body: "Tap the circle on any suggestion to mark it done. Compass logs it for you and learns from it. The more you tick, the more personal your plan becomes.",
    mock: <MockSuggestionCard />,
  },
  {
    emoji: "🗓️",
    heading: "Capture everything, gently",
    body: "Did something off-plan? Use the Quick-log chips. Got events in your calendar? Tap 'done' right on the schedule. Yesterday's unfinished items carry over to today automatically.",
    mock: <MockCaptureRow />,
  },
  {
    emoji: "🌙",
    heading: "Close the loop",
    body: "After 4pm, rate your day with one tap. On the Review tab, see your week — sessions, streaks, and a preview of what's next.",
    mock: <MockCloseLoop />,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function IntroTour({ forceOpen, onClose }: IntroTourProps) {
  const pathname = usePathname();
  const { data: settings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  // Determine if auto-show conditions are met
  const shouldAutoShow =
    !isLoading &&
    !!settings?.onboarding_completed_at &&
    !settings?.tour_completed_at;

  const isHiddenRoute =
    pathname?.startsWith("/onboarding") || pathname === "/checkin";

  useEffect(() => {
    if (forceOpen) {
      setIndex(0);
      setVisible(true);
    } else if (shouldAutoShow && !isHiddenRoute) {
      setIndex(0);
      setVisible(true);
    }
  }, [forceOpen, shouldAutoShow, isHiddenRoute]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, CARDS.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function finish() {
    setVisible(false);
    // Only write the flag on first completion, not on replay
    if (!forceOpen || !settings?.tour_completed_at) {
      saveSettings.mutate({ tour_completed_at: new Date().toISOString() });
    }
    onClose?.();
  }

  if (!visible) return null;
  if (isHiddenRoute && !forceOpen) return null;

  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) finish(); }}
    >
      <div
        className="animate-pop w-full max-w-md rounded-3xl shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === index ? 20 : 6,
                  background: i === index ? "var(--primary)" : "var(--border)",
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-xs hover:opacity-100 transition-opacity"
            style={{ color: "var(--muted)" }}
          >
            Skip
          </button>
        </div>

        {/* Card content */}
        <div className="px-6 pb-2 pt-3 space-y-3">
          <div className="text-4xl">{card.emoji}</div>
          <h2 className="text-xl font-bold leading-snug">{card.heading}</h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {card.body}
          </p>
          {card.mock && (
            <div className="pt-1">
              {card.mock}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <button
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            className="text-sm transition-opacity hover:opacity-100"
            style={{ color: "var(--muted)", visibility: index === 0 ? "hidden" : "visible" }}
          >
            ← Back
          </button>

          {isLast ? (
            <button
              onClick={finish}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-105"
              style={{ background: "var(--primary)", color: "#fffdf9" }}
            >
              Start using Compass →
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-105"
              style={{ background: "var(--primary)", color: "#fffdf9" }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
