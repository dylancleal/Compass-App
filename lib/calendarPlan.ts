// Thin adapter: converts planner suggestions into schedulable Intentions,
// then places them using the scheduling algorithm. Called by ProposedBlocks.
// Never auto-writes — returns ghost placements the user must confirm.

import type { DraftSuggestion } from "@/lib/planner";
import type { Task, CalendarBlock } from "@/lib/types";
import { placeIntentions, dayWindowFor } from "@/lib/schedule";

export interface DayWindow {
  startHour: number;
  endHour: number;
}

export function suggestionsToIntentions(
  suggestions: DraftSuggestion[],
  tasks: Task[],
) {
  return suggestions
    .filter((s) => (s.est_minutes ?? 0) > 0)
    .map((s) => {
      const task = tasks.find(
        (t) => t.category_id === s.category_id && t.status !== "complete" && t.due_date,
      );
      return {
        id: crypto.randomUUID(),
        title: s.text.split("\n")[0],
        durationMin: s.est_minutes ?? 30,
        category_id: s.category_id,
        task_id: task?.id,
        prefer: "earliest" as const,
        notAfter: task?.due_date
          ? new Date(`${task.due_date}T23:59:59`).getTime()
          : undefined,
      };
    });
}

export function proposePlacementsForDay(
  suggestions: DraftSuggestion[],
  tasks: Task[],
  existingBlocks: CalendarBlock[],
  dayKey: string,
  win: DayWindow = { startHour: 8, endHour: 21 },
) {
  const intentions = suggestionsToIntentions(suggestions, tasks);
  const day = dayWindowFor(dayKey, win);
  return placeIntentions(intentions, existingBlocks, day, { notBefore: Date.now() });
}
