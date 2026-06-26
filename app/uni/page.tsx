"use client";

import Link from "next/link";
import { useState } from "react";
import { useCategories, useMetrics, useSessions, useTasks } from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { daysBetween, prettyDate, startOfWeek, todayKey } from "@/lib/date";
import TaskList from "@/components/TaskList";
import LogSheet from "@/components/LogSheet";
import { Button, Pill } from "@/components/ui";

function untilLabel(due: string): { text: string; color: string } {
  const d = daysBetween(todayKey(), due);
  if (d < 0) return { text: "let's find time for this", color: "#9a6a1f" };
  if (d === 0) return { text: "due today", color: "#2f6357" };
  if (d <= 3) return { text: `in ${d} day${d === 1 ? "" : "s"}`, color: "#9a6a1f" };
  return { text: `in ${d} days`, color: "#7d7c6e" };
}

export default function UniPage() {
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useSessions();
  const { data: metrics = [] } = useMetrics();
  const [logOpen, setLogOpen] = useState(false);

  const uni = categories.find((c) => c.name === "Uni work" && c.active) ?? categories.find((c) => c.active);
  if (!uni) {
    return <p className="text-sm text-[var(--muted)]">Add a uni area in Settings to get started.</p>;
  }
  const accent = accentOf(uni.color);

  const uniTasks = tasks.filter((t) => t.category_id === uni.id);
  const upcoming = uniTasks
    .filter((t) => t.status !== "complete" && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const weekStart = startOfWeek(todayKey());
  const studyThisWeek = sessions.filter((s) => s.category_id === uni.id && s.date >= weekStart);
  const minutesThisWeek = studyThisWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl text-xl"
          style={{ background: accent.soft }}
        >
          {uni.icon}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: accent.text }}>
            Uni work
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {studyThisWeek.length} session{studyThisWeek.length === 1 ? "" : "s"} this week
            {minutesThisWeek ? ` · ${minutesThisWeek} min` : ""}
          </p>
        </div>
        <Button variant="primary" color={accent.accent} onClick={() => setLogOpen(true)}>
          + Study log
        </Button>
      </header>

      {/* Affirming nudge — spread work out, beat the cram (SPEC §7) */}
      <div className="card p-4" style={{ background: accent.soft }}>
        <p className="text-sm" style={{ color: accent.text }}>
          {upcoming.length === 0
            ? "No deadlines on the radar — a calm stretch. Keep a little momentum going."
            : "Little and often beats cramming. A short session today is worth more than a long one the night before."}
        </p>
      </div>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Upcoming deadlines</h2>
          <div className="space-y-2">
            {upcoming.map((t) => {
              const u = untilLabel(t.due_date!);
              return (
                <div key={t.id} className="card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-[var(--muted)]">{prettyDate(t.due_date!)}</p>
                  </div>
                  <Pill color={u.color}>{u.text}</Pill>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">All uni tasks</h2>
        <TaskList categoryId={uni.id} accent={accent.accent} />
      </section>

      <p className="text-center text-xs text-[var(--muted)]">
        Backwards planning, time-estimation learning and study-technique tips arrive in Phase 3.{" "}
        <Link href="/categories" className="underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105">
          See all areas
        </Link>
      </p>

      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        category={uni}
        metrics={metrics.filter((m) => m.category_id === uni.id)}
        accent={accent.accent}
      />
    </div>
  );
}
