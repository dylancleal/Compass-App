"use client";

import type { CalendarBlock, Category, Task } from "@/lib/types";
import { accentOf } from "@/lib/palette";
import { addDays, prettyDate, todayKey } from "@/lib/date";

const DAYS_AHEAD = 14;

interface Props {
  blocks: CalendarBlock[];
  tasks: Task[];
  categories: Category[];
  rangeStart: string;
  onClickBlock: (block: CalendarBlock) => void;
}

export default function AgendaView({ blocks, tasks, categories, rangeStart, onClickBlock }: Props) {
  const today = todayKey();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(rangeStart, i));

  function blocksFor(dayKey: string) {
    return blocks
      .filter((b) => todayKey(new Date(b.start_at)) === dayKey)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  function dueTasks(dayKey: string) {
    return tasks.filter((t) => t.due_date === dayKey && t.status !== "complete");
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
                return (
                  <button
                    key={block.id}
                    onClick={() => onClickBlock(block)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:scale-[1.01]"
                    style={{
                      background: isGhost ? "transparent" : accent.soft,
                      border: isGhost
                        ? `1.5px dashed ${accent.accent}`
                        : `1px solid ${accent.accent}22`,
                    }}
                  >
                    <span className="shrink-0 text-base">{cat?.icon ?? "📅"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" style={{ color: accent.text }}>
                        {block.title}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {fmt(block.start_at)}–{fmt(block.end_at)}
                        {isGhost ? " · proposed" : ""}
                      </p>
                    </div>
                  </button>
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
