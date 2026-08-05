"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCategories, useCheckins, useSessions, useSettings, useSessionTemplates } from "@/lib/queries";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { monthlyRecap, protectedStreak } from "@/lib/stats";
import { useAccessLevel } from "@/lib/subscription";
import { buildWeekPreview } from "@/lib/preview";
import { addDays, daysBetween, prettyDate, startOfWeek, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { AnimatedBar, IconChip } from "@/components/ui";
import ProgressTabs from "@/components/ProgressTabs";
import ShareRecapCard from "@/components/ShareRecapCard";
import { useCountUp } from "@/lib/useCountUp";

function fmtMin(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// A headline number that counts up from 0 on mount.
function StatNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const v = useCountUp(value);
  const rounded = Math.round(v);
  return <>{format ? format(rounded) : String(rounded)}</>;
}

export default function ReviewPage() {
  const today = todayKey();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const { data: sessions = [] } = useSessions();
  const { data: categories = [] } = useCategories();
  const { data: checkins = [] } = useCheckins();
  const { data: settings } = useSettings();
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const accessLevel = useAccessLevel();
  const recap = useMemo(() => monthlyRecap(sessions, today.slice(0, 7)), [sessions, today]);

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

  // Active-area streak — a day with no session still counts as long as it
  // was a deliberate rest (a Light check-in or a "Rough" evening). Respect
  // over guilt. Combines every active category (not just one hardcoded
  // area), so this degrades correctly to single-category behavior for a
  // free-tier or Compass account and generalizes for multi-area accounts.
  const activeCats = categories.filter((c) => c.active);
  const studyDays = useMemo(
    () =>
      new Set(
        sessions.filter((s) => activeCats.some((c) => c.id === s.category_id)).map((s) => s.date),
      ),
    [sessions, activeCats],
  );
  const protectedDays = useMemo(
    () =>
      new Set(
        checkins
          .filter((c) => c.capacity === "light" || c.extra?.evening_rating === 1)
          .map((c) => c.date),
      ),
    [checkins],
  );
  const { streak: studyStreak, protectedUsed } = useMemo(
    () => protectedStreak(studyDays, protectedDays, today),
    [studyDays, protectedDays, today],
  );

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
  // Next Monday, not today — buildWeekPreview defaults to "starting now,"
  // which put today's date under both "This week" and "Next week preview"
  // at once.
  const nextMonday = addDays(startOfWeek(today), 7);
  const nextPreview = useMemo(
    () =>
      settings
        ? buildWeekPreview({ ...nextWeekBase, settings }, 7, nextMonday)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!settings, library.length, categories.length, nextMonday],
  );

  return (
    <div className="mx-auto max-w-lg space-y-7">
      <header className="space-y-1">
        <p className="text-sm text-[var(--muted)]">
          {prettyDate(weekStart)} – {prettyDate(weekEnd)}
        </p>
        <h1 className="text-2xl font-bold">Progress</h1>
      </header>

      <ProgressTabs />

      {/* Headline numbers */}
      <div data-tour="review-stats" className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            <StatNumber value={thisWeek.length} />
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">sessions logged</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            <StatNumber value={totalMin} format={fmtMin} />
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">total time</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            <StatNumber
              value={studyStreak}
              format={(n) => (n > 0 ? `${n}d${protectedUsed ? " 🛡" : ""}` : "—")}
            />
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            🔥 streak{protectedUsed ? " · protected" : ""}
          </p>
        </div>
      </div>

      {/* Shareable recap — only worth offering once there's something to
          show off; an empty-stats card would just look like an ad for a
          quiet week. */}
      {thisWeek.length > 0 && (
        <ShareRecapCard
          dateRange={`${prettyDate(weekStart)} – ${prettyDate(weekEnd)}`}
          sessionCount={thisWeek.length}
          timeLabel={fmtMin(totalMin)}
          streak={studyStreak}
          byArea={activeCats
            .map((cat) => ({
              icon: cat.icon,
              name: cat.name,
              count: byCategory.get(cat.id)?.count ?? 0,
            }))
            .filter((a) => a.count > 0)}
        />
      )}

      {/* Per-category breakdown */}
      {activeCats.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">By area</h2>
          <div className="space-y-2">
            {activeCats.map((cat, i) => {
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
                  className="card animate-fade-slide flex items-center gap-3 px-4 py-3"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <IconChip emoji={cat.icon} color={accent} size={40} />
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
                      <div className="mt-1">
                        <AnimatedBar pct={progress * 100} color={accent} height={4} track="var(--border)" />
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

      {/* Empty state — only when there's no "By area" section above to carry
          the message itself (each zeroed area card already says "0
          sessions"; critique found both rendering at once said the same
          thing twice). */}
      {thisWeek.length === 0 && activeCats.length === 0 && (
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

      {/* Monthly recap — paid-tier only, the kind of thing that only means
          something once you've been at this a while. */}
      {accessLevel !== "free" && recap.totalSessions > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">This month</h2>
          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-medium leading-none" style={{ color: "var(--primary)" }}>
                  {recap.totalSessions}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  sessions
                  {recap.comparedToPrevMonth.sessionsDelta !== 0 && (
                    <span style={{ color: recap.comparedToPrevMonth.sessionsDelta > 0 ? "#1d9e75" : "#c06b5a" }}>
                      {" "}
                      {recap.comparedToPrevMonth.sessionsDelta > 0 ? "+" : ""}
                      {recap.comparedToPrevMonth.sessionsDelta} vs last month
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-2xl font-medium leading-none" style={{ color: "var(--primary)" }}>
                  {fmtMin(recap.totalMinutes)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  total time
                  {recap.comparedToPrevMonth.minutesDelta !== 0 && (
                    <span style={{ color: recap.comparedToPrevMonth.minutesDelta > 0 ? "#1d9e75" : "#c06b5a" }}>
                      {" "}
                      {recap.comparedToPrevMonth.minutesDelta > 0 ? "+" : ""}
                      {fmtMin(Math.abs(recap.comparedToPrevMonth.minutesDelta))} vs last month
                    </span>
                  )}
                </p>
              </div>
            </div>
            {recap.byCategory.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                {recap.byCategory.map(({ categoryId, count }) => {
                  const cat = categories.find((c) => c.id === categoryId);
                  return (
                    <span
                      key={categoryId}
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      {cat?.icon ?? "📋"} {cat?.name ?? "Other"} · {count}
                    </span>
                  );
                })}
              </div>
            )}
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
