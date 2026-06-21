"use client";

import { useState } from "react";
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
import type { Category, Metric, MetricLog, Session } from "@/lib/types";

export default function TrendsPage() {
  const { data: categories = [] } = useCategories();
  const { data: sessions = [] } = useSessions();
  const { data: tasks = [] } = useTasks();
  const { data: checkins = [] } = useCheckins();
  const { data: metrics = [] } = useMetrics();
  const { data: logs = [] } = useMetricLogs();

  const [selected, setSelected] = useState("overview");

  const weekStart = startOfWeek(todayKey());
  const sessionsThisWeek = sessions.filter((s) => s.date >= weekStart).length;
  const tasksDoneThisWeek = tasks.filter(
    (t) => t.completed_at && t.completed_at.slice(0, 10) >= weekStart,
  ).length;

  const mentalSeries = [...checkins]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((c) => ({ date: c.date.slice(5), value: c.mental }));

  const activeCats = categories.filter((c) => c.active);
  const selectedCat = activeCats.find((c) => c.id === selected);

  return (
    <div className="flex flex-col gap-4">
      {/* Area pill tabs */}
      <div
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        <Tab
          label="Overview"
          active={selected === "overview"}
          color="#334155"
          onClick={() => setSelected("overview")}
        />
        {activeCats.map((cat) => {
          const { accent } = accentOf(cat.color);
          return (
            <Tab
              key={cat.id}
              label={`${cat.icon} ${cat.name}`}
              active={selected === cat.id}
              color={accent}
              onClick={() => setSelected(cat.id)}
            />
          );
        })}
      </div>

      {/* Overview */}
      {selected === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4" style={{ background: "#ecfdf5" }}>
              <p className="text-3xl font-bold" style={{ color: "#065f46" }}>
                {sessionsThisWeek}
              </p>
              <p className="text-xs text-[var(--muted)]">sessions this week</p>
            </div>
            <div className="card p-4" style={{ background: "#eff6ff" }}>
              <p className="text-3xl font-bold" style={{ color: "#1e40af" }}>
                {tasksDoneThisWeek}
              </p>
              <p className="text-xs text-[var(--muted)]">tasks done this week</p>
            </div>
          </div>
          <div className="card p-4">
            <p className="mb-2 text-sm font-medium">How you&apos;ve been feeling</p>
            <AreaTrend data={mentalSeries} color="#10b981" />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Dips are part of the rhythm — be kind to yourself.
            </p>
          </div>
        </div>
      )}

      {/* Per-category view */}
      {selectedCat && (
        <CategoryPanel
          cat={selectedCat}
          sessions={sessions}
          metrics={metrics}
          logs={logs}
        />
      )}
    </div>
  );
}

function Tab({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
      style={{
        background: active ? color : "var(--surface)",
        color: active ? "#fff" : "var(--muted)",
        border: `1px solid ${active ? color : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

function CategoryPanel({
  cat,
  sessions,
  metrics,
  logs,
}: {
  cat: Category;
  sessions: Session[];
  metrics: Metric[];
  logs: MetricLog[];
}) {
  const { accent } = accentOf(cat.color);
  const numeric = metrics.filter(
    (m) => m.category_id === cat.id && (m.type === "numeric" || m.type === "scale"),
  );

  return (
    <div className="card space-y-5 p-4">
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--muted)]">Sessions per week</p>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent} />
      </div>
      {numeric.map((m) => (
        <div key={m.id}>
          <p className="mb-1 text-xs font-medium text-[var(--muted)]">
            {m.name}
            {m.unit ? ` (${m.unit})` : ""}
          </p>
          <LineTrend data={metricSeries(logs, m.id)} color={accent} unit={m.unit ?? ""} />
        </div>
      ))}
    </div>
  );
}
