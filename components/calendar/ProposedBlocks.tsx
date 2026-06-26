"use client";

import type { CalendarBlock, Category, Task } from "@/lib/types";
import type { DraftSuggestion } from "@/lib/planner";
import { proposePlacementsForDay } from "@/lib/calendarPlan";
import { accentOf } from "@/lib/palette";
import { Button } from "@/components/ui";
import { todayKey } from "@/lib/date";

interface Props {
  suggestions: DraftSuggestion[];
  tasks: Task[];
  categories: Category[];
  existingBlocks: CalendarBlock[];
  dayKey: string;
  onConfirmAll: (blocks: Omit<CalendarBlock, "id" | "created_at">[]) => void;
}

export default function ProposedBlocks({
  suggestions,
  tasks,
  categories,
  existingBlocks,
  dayKey,
  onConfirmAll,
}: Props) {
  const { placed, unplaced } = proposePlacementsForDay(suggestions, tasks, existingBlocks, dayKey);

  if (placed.length === 0) return null;

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function handleConfirmAll() {
    const blocks: Omit<CalendarBlock, "id" | "created_at">[] = placed.map((p) => ({
      title: p.title,
      category_id: p.category_id,
      task_id: p.task_id,
      start_at: p.start_at,
      end_at: p.end_at,
      source: "compass" as const,
      busy: true,
      status: "planned" as const,
    }));
    onConfirmAll(blocks);
  }

  return (
    <div
      className="mb-4 rounded-2xl p-4 space-y-3"
      style={{ background: "var(--primary-soft)", border: "1px solid var(--mist)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
          🌿 Suggested for today
        </p>
        <Button onClick={handleConfirmAll} color="var(--primary)">
          Add all
        </Button>
      </div>

      <div className="space-y-1.5">
        {placed.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          const accent = accentOf(cat?.color ?? "slate");
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ background: "var(--surface)" }}
            >
              <span>{cat?.icon ?? "📅"}</span>
              <span className="flex-1 font-medium truncate">{p.title}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                {fmt(p.start_at)}–{fmt(p.end_at)}
              </span>
            </div>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {unplaced.length} suggestion{unplaced.length > 1 ? "s" : ""} couldn&apos;t fit in your day.
        </p>
      )}
    </div>
  );
}
