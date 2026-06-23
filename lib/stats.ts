import type { Category, Checkin, MetricLog, Session, Task } from "@/lib/types";
import { addDays, daysBetween, startOfWeek, todayKey } from "@/lib/date";

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

// Activity heatmap: one row per active category, 28 day cells oldest→newest.
// Filters out categories with no sessions in the window.
export function activityHeatmap(
  sessions: Session[],
  categories: Pick<Category, "id" | "name">[],
  days = 28,
): { categoryId: string; categoryName: string; cells: { date: string; count: number }[] }[] {
  const today = todayKey();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(addDays(today, -i));

  const byCategory: Record<string, Set<string>> = {};
  for (const s of sessions) {
    if (!byCategory[s.category_id]) byCategory[s.category_id] = new Set();
    byCategory[s.category_id].add(s.date);
  }

  return categories
    .map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      cells: dates.map((date) => ({
        date,
        count: sessions.filter((s) => s.category_id === cat.id && s.date === date).length,
      })),
    }))
    .filter((row) => row.cells.some((c) => c.count > 0));
}

// Average energy-after-session per day, optionally filtered to one category.
export function energyByDay(
  sessions: Session[],
  days = 14,
  categoryId?: string,
): { date: string; energy: number; categoryId: string; label: string }[] {
  const today = todayKey();
  const DAY = ["S", "M", "T", "W", "T", "F", "S"];
  const filtered = categoryId ? sessions.filter((s) => s.category_id === categoryId) : sessions;

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const label = DAY[new Date(date + "T00:00:00").getDay()];
    const daySessions = filtered.filter((s) => s.date === date);
    const rated = daySessions.filter(
      (s) => (s.payload?.feedback as { energy_after?: number } | undefined)?.energy_after,
    );
    if (rated.length === 0) return { date, energy: 0, categoryId: "", label };
    const energy =
      rated.reduce((sum, s) => {
        return sum + ((s.payload?.feedback as { energy_after?: number } | undefined)?.energy_after ?? 0);
      }, 0) / rated.length;
    const catCount: Record<string, number> = {};
    for (const s of rated) catCount[s.category_id] = (catCount[s.category_id] ?? 0) + 1;
    const dominantCatId = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return { date, energy: Math.round(energy * 10) / 10, categoryId: dominantCatId, label };
  });
}

// Average post-session skill confidence per tennis skill.
export function skillConfidenceBySkill(
  sessions: Session[],
): { skill: string; avgConfidence: number; sessionCount: number }[] {
  const SKILLS = ["Serve", "Forehand", "Backhand", "Volleys"] as const;
  return SKILLS.map((skill) => {
    const skillSessions = sessions.filter((s) => s.type === skill);
    const rated = skillSessions.filter(
      (s) => (s.payload?.feedback as { skill_confidence?: number } | undefined)?.skill_confidence,
    );
    const avgConfidence =
      rated.length > 0
        ? rated.reduce((sum, s) => {
            return sum + ((s.payload?.feedback as { skill_confidence?: number } | undefined)?.skill_confidence ?? 0);
          }, 0) / rated.length
        : 0;
    return { skill, avgConfidence: Math.round(avgConfidence * 10) / 10, sessionCount: skillSessions.length };
  });
}

// 3-day momentum forecast from check-in history.
// Calculates average mental-score uplift on days following a session,
// then projects two tracks: natural drift vs doing the suggested session.
export function momentumForecast(
  checkins: Pick<Checkin, "date" | "mental">[],
  sessions: Session[],
  today: string,
): { label: string; date: string; baseline: number; withSessions: number }[] {
  const sorted = [...checkins].sort((a, b) => (a.date < b.date ? -1 : 1));

  let upliftTotal = 0;
  let upliftCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (daysBetween(prev.date, curr.date) !== 1) continue;
    if (sessions.some((s) => s.date === prev.date)) {
      upliftTotal += curr.mental - prev.mental;
      upliftCount++;
    }
  }
  const avgUplift = upliftCount >= 3 ? upliftTotal / upliftCount : 0.4;

  const last = [...sorted].reverse().find((c) => c.date <= today) ?? sorted[sorted.length - 1];
  const base = last?.mental ?? 3;
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return [1, 2, 3].map((i) => {
    const date = addDays(today, i);
    const label = DAY[new Date(date + "T00:00:00").getDay()];
    const baseline = Math.max(1, Math.min(5, Math.round((base - i * 0.15) * 10) / 10));
    const withSessions = Math.max(1, Math.min(5, Math.round((base + i * Math.min(avgUplift, 0.45)) * 10) / 10));
    return { label, date, baseline, withSessions };
  });
}

export type GoalStatus = "met" | "ontrack" | "behind";

// Weekly goal progress for one category: how many sessions done this week
// against the target, and whether the user is pacing to hit it.
export function weeklyGoalProgress(
  sessions: Session[],
  categoryId: string,
  target: number,
  today: string,
): {
  done: number;
  target: number;
  status: GoalStatus;
  remaining: number;
  daysLeft: number;
  expectedByNow: number;
} {
  const weekStart = startOfWeek(today);
  const done = sessions.filter(
    (s) => s.category_id === categoryId && s.date >= weekStart && s.date <= today,
  ).length;
  const daysElapsed = daysBetween(weekStart, today) + 1; // Mon counts as day 1
  const daysLeft = Math.max(0, 7 - daysElapsed);
  const expectedByNow = Math.round((target * daysElapsed) / 7);
  const remaining = Math.max(0, target - done);

  let status: GoalStatus;
  if (done >= target) status = "met";
  else if (done >= expectedByNow) status = "ontrack";
  else status = "behind";

  return { done, target, status, remaining, daysLeft, expectedByNow };
}

// Sensible default weekly target for a category, derived from the user's
// schedule where possible, before they set one explicitly.
export function defaultWeeklyTarget(
  categoryName: string,
  schedule?: { gym: unknown[]; tennis: unknown[]; study: unknown[] },
): number {
  if (!schedule) return 3;
  const n = categoryName.toLowerCase();
  if (n.includes("uni") || n.includes("study") || n.includes("school")) return schedule.study.length || 4;
  if (n.includes("gym") || n.includes("workout") || n.includes("train")) return schedule.gym.length || 3;
  if (n.includes("tennis")) return schedule.tennis.length || 2;
  return 3;
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
