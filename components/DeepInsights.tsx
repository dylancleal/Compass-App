"use client";

import { bestMonth, bestWeek, cumulativeMinutesSeries, longestStreakEver, weeklySessionCounts } from "@/lib/stats";
import { AreaTrend, BarTrend, SectionLabel, StatRow } from "@/components/charts";
import type { Category, Session } from "@/lib/types";

// Paid-tier-only deepening of a category panel: all-time bests, a longer
// (26-week) session-count chart, and a cumulative-time-invested chart — the
// kind of value that only compounds the longer someone stays subscribed.
export default function DeepInsights({
  cat,
  sessions,
  accent,
}: {
  cat: Category;
  sessions: Session[];
  accent: string;
}) {
  const catSessions = sessions.filter((s) => s.category_id === cat.id);
  const longest = longestStreakEver(catSessions.map((s) => s.date));
  const best = bestWeek(sessions, cat.id);
  const bestMo = bestMonth(sessions, cat.id);

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>All-time bests</SectionLabel>
        <StatRow
          stats={[
            { value: longest > 0 ? `${longest}d` : "—", label: "longest streak ever" },
            { value: best?.count ?? "—", label: "best week" },
            { value: bestMo?.count ?? "—", label: "best month" },
          ]}
        />
      </div>
      <div>
        <SectionLabel>Sessions per week — last 6 months</SectionLabel>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 26)} color={accent} />
      </div>
      <div>
        <SectionLabel>Cumulative time invested</SectionLabel>
        <AreaTrend data={cumulativeMinutesSeries(sessions, cat.id)} color={accent} />
      </div>
    </div>
  );
}
