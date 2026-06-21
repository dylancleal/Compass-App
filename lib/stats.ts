import type { MetricLog, Session, Task } from "@/lib/types";
import { addDays, startOfWeek, todayKey } from "@/lib/date";

export function taskProgress(tasks: Task[]): { done: number; total: number; ratio: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "complete").length;
  return { done, total, ratio: total ? done / total : 0 };
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== "complete");
}

// Sessions per ISO week for the last `weeks` weeks (oldest → newest).
export function weeklySessionCounts(
  sessions: Session[],
  categoryId: string,
  weeks = 8,
): { week: string; count: number }[] {
  const out: { week: string; count: number }[] = [];
  let weekStart = startOfWeek(todayKey());
  const buckets: Record<string, number> = {};
  for (const s of sessions) {
    if (s.category_id !== categoryId) continue;
    const wk = startOfWeek(s.date);
    buckets[wk] = (buckets[wk] ?? 0) + 1;
  }
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = addDays(weekStart, -i * 7);
    out.push({ week: wk.slice(5), count: buckets[wk] ?? 0 });
  }
  void weekStart;
  return out;
}

// Numeric metric values over time (oldest → newest), for line charts.
export function metricSeries(
  logs: MetricLog[],
  metricId: string,
): { date: string; value: number }[] {
  return logs
    .filter((l) => l.metric_id === metricId && typeof l.value === "number")
    .map((l) => ({ date: l.date.slice(5), value: l.value as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function currentStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  let cursor = todayKey();
  for (let i = 0; i < 90; i++) {
    if (set.has(cursor)) streak++;
    else if (i > 0) break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
