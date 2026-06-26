"use client";

import type { Task, Category } from "@/lib/types";
import { accentOf } from "@/lib/palette";

interface Props {
  tasks: Task[];
  categories: Category[];
  rangeStart: string;
  rangeEnd: string;
  onSchedule: (task: Task) => void;
}

export default function DeadlineRail({ tasks, categories, rangeStart, rangeEnd, onSchedule }: Props) {
  const due = tasks.filter(
    (t) => t.due_date && t.due_date >= rangeStart && t.due_date <= rangeEnd && t.status !== "complete",
  );

  if (due.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1.5 px-1">
      {due.map((task) => {
        const cat = categories.find((c) => c.id === task.category_id);
        const accent = accentOf(cat?.color ?? "slate");
        const isToday = task.due_date === new Date().toISOString().slice(0, 10);
        const isOverdue = task.due_date! < new Date().toISOString().slice(0, 10);
        return (
          <button
            key={task.id}
            onClick={() => onSchedule(task)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:scale-105"
            style={{
              background: isOverdue ? "#f8ece8" : accent.soft,
              color: isOverdue ? "#c06b5a" : accent.text,
              border: `1px solid ${isOverdue ? "#c06b5a33" : accent.accent + "33"}`,
            }}
          >
            <span>{cat?.icon ?? "📌"}</span>
            <span className="max-w-[120px] truncate">{task.title}</span>
            <span className="opacity-60">
              {isOverdue ? "overdue" : isToday ? "today" : `due ${task.due_date!.slice(5)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
