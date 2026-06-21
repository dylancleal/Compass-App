"use client";

import {
  useCategories,
  useCheckins,
  useMetricLogs,
  useMetrics,
  useSessions,
  useTasks,
} from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { metricSeries, weeklySessionCounts } from "@/lib/stats";
import { startOfWeek, todayKey } from "@/lib/date";
import { AreaTrend, BarTrend, LineTrend } from "@/components/charts";

export default function TrendsPage() {
  const { data: categories = [] } = useCategories();
  const { data: sessions = [] } = useSessions();
  const { data: tasks = [] } = useTasks();
  const { data: checkins = [] } = useCheckins();
  const { data: metrics = [] } = useMetrics();
  const { data: logs = [] } = useMetricLogs();

  const weekStart = startOfWeek(todayKey());
  const sessionsThisWeek = sessions.filter((s) => s.date >= weekStart).length;
  const tasksDoneThisWeek = tasks.filter(
    (t) => t.completed_at && t.completed_at.slice(0, 10) >= weekStart,
  ).length;

  const mentalSeries = [...checkins]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((c) => ({ date: c.date.slice(5), value: c.mental }));

  const activeCats = categories.filter((c) => c.active);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Your week</h1>
        <p className="text-sm text-[var(--muted)]">Here&apos;s what you&apos;ve been doing. Nice work.</p>
      </header>

      {/* Affirmation-first weekly review */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4" style={{ background: "#ecfdf5" }}>
          <p className="text-3xl font-bold" style={{ color: "#065f46" }}>
            {sessionsThisWeek}
          </p>
          <p className="text-sm text-[var(--muted)]">sessions logged this week</p>
        </div>
        <div className="card p-4" style={{ background: "#eff6ff" }}>
          <p className="text-3xl font-bold" style={{ color: "#1e40af" }}>
            {tasksDoneThisWeek}
          </p>
          <p className="text-sm text-[var(--muted)]">tasks completed this week</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-2 text-sm font-medium">How you&apos;ve been feeling</p>
        <AreaTrend data={mentalSeries} color="#10b981" />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Your mental check-in over time. Dips are part of the rhythm — be kind to yourself.
        </p>
      </div>

      {activeCats.map((cat) => {
        const accent = accentOf(cat.color);
        const numeric = metrics.filter(
          (m) => m.category_id === cat.id && (m.type === "numeric" || m.type === "scale"),
        );
        return (
          <div key={cat.id} className="card space-y-4 p-4">
            <p className="text-sm font-semibold" style={{ color: accent.text }}>
              {cat.icon} {cat.name}
            </p>
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">Sessions per week</p>
              <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent.accent} />
            </div>
            {numeric.map((m) => (
              <div key={m.id}>
                <p className="mb-1 text-xs text-[var(--muted)]">
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </p>
                <LineTrend data={metricSeries(logs, m.id)} color={accent.accent} unit={m.unit ?? ""} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
