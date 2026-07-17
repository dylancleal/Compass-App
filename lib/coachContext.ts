// Pure, server-safe summarization of a user's own stats into a compact text
// block for the AI coach prompt (app/api/coach/route.ts). Deliberately never
// hands the model raw session rows — only aggregated numbers already computed
// by lib/stats.ts, so the prompt stays small (and cheap) regardless of how
// long someone's history is.

import type { AppSettings, Category, Session } from "@/lib/types";
import { bestMonth, bestWeek, currentStreak, longestStreakEver, weeklySessionCounts } from "@/lib/stats";
import { todayKey } from "@/lib/date";

export function buildCoachContext(
  categories: Pick<Category, "id" | "name" | "active">[],
  sessions: Pick<Session, "category_id" | "date" | "duration_minutes">[],
  settings: Pick<AppSettings, "trial_ends_at"> | undefined,
): string {
  const activeCats = categories.filter((c) => c.active);
  const lines: string[] = [];

  for (const cat of activeCats) {
    const catSessions = sessions.filter((s) => s.category_id === cat.id);
    const dates = catSessions.map((s) => s.date);
    const streak = currentStreak(dates);
    const longest = longestStreakEver(dates);
    const last4Weeks = weeklySessionCounts(sessions as Session[], cat.id, 4);
    const totalMinutes = catSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
    const best = bestWeek(sessions as Session[], cat.id);
    const bestMo = bestMonth(sessions as Session[], cat.id);

    lines.push(
      `${cat.name}: ${catSessions.length} sessions all-time, ${totalMinutes} total minutes. ` +
        `Current streak: ${streak} day${streak === 1 ? "" : "s"}. Longest streak ever: ${longest} day${longest === 1 ? "" : "s"}. ` +
        `Sessions/week last 4 weeks: ${last4Weeks.map((w) => w.count).join(", ")}. ` +
        `Best week ever: ${best?.count ?? 0} sessions. Best month ever: ${bestMo?.count ?? 0} sessions.`,
    );
  }

  if (lines.length === 0) return "No sessions logged yet for any active area.";
  return `Today's date: ${todayKey()}.\n` + lines.join("\n");
}
