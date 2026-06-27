"use client";

import type { CalendarBlock, Category, Task } from "@/lib/types";
import { accentOf } from "@/lib/palette";
import { addDays, prettyDate, todayKey } from "@/lib/date";
import { isDeadlineLike } from "@/lib/categoryMatcher";
import DeadlineChip from "./DeadlineChip";

const DAYS_AHEAD = 14;

interface Props {
  blocks: CalendarBlock[];
  tasks: Task[];
  categories: Category[];
  rangeStart: string;
  conflictIds?: Set<string>;
  onClickBlock: (block: CalendarBlock) => void;
}

export default function AgendaView({ blocks, tasks, categories, rangeStart, conflictIds, onClickBlock }: Props) {
  const today = todayKey();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(rangeStart, i));

  function blocksFor(dayKey: string) {
    return blocks
      .filter((b) => todayKey(new Date(b.start_at)) === dayKey)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  function dueTasks(dayKey: string) {
    // Exclude calendar-sourced tasks — they show alongside their originating block
    return tasks.filter(
      (t) => t.due_date === dayKey && t.status !== "complete" && t.source !== "calendar",
    );
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayBlocks = blocksFor(day);
        const dayTasks = dueTasks(day);
        if (dayBlocks.length === 0 && dayTasks.length === 0) return null;
        const isToday = day === today;

        return (
          <div key={day}>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: isToday ? "var(--primary)" : "var(--muted)" }}
            >
              {isToday ? "Today" : prettyDate(day)}
            </h3>

            <div className="space-y-1.5">
              {dayTasks.map((task) => {
                const cat = categories.find((c) => c.id === task.category_id);
                const accent = accentOf(cat?.color ?? "slate");
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "var(--accent-soft)",
                      borderLeft: `3px solid var(--accent)`,
                    }}
                  >
                    <span>{cat?.icon ?? "📌"}</span>
                    <span className="flex-1 font-medium truncate">{task.title}</span>
                    <span className="text-xs" style={{ color: "var(--accent)" }}>due</span>
                  </div>
                );
              })}

              {dayBlocks.map((block) => {
                const cat = categories.find((c) => c.id === block.category_id);
                const accent = accentOf(cat?.color ?? "slate");
                const isGhost = block.source === "compass";
                const isConflict = conflictIds?.has(block.id) ?? false;
                const alreadyTasked = tasks.some(
                  (t) => t.source === "calendar" && t.title === block.title,
                );
                return (
                  <div
                    key={block.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
                    style={{
                      background: isConflict ? "#fef9ec" : isGhost ? "transparent" : accent.soft,
                      border: isConflict
                        ? "1.5px solid #e8c84088"
                        : isGhost
                        ? `1.5px dashed ${accent.accent}`
                        : `1px solid ${accent.accent}22`,
                    }}
                  >
                    <button
                      onClick={() => onClickBlock(block)}
                      className="flex flex-1 items-center gap-3 text-left transition-all hover:scale-[1.01]"
                    >
                      {isConflict && (
                        <span className="shrink-0 text-sm" title="Scheduling conflict">⚠</span>
                      )}
                      {!isConflict && (
                        <span className="shrink-0 text-base">{cat?.icon ?? "📅"}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium" style={{ color: isConflict ? "#8a6800" : accent.text }}>
                          {block.title}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          {fmt(block.start_at)}–{fmt(block.end_at)}
                          {isGhost ? " · proposed" : ""}
                          {isConflict ? " · conflict" : ""}
                        </p>
                      </div>
                    </button>
                    {block.category_id && isDeadlineLike(block.title) && (
                      <DeadlineChip block={block} alreadyTasked={alreadyTasked} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {days.every((d) => blocksFor(d).length === 0 && dueTasks(d).length === 0) && (
        <p className="text-center text-sm py-12" style={{ color: "var(--muted)" }}>
          Nothing scheduled yet — add a block to get started.
        </p>
      )}
    </div>
  );
}
