"use client";

import { useState } from "react";
import { Sheet, Button } from "@/components/ui";
import type { Category, Task, CalendarBlock } from "@/lib/types";
import { accentOf } from "@/lib/palette";
import { conflicts } from "@/lib/schedule";
import { todayKey } from "@/lib/date";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  tasks: Task[];
  existingBlocks: CalendarBlock[];
  prefillTask?: Task;
  prefillDate?: string;
  onSave: (block: Omit<CalendarBlock, "id" | "created_at">) => void;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roundToNearest15(date: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export default function QuickAddSheet({
  open,
  onClose,
  categories,
  tasks,
  existingBlocks,
  prefillTask,
  prefillDate,
  onSave,
}: Props) {
  const now = roundToNearest15(new Date());
  const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(prefillTask?.title ?? "");
  const [categoryId, setCategoryId] = useState(prefillTask?.category_id ?? "");
  const [taskId, setTaskId] = useState(prefillTask?.id ?? "");
  const [startVal, setStartVal] = useState(
    prefillDate
      ? `${prefillDate}T${toLocalDatetimeValue(now.toISOString()).slice(11)}`
      : toLocalDatetimeValue(now.toISOString()),
  );
  const [durationMin, setDurationMin] = useState(prefillTask?.estimate_minutes ?? 60);

  const startMs = new Date(startVal).getTime();
  const endMs = startMs + durationMin * 60 * 1000;
  const endVal = toLocalDatetimeValue(new Date(endMs).toISOString());

  const candidate = {
    start_at: new Date(startVal).toISOString(),
    end_at: new Date(endMs).toISOString(),
  };
  const clashing = conflicts(candidate, existingBlocks);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category_id: categoryId || undefined,
      task_id: taskId || undefined,
      start_at: candidate.start_at,
      end_at: candidate.end_at,
      source: "manual",
      busy: true,
      status: "planned",
    });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add time block">
      <div className="space-y-3">
        {/* Title */}
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          placeholder="What are you doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {/* Category */}
        <div className="flex flex-wrap gap-1.5">
          {categories.filter((c) => c.active).map((cat) => {
            const accent = accentOf(cat.color);
            const active = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryId(active ? "" : cat.id);
                  setTaskId("");
                }}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:scale-[1.05] hover:opacity-100"
                style={{
                  background: active ? accent.soft : "var(--surface)",
                  color: active ? accent.text : "var(--muted)",
                  border: `1px solid ${active ? accent.accent + "66" : "var(--border)"}`,
                }}
              >
                {cat.icon} {cat.name}
              </button>
            );
          })}
        </div>

        {/* Task picker (only if category selected and has open tasks) */}
        {categoryId && (() => {
          const catTasks = tasks.filter(
            (t) => t.category_id === categoryId && t.status !== "complete",
          );
          if (catTasks.length === 0) return null;
          return (
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">No specific task</option>
              {catTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          );
        })()}

        {/* Start time */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Start</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Duration</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120, 150, 180].map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m}m` : `${m / 60}h`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* End time preview */}
        <p className="text-xs text-[var(--muted)]">
          Ends {new Date(endMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>

        {/* Conflict nudge */}
        {clashing.length > 0 && (
          <div
            className="rounded-xl px-3 py-2.5 text-xs"
            style={{ background: "#f8ece8", color: "#c06b5a" }}
          >
            ⚠️ Overlaps {clashing.map((b) => `"${b.title}"`).join(", ")} — adjust the time?
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={!title.trim()}>
            Add block
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}
