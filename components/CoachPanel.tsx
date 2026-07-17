"use client";

import { useEffect, useState } from "react";
import { APP_VARIANT } from "@/lib/appVariant";
import { useAskCoach, useWeeklyInsight } from "@/lib/coach";
import { SectionLabel } from "@/components/charts";

// Lodestone paid-tier only — mirrors the Settings "Subscription" section
// pattern (gated on APP_VARIANT, not accessLevel, so it never renders at all
// for Compass). Caller is expected to additionally gate on accessLevel.
export default function CoachPanel() {
  if (APP_VARIANT.id !== "study") return null;
  return <CoachPanelInner />;
}

function CoachPanelInner() {
  const weekly = useWeeklyInsight();
  const askCoach = useAskCoach();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (weekly.isStale && !weekly.isPending) {
      weekly.generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekly.isStale]);

  function ask() {
    const q = question.trim();
    if (!q) return;
    setAnswer(null);
    setError(null);
    askCoach.mutate(q, {
      onSuccess: (reply) => setAnswer(reply),
      onError: () => setError("Couldn't reach your coach — try again in a moment."),
    });
  }

  return (
    <div>
      <SectionLabel>Your coach</SectionLabel>
      <div className="card space-y-3 p-4">
        {weekly.cached ? (
          <p className="text-sm leading-relaxed">{weekly.cached}</p>
        ) : (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {weekly.isPending ? "Thinking about your week…" : "Log a few sessions to get your first insight."}
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask about your progress…"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          />
          <button
            onClick={ask}
            disabled={askCoach.isPending || !question.trim()}
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-[#fffdf9] transition-all hover:brightness-105 disabled:opacity-40"
            style={{ background: "var(--primary)" }}
          >
            {askCoach.isPending ? "…" : "Ask"}
          </button>
        </div>

        {answer && (
          <p className="rounded-xl p-3 text-sm leading-relaxed" style={{ background: "var(--accent-soft)" }}>
            {answer}
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--warn-text)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
