// Detects days you didn't log or tick anything for, and reconstructs what the
// planner would have suggested on each one — so a missed day can be filled in
// retroactively instead of just silently nagging you about "today" forever.

import type { AppSettings, Category, Checkin, Session, SessionTemplate, Task } from "@/lib/types";
import type { DraftSuggestion } from "@/lib/planner";
import { buildPlan } from "@/lib/planner";
import { addDays } from "@/lib/date";

export interface MissedDay {
  date: string;
  weekdayLabel: string;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// How far back we'll ever prompt for. Bounded deliberately: remembering what
// you did 3 weeks ago is unreliable, and an unbounded list would be a wall of
// guilt rather than a quick catch-up. Independent of account age.
export const MISSED_DAYS_LOOKBACK = 7;

// A day counts as "handled" — not missed — if it has any logged session, any
// task completed that day, or the user deliberately closed the loop for it
// (an evening wrap rating, or an explicit catch-up dismissal). A mere morning
// check-in does NOT count as handled: checking in isn't the same as having
// done, or accounted for, anything that day.
export function findMissedDays(
  sessions: Session[],
  tasks: Task[],
  checkins: Checkin[],
  onboardingCompletedAt: string | undefined,
  today: string,
  lookbackDays: number = MISSED_DAYS_LOOKBACK,
): MissedDay[] {
  if (!onboardingCompletedAt) return []; // nothing to reconstruct before the app knew you

  const onboardingDate = onboardingCompletedAt.slice(0, 10);

  const handled = new Set<string>();
  for (const s of sessions) handled.add(s.date);
  for (const t of tasks) {
    // Same UTC-slice convention already used elsewhere (e.g. planner.ts
    // lastActivity) for turning a completed_at timestamp into a calendar day.
    if (t.completed_at) handled.add(t.completed_at.slice(0, 10));
  }
  for (const c of checkins) {
    if (c.extra?.evening_rating || c.extra?.catchup_reviewed) handled.add(c.date);
  }

  const windowStart = addDays(today, -lookbackDays);
  const earliest = onboardingDate > windowStart ? onboardingDate : windowStart;

  const missed: MissedDay[] = [];
  let cursor = addDays(today, -1); // today is still in progress — never "missed"
  while (cursor >= earliest) {
    if (!handled.has(cursor)) {
      const weekday = new Date(cursor + "T12:00:00").getDay();
      missed.push({ date: cursor, weekdayLabel: WEEKDAY[weekday] });
    }
    cursor = addDays(cursor, -1);
  }
  return missed.reverse(); // oldest first, so re-scoring cascades forward correctly
}

// Reconstructs what the planner would have suggested on a past date, using the
// same engine as the live plan. Two things matter for historical accuracy:
//  - only sessions logged BEFORE that date feed neglect/rotation scoring, so
//    backfilling day N-2 first correctly changes what day N-1 "would have" shown;
//  - tasks are rewound to how they looked as of that date (not created yet →
//    excluded; completed later → treated as still open), so a task finished
//    since isn't wrongly implied to have existed then.
// Calendar blocks and the real check-in are unknowable in hindsight, so this
// uses the same neutral "assume" baseline as the tomorrow-teaser/onboarding
// preview — a best-effort reconstruction, not a perfect replay.
export function reconstructMissedDayPlan(
  date: string,
  categories: Category[],
  tasks: Task[],
  sessions: Session[],
  settings: AppSettings,
  library: SessionTemplate[],
): DraftSuggestion[] {
  const sessionsBefore = sessions.filter((s) => s.date < date);
  const tasksAsOf = tasks
    .filter((t) => t.created_at.slice(0, 10) <= date)
    .map((t): Task =>
      t.completed_at && t.completed_at.slice(0, 10) > date
        ? { ...t, status: "not_started", completed_at: undefined }
        : t,
    );

  const plan = buildPlan({
    date,
    assume: { capacity: "medium", mental: 3, uni_readiness: 3 },
    categories,
    tasks: tasksAsOf,
    sessions: sessionsBefore,
    settings,
    calendarBlocks: [],
    library,
  });

  return plan.filter((s) => (s.est_minutes ?? 0) > 0 && !!s.category_id);
}
