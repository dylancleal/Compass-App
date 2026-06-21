"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  useCategories,
  useMetricLogs,
  useMetrics,
  useSessions,
} from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { metricSeries, weeklySessionCounts, currentStreak } from "@/lib/stats";
import TaskList from "@/components/TaskList";
import LogSheet from "@/components/LogSheet";
import { BarTrend, LineTrend } from "@/components/charts";
import { Button } from "@/components/ui";

export default function CategoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: categories = [] } = useCategories();
  const { data: metrics = [] } = useMetrics();
  const { data: sessions = [] } = useSessions();
  const { data: logs = [] } = useMetricLogs();
  const [logOpen, setLogOpen] = useState(false);

  const category = categories.find((c) => c.id === id);
  if (!category) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">This area isn&apos;t available.</p>
        <Link href="/categories" className="underline">
          Back to areas
        </Link>
      </div>
    );
  }

  const accent = accentOf(category.color);
  const catMetrics = metrics.filter((m) => m.category_id === category.id);
  const catSessions = sessions.filter((s) => s.category_id === category.id);
  const streak = currentStreak(catSessions.map((s) => s.date));
  const weekly = weeklySessionCounts(sessions, category.id, 8);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/categories" className="text-[var(--muted)]">
          ←
        </Link>
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl text-xl"
          style={{ background: accent.soft }}
        >
          {category.icon}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: accent.text }}>
            {category.name}
          </h1>
          {streak >= 2 && (
            <p className="text-sm text-[var(--muted)]">🔥 {streak}-day streak — keep it gentle.</p>
          )}
        </div>
        <Button variant="primary" color={accent.accent} onClick={() => setLogOpen(true)}>
          + Log
        </Button>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">Tasks</h2>
        <TaskList categoryId={category.id} accent={accent.accent} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Trends</h2>

        <div className="card p-4">
          <p className="mb-2 text-sm font-medium">Sessions per week</p>
          <BarTrend data={weekly} color={accent.accent} />
        </div>

        {catMetrics
          .filter((m) => m.type === "numeric" || m.type === "scale")
          .map((m) => (
            <div key={m.id} className="card p-4">
              <p className="mb-2 text-sm font-medium">
                {m.name}
                {m.unit ? <span className="text-[var(--muted)]"> ({m.unit})</span> : null}
              </p>
              <LineTrend data={metricSeries(logs, m.id)} color={accent.accent} unit={m.unit ?? ""} />
            </div>
          ))}
      </section>

      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        category={category}
        metrics={catMetrics}
        accent={accent.accent}
      />
    </div>
  );
}
