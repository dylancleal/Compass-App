"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCategories,
  useCheckin,
  useSaveSuggestions,
  useSessions,
  useSettings,
  useSuggestions,
  useTasks,
  useUpdateSuggestion,
} from "@/lib/queries";
import { buildPlan } from "@/lib/planner";
import { todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import type { Suggestion, Category } from "@/lib/types";
import { Button, Pill } from "./ui";
import TickCircle from "./TickCircle";

const RAIN_COLORS = ["#5b8a72", "#a8c3b5", "#d98e63", "#c9b46b", "#7faf97", "#3e6b54"];

export default function Plan() {
  const today = todayKey();
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useSessions();
  const { data: settings } = useSettings();
  const { data: checkin } = useCheckin(today);
  const { data: suggestions = [], isLoading } = useSuggestions(today);

  const save = useSaveSuggestions();
  const update = useUpdateSuggestion(today);
  const generatedRef = useRef(false);

  // Generate the plan once per day after check-in, persisting it so accept/
  // dismiss choices survive reloads. Regeneration keeps prior feedback.
  useEffect(() => {
    if (!settings || !checkin || isLoading) return;
    if (generatedRef.current) return;
    if (suggestions.length > 0) return;
    generatedRef.current = true;
    const draft = buildPlan({ date: today, checkin, categories, tasks, sessions, settings });
    save.mutate({ date: today, items: draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, checkin, isLoading, suggestions.length]);

  function regenerate() {
    if (!settings || !checkin) return;
    const draft = buildPlan({ date: today, checkin, categories, tasks, sessions, settings });
    save.mutate({ date: today, items: draft });
  }

  const visible = suggestions.filter((s) => s.status !== "dismissed" && s.status !== "snoozed");
  const actionable = visible.filter((s) => s.est_minutes !== 0);
  const doneCount = actionable.filter((s) => s.status === "accepted").length;
  const allDone = actionable.length > 0 && doneCount === actionable.length;

  // Fogg's B=MAP: surface exactly one obvious next action so the plan never
  // reads as an equally-weighted wall. The first not-yet-done session leads.
  const nextId = actionable.find((s) => s.status !== "accepted")?.id;

  // Fire the celebration only on the transition into "all done", never on load.
  const [celebrating, setCelebrating] = useState(false);
  const mounted = useRef(false);
  const wasAllDone = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      wasAllDone.current = allDone;
      return;
    }
    if (allDone && !wasAllDone.current) {
      setCelebrating(true);
      const t = window.setTimeout(() => setCelebrating(false), 2800);
      wasAllDone.current = allDone;
      return () => window.clearTimeout(t);
    }
    wasAllDone.current = allDone;
  }, [allDone]);

  if (!checkin) return null;

  return (
    <section className="space-y-3">
      {celebrating && <ConfettiRain />}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Your day, gently planned</h2>
        <div className="flex items-center gap-3">
          {actionable.length > 0 && (
            <span className="text-xs font-medium text-[var(--muted)]">
              {doneCount}/{actionable.length} done
            </span>
          )}
          <button onClick={regenerate} className="text-xs text-[var(--muted)] underline hover:text-[var(--foreground)] hover:opacity-100">
            refresh
          </button>
        </div>
      </div>

      {allDone && (
        <div
          className="animate-celebrate rounded-2xl p-4 text-center"
          style={{ background: "linear-gradient(135deg, #5b8a72, #3e6b54)", color: "#fffdf9" }}
        >
          <p className="text-base font-bold">Day complete 🎉</p>
          <p className="text-xs opacity-90">
            Every session ticked off — that&apos;s the whole plan. Beautifully done.
          </p>
        </div>
      )}

      {visible.length === 0 && (
        <p className="card p-4 text-sm text-[var(--muted)]">
          Nothing pressing today — enjoy the breathing room.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((s) => {
          const cat = categories.find((c) => c.id === s.category_id);
          const accent = cat ? accentOf(cat.color).accent : "#5b8a72";
          return s.est_minutes === 0 ? (
            <Affirmation key={s.id} suggestion={s} />
          ) : (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              category={cat}
              accent={accent}
              isNext={s.id === nextId}
              onToggle={(n) =>
                update.mutate({ id: s.id, patch: { status: n ? "accepted" : "pending" } })
              }
              onSnooze={() => update.mutate({ id: s.id, patch: { status: "snoozed" } })}
              onDismiss={() => update.mutate({ id: s.id, patch: { status: "dismissed" } })}
            />
          );
        })}
      </div>

      {suggestions.some((s) => s.status === "snoozed") && (
        <Button
          variant="ghost"
          onClick={() =>
            suggestions
              .filter((s) => s.status === "snoozed")
              .forEach((s) => update.mutate({ id: s.id, patch: { status: "pending" } }))
          }
        >
          Bring back snoozed
        </Button>
      )}
    </section>
  );
}

// ── Actionable session card, with collapsible "how to approach" steps ─────────

function SuggestionCard({
  suggestion: s,
  category: cat,
  accent,
  isNext = false,
  onToggle,
  onSnooze,
  onDismiss,
}: {
  suggestion: Suggestion;
  category?: Category;
  accent: string;
  isNext?: boolean;
  onToggle: (next: boolean) => void;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  const accepted = s.status === "accepted";
  const [open, setOpen] = useState(false);
  const highlight = isNext && !accepted;

  // The suggestion text packs a header (and maybe a "Task:" line) followed by
  // "· " bullet steps. Split so the headline stays, the steps tuck away.
  const lines = s.text.split("\n");
  const headerLines = lines.filter((l) => !l.trimStart().startsWith("·"));
  const steps = lines
    .filter((l) => l.trimStart().startsWith("·"))
    .map((l) => l.replace(/^\s*·\s*/, ""));

  return (
    <div
      className={`card animate-pop p-4 ${highlight ? "animate-breathe" : ""}`}
      style={{
        borderLeft: `3px solid ${accent}`,
        opacity: accepted ? 0.72 : 1,
        ...(highlight
          ? { borderColor: accent, boxShadow: `0 0 0 1.5px ${accent}55` }
          : {}),
      }}
    >
      {highlight && (
        <div
          className="mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: accent + "1f", color: accent }}
        >
          <span aria-hidden>🌿</span> Start here
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <TickCircle checked={accepted} accent={accent} onChange={onToggle} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{headerLines[0]}</p>
          {headerLines.slice(1).map((line, i) => (
            <p key={i} className="mt-0.5 text-sm text-[var(--muted)]">
              {line}
            </p>
          ))}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {cat && (
              <Pill color={accent}>
                {cat.icon} {cat.name}
              </Pill>
            )}
            {s.est_minutes ? <Pill color="#7d7c6e">~{s.est_minutes} min</Pill> : null}
          </div>

          {steps.length > 0 && (
            <div className="mt-2.5">
              <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all hover:brightness-95 hover:opacity-100"
                style={{ background: accent + "14", color: accent }}
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>📋</span>
                  {open ? "Hide the approach" : `How to approach this — ${steps.length} steps`}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div className={`collapsible ${open ? "open" : ""}`}>
                <div>
                  <ol className="mt-2 space-y-1.5 pl-1">
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-snug">
                        <span
                          className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                          style={{ background: accent + "22", color: accent }}
                        >
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-[var(--muted)]">{s.reason}</p>
        </div>

        {!accepted && (
          <div className="flex flex-col gap-1">
            <button onClick={onSnooze} className="text-xs text-[var(--muted)] hover:scale-125 hover:opacity-100" title="Snooze">
              💤
            </button>
            <button onClick={onDismiss} className="text-xs text-[var(--muted)] hover:scale-125 hover:text-[#c06b5a] hover:opacity-100" title="Not today">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Affirmation / momentum note — visually distinct from actionable cards ─────

function Affirmation({ suggestion: s }: { suggestion: Suggestion }) {
  return (
    <div
      className="animate-pop relative overflow-hidden rounded-2xl p-3.5"
      style={{
        background: "linear-gradient(135deg, #f0fdf4, #ecfeff)",
        border: "1px dashed #a7f3d0",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
          style={{ background: "#ffffffcc" }}
          aria-hidden
        >
          🌱
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#065f46" }}>
            {s.text}
          </p>
          <p className="text-xs" style={{ color: "#059669" }}>
            {s.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Full-screen confetti rain for the all-done celebration ────────────────────

function ConfettiRain() {
  const pieces = Array.from({ length: 64 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const size = 6 + Math.random() * 7;
        return (
          <span
            key={i}
            className="confetti-rain-piece"
            style={
              {
                left: `${Math.random() * 100}%`,
                width: size,
                height: size,
                background: RAIN_COLORS[i % RAIN_COLORS.length],
                animationDelay: `${Math.random() * 0.7}s`,
                animationDuration: `${1.6 + Math.random() * 1.3}s`,
                "--rot": `${Math.random() * 720 - 360}deg`,
                "--drift": `${Math.random() * 90 - 45}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
