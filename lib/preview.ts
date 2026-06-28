import type { PlannerInput } from "@/lib/planner";
import type { DayIndex, Session } from "@/lib/types";
import { buildPlan } from "@/lib/planner";
import { addDays, todayKey } from "@/lib/date";

export interface PreviewDay {
  date: string;
  weekdayLabel: string;
  items: { categoryName: string; icon: string; headline: string; estMin: number }[];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Spread n occurrences as evenly as possible across 7 days (0=Sun … 6=Sat).
function spreadDays(n: number): DayIndex[] {
  if (n <= 0) return [];
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  const step = 7 / n;
  return Array.from({ length: n }, (_, i) => (Math.round(i * step) % 7) as DayIndex);
}

// Simulate 7 days of plans using the planner engine.
// Persists nothing — pure function used for onboarding preview.
//
// We inject simulated sessions across days so the planner's neglect scoring
// naturally paces each category across the week rather than suggesting the
// same one every day. Each category that appears on day N is treated as
// "logged" on that date for the purposes of subsequent days.
//
// The weeklySchedule in settings is overridden with goal-derived day arrays so
// the preview reflects the user's actual selected goals, not the app defaults.
export function buildWeekPreview(
  base: Omit<PlannerInput, "date" | "checkin">,
  days = 7,
): PreviewDay[] {
  const today = todayKey();

  // Derive goal-based weekly schedule from each category's metadata so the
  // preview distributes categories according to what the user actually selected.
  const gymCat = base.categories.find((c) => c.name === "Gym");
  const tennisCat = base.categories.find((c) => c.name === "Tennis");
  const uniCat = base.categories.find((c) => c.name === "Uni work");
  const gymGoal = gymCat?.metadata?.weekly_goal;
  const tennisGoal = tennisCat?.metadata?.tennis_weekly_goal ?? tennisCat?.metadata?.weekly_goal;

  const previewSettings = {
    ...base.settings,
    weeklySchedule: {
      gym: gymGoal ? spreadDays(gymGoal) : base.settings.weeklySchedule.gym,
      tennis: tennisGoal ? spreadDays(tennisGoal) : base.settings.weeklySchedule.tennis,
      // Keep study on weekdays; if no tasks exist it scores lower anyway.
      study: uniCat ? spreadDays(5) : base.settings.weeklySchedule.study,
    },
  };

  // Low uni readiness when no tasks exist — study will still appear but won't dominate.
  const hasUniTasks = base.tasks.some((t) => {
    const uni = uniCat;
    return uni && t.category_id === uni.id && t.status !== "complete";
  });
  const ASSUME = {
    capacity: "medium" as const,
    mental: 3,
    uni_readiness: hasUniTasks ? 3 : 1,
  };

  // Track which day index each category was last shown AND the session type
  // that was suggested, so gym rotates Push→Pull→Legs and tennis cycles skills.
  const categoryLastDay = new Map<string, number>();
  const categoryLastType = new Map<string, string>();

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const weekday = new Date(date + "T12:00:00").getDay();

    // Inject a fake session for each category shown in prior preview days so
    // the planner sees recent activity and doesn't repeat the same category daily.
    // Use the actual suggested session_type so rotation logic (Push→Pull→Legs,
    // Serve→Forehand→Backhand→…) carries across days correctly.
    const simulatedSessions: Session[] = Array.from(categoryLastDay.entries()).map(
      ([catId, lastDay]) => ({
        id: `preview-sim-${catId}`,
        category_id: catId,
        date: addDays(today, lastDay),
        type: categoryLastType.get(catId) ?? "Session",
        duration_minutes: 60,
        payload: {},
        created_at: new Date().toISOString(),
      }),
    );

    const plan = buildPlan({
      ...base,
      settings: previewSettings,
      date,
      sessions: simulatedSessions,
      assume: ASSUME,
    });

    // Record categories that appeared so subsequent days can pace around them,
    // and record the session type so the next day's rotation picks it up.
    for (const s of plan) {
      if (s.category_id && (s.est_minutes ?? 0) > 0) {
        categoryLastDay.set(s.category_id, i);
        if (s.session_type) categoryLastType.set(s.category_id, s.session_type);
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
