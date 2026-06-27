"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCategories, useSessions, useSettings, useSessionTemplates } from "@/lib/queries";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { buildWeekPreview } from "@/lib/preview";
import { addDays, daysBetween, prettyDate, startOfWeek, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";

function fmtMin(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ReviewPage() {
  const today = todayKey();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const { data: sessions = [] } = useSessions();
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;

  const thisWeek = useMemo(
    () => sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd),
    [sessions, weekStart, weekEnd],
  );

  // Stats by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; totalMin: number }>();
    for (const s of thisWeek) {
      const existing = map.get(s.category_id) ?? { count: 0, totalMin: 0 };
      map.set(s.category_id, {
        count: existing.count + 1,
        totalMin: existing.totalMin + (s.duration_minutes ?? 0),
      });
    }
    return map;
  }, [thisWeek]);

  // Total minutes this week
  const totalMin = useMemo(
    () => thisWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0),
    [thisWeek],
  );

  // Study streak (consecutive days with a study session up to today)
  const studyCat = categories.find((c) => c.name === "Uni work");
  const studyDays = useMemo(
    () =>
      new Set(
        sessions.filter((s) => s.category_id === studyCat?.id).map((s) => s.date),
      ),
    [sessions, studyCat],
  );
  const studyStreak = useMemo(() => {
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < 60; i++) {
      if (studyDays.has(cursor)) streak++;
      else if (i > 0) break;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }, [studyDays, today]);

  // Active categories with sessions or goals this week
  const activeCats = categories.filter((c) => c.active);

  // Next week preview
  const nextWeekBase = {
    categories,
    tasks: [] as import("@/lib/types").Task[],
    sessions,
    settings: settings ?? {
      greetingName: "",
      weeklySchedule: { gym: [], tennis: [], study: [] },
      plannerWeights: { neglect: 1, deadline: 1, readiness: 1 },
    },
    calendarBlocks: [],
    library,
  };
  const nextPreview = useMemo(
    () =>
      settings
        ? buildWeekPreview({ ...nextWeekBase, settings }, 7)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!settings, library.length, categories.length],
  );

  return (
    <div className="mx-auto max-w-lg space-y-7">
      <header className="space-y-1">
        <p className="text-sm text-[var(--muted)]">
          {prettyDate(weekStart)} – {prettyDate(weekEnd)}
        </p>
        <h1 className="text-2xl font-bold">Your week in review</h1>
      </header>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            {thisWeek.length}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">sessions logged</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            {fmtMin(totalMin)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">total time</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            {studyStreak > 0 ? `${studyStreak}d` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">study streak</p>
        </div>
      </div>

      {/* Per-category breakdown */}
      {activeCats.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">By area</h2>
          <div className="space-y-2">
            {activeCats.map((cat) => {
              const accent = accentOf(cat.color).accent;
              const stats = byCategory.get(cat.id) ?? { count: 0, totalMin: 0 };
              const goal =
                cat.metadata?.weekly_goal ??
                cat.metadata?.tennis_weekly_goal ??
                cat.metadata?.custom_weekly_goal;
              const hit = goal ? stats.count >= goal : false;
              const progress = goal ? Math.min(stats.count / goal, 1) : null;

              return (
                <div
                  key={cat.id}
                  className="card flex items-center gap-3 px-4 py-3"
                  style={{ borderLeft: `3px solid ${accent}` }}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{cat.name}</p>
                      {hit && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: accent + "22", color: accent }}
                        >
                          goal ✓
                        </span>
                      )}
                    </div>
                    {progress !== null && (
                      <div
                        className="mt-1 h-1 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progress * 100}%`, background: accent }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{stats.count} {stats.count === 1 ? "session" : "sessions"}</p>
                    {stats.totalMin > 0 && (
                      <p className="text-xs text-[var(--muted)]">{fmtMin(stats.totalMin)}</p>
                    )}
                    {goal && (
                      <p className="text-xs text-[var(--muted)]">goal: {goal}/wk</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* No sessions at all */}
      {thisWeek.length === 0 && (
        <p className="card p-4 text-sm text-[var(--muted)]">
          No sessions logged this week yet — this updates as you tick off your plan.
        </p>
      )}

      {/* Next week preview */}
      {nextPreview.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Next week preview</h2>
          <div className="space-y-1.5">
            {nextPreview.map((day) => (
              <div
                key={day.date}
                className="card flex items-center gap-3 px-4 py-2.5"
              >
                <p
                  className="w-8 shrink-0 text-xs font-bold uppercase"
                  style={{ color: "var(--primary)" }}
                >
                  {day.weekdayLabel}
                </p>
                {day.items.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Rest</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {day.items.slice(0, 2).map((item, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                      >
                        {item.icon} {item.headline.split(" — ")[0].split(" ·")[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/"
        className="block text-center text-sm text-[var(--muted)] underline hover:text-[var(--foreground)]"
      >
        ← Back to today
      </Link>
    </div>
  );
}
