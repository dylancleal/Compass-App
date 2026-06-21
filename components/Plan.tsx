"use client";

import { useEffect, useRef } from "react";
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
import { Button, Pill } from "./ui";
import TickCircle from "./TickCircle";

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

  if (!checkin) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Your day, gently planned</h2>
        <button onClick={regenerate} className="text-xs text-[var(--muted)] underline">
          refresh
        </button>
      </div>

      {visible.length === 0 && (
        <p className="card p-4 text-sm text-[var(--muted)]">
          Nothing pressing today — enjoy the breathing room.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((s) => {
          const cat = categories.find((c) => c.id === s.category_id);
          const accent = cat ? accentOf(cat.color).accent : "#10b981";
          const accepted = s.status === "accepted";
          const isAffirmation = s.est_minutes === 0;
          return (
            <div
              key={s.id}
              className="card animate-pop p-4"
              style={{ borderLeft: `3px solid ${accent}`, opacity: accepted && !isAffirmation ? 0.7 : 1 }}
            >
              <div className="flex items-start gap-3">
                {!isAffirmation && (
                  <div className="pt-0.5">
                    <TickCircle
                      checked={accepted}
                      accent={accent}
                      onChange={(n) =>
                        update.mutate({ id: s.id, patch: { status: n ? "accepted" : "pending" } })
                      }
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ whiteSpace: "pre-line" }}>{s.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {cat && <Pill color={accent}>{cat.icon} {cat.name}</Pill>}
                    {s.est_minutes ? <Pill color="#64748b">~{s.est_minutes} min</Pill> : null}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">{s.reason}</p>
                </div>
                {!isAffirmation && !accepted && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => update.mutate({ id: s.id, patch: { status: "snoozed" } })}
                      className="text-xs text-[var(--muted)]"
                      title="Snooze"
                    >
                      💤
                    </button>
                    <button
                      onClick={() => update.mutate({ id: s.id, patch: { status: "dismissed" } })}
                      className="text-xs text-[var(--muted)]"
                      title="Not today"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
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
