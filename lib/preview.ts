import type { PlannerInput } from "@/lib/planner";
import type { Session } from "@/lib/types";
import { buildPlan } from "@/lib/planner";
import { addDays, todayKey } from "@/lib/date";

export interface PreviewDay {
  date: string;
  weekdayLabel: string;
  items: { categoryName: string; icon: string; headline: string; estMin: number }[];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ASSUME = { capacity: "medium" as const, mental: 3, uni_readiness: 3 };

// Simulate 7 days of plans using the planner engine.
// Persists nothing — pure function used for onboarding preview.
//
// We inject simulated sessions across days so the planner's neglect scoring
// naturally paces each category across the week rather than suggesting the
// same one every day. Each category that appears on day N is treated as
// "logged" on that date for the purposes of subsequent days.
export function buildWeekPreview(
  base: Omit<PlannerInput, "date" | "checkin">,
  days = 7,
): PreviewDay[] {
  const today = todayKey();
  // Track which day index each category was last shown (for simulated sessions).
  const categoryLastDay = new Map<string, number>();

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const weekday = new Date(date + "T12:00:00").getDay();

    // Inject a fake session for each category shown in prior preview days so
    // the planner sees recent activity and doesn't repeat the same category daily.
    const simulatedSessions: Session[] = Array.from(categoryLastDay.entries()).map(
      ([catId, lastDay]) => ({
        id: `preview-sim-${catId}`,
        category_id: catId,
        date: addDays(today, lastDay),
        type: "Session",
        duration_minutes: 60,
        payload: {},
        created_at: new Date().toISOString(),
      }),
    );

    const plan = buildPlan({
      ...base,
      date,
      sessions: simulatedSessions,
      assume: ASSUME,
    });

    // Record categories that appeared so subsequent days can pace around them.
    for (const s of plan) {
      if (s.category_id && (s.est_minutes ?? 0) > 0) {
        categoryLastDay.set(s.category_id, i);
      }
    }

    const items = plan
      .filter((s) => (s.est_minutes ?? 0) > 0 && s.category_id)
      .map((s) => {
        const cat = base.categories.find((c) => c.id === s.category_id);
        return {
          categoryName: cat?.name ?? "Session",
          icon: cat?.icon ?? "🌿",
          headline: s.text.split("\n")[0],
          estMin: s.est_minutes ?? 0,
        };
      });

    return { date, weekdayLabel: WEEKDAY[weekday], items };
  });
}
