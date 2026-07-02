import type { PlannerInput } from "@/lib/planner";
import type { Category, DayIndex, Session } from "@/lib/types";
import { buildPlan } from "@/lib/planner";
import { detectDomain } from "@/lib/categorySetup";
import { addDays, todayKey } from "@/lib/date";

export interface PreviewDay {
  date: string;
  weekdayLabel: string;
  items: { categoryName: string; icon: string; headline: string; estMin: number }[];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Spread n occurrences as evenly as possible across the 7-day week (0=Sun … 6=Sat).
// `phase` shifts the whole pattern so different categories don't all stack on the
// same weekday. 4 → Sun/Tue/Thu/Fri, 5 → Sun/Mon/Wed/Thu/Sat, etc.
function spreadDays(n: number, phase = 0): DayIndex[] {
  if (n <= 0) return [];
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  const step = 7 / n;
  return Array.from(
    { length: n },
    (_, i) => ((Math.round(i * step) + phase) % 7) as DayIndex,
  );
}

// How many times per week each category should appear in the preview, derived
// from the goals the user set during onboarding. This is what makes the preview
// honour "4× gym, 5× tennis" instead of the app's default schedule.
function weeklyFrequency(cat: Category, hasOpenTasks: boolean): number {
  const m = cat.metadata;
  switch (detectDomain(cat.name)) {
    case "gym":
      return m?.weekly_goal ?? 3;
    case "tennis":
      return m?.tennis_weekly_goal ?? m?.weekly_goal ?? 2;
    case "uni":
      // Without real assignments/tasks there's little to study for — keep it light
      // so the preview doesn't suggest study every weekday for no reason.
      return hasOpenTasks ? 4 : 2;
    case "job":
      return 2;
    case "finance":
      return 1;
    case "running":
    case "swimming":
      return m?.weekly_goal ?? 3;
    case "social":
      return 2;
    default:
      return m?.custom_weekly_goal ?? 2;
  }
}

// Simulate 7 days of plans using the real planner engine, so every headline,
// duration and science plan is the genuine article. Persists nothing.
//
// Each category is gated to a fixed set of weekdays derived from its weekly goal
// (a 4× goal → 4 days). On a category's scheduled day we run the planner with
// only that day's categories as candidates, so the preview reflects the user's
// goals rather than the planner greedily filling every day with everything.
//
// Simulated sessions accumulate across days using the actual suggested session
// type, so the planner's rotation logic carries over: gym cycles Push → Pull →
// Legs, tennis rotates Serve → Forehand → Backhand → Volleys, etc.
export function buildWeekPreview(
  base: Omit<PlannerInput, "date" | "checkin">,
  days = 7,
): PreviewDay[] {
  const today = todayKey();

  // Build each category's scheduled weekdays from its selected goal. A per-category
  // phase offset staggers the patterns so they spread across the week instead of
  // all clustering on Sunday.
  const schedule = new Map<string, Set<DayIndex>>();
  const n = base.categories.length;
  base.categories.forEach((cat, idx) => {
    const hasOpenTasks = base.tasks.some(
      (t) => t.category_id === cat.id && t.status !== "complete",
    );
    const phase = n > 0 ? Math.round((idx * 7) / n) : 0;
    schedule.set(cat.id, new Set(spreadDays(weeklyFrequency(cat, hasOpenTasks), phase)));
  });

  // Normal day — never force the whole plan into rest/recovery mode.
  const ASSUME = { capacity: "medium" as const, mental: 3, uni_readiness: 3 };

  // Accumulated simulated sessions feed the planner's neglect + rotation logic.
  const simulated: Session[] = [];

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const weekday = new Date(date + "T12:00:00").getDay() as DayIndex;

    // Only the categories scheduled for this weekday are candidates today.
    const todaysCats = base.categories.filter((c) => schedule.get(c.id)?.has(weekday));

    if (todaysCats.length === 0) {
      return { date, weekdayLabel: WEEKDAY[weekday], items: [] };
    }

    const plan = buildPlan({
      ...base,
      categories: todaysCats,
      sessions: simulated,
      date,
      assume: ASSUME,
    });

    // Record what was suggested as a simulated session so the next scheduled day
    // for this category rotates to the next session type rather than repeating.
    for (const s of plan) {
      if (s.category_id && (s.est_minutes ?? 0) > 0) {
        simulated.push({
          id: `preview-sim-${s.category_id}-${i}`,
          category_id: s.category_id,
          date,
          type: s.session_type ?? "Session",
          duration_minutes: 60,
          payload: {},
          created_at: new Date().toISOString(),
        });
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
