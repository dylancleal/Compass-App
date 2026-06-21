"use client";

import { useMemo, useState } from "react";
import { useCreateTask, useRemoveTask, useTasks, useUpdateTask } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { prettyDate, todayKey } from "@/lib/date";
import TickCircle from "./TickCircle";
import { Pill } from "./ui";

function dueTone(task: Task): { label: string; color: string } | null {
  if (!task.due_date) return null;
  // Affirming framing (SPEC §3.1): never shame. "Let's find time" not "overdue".
  const today = todayKey();
  if (task.due_date < today) return { label: "let's find time for this", color: "#b45309" };
  if (task.due_date === today) return { label: "due today", color: "#0f766e" };
  return { label: prettyDate(task.due_date), color: "#64748b" };
}

export default function TaskList({
  categoryId,
  accent,
  showAdd = true,
  hideCompleted = false,
  emptyText = "Nothing here yet — add something small to start.",
}: {
  categoryId?: string;
  accent: string;
  showAdd?: boolean;
  hideCompleted?: boolean;
  emptyText?: string;
}) {
  const { data: allTasks = [] } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [showMore, setShowMore] = useState(false);

  const tasks = useMemo(() => {
    let list = categoryId ? allTasks.filter((t) => t.category_id === categoryId) : allTasks;
    if (hideCompleted) list = list.filter((t) => t.status !== "complete");
    // Open first (by due date), completed last.
    return [...list].sort((a, b) => {
      const ac = a.status === "complete" ? 1 : 0;
      const bc = b.status === "complete" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1;
    });
  }, [allTasks, categoryId, hideCompleted]);

  function add() {
    if (!title.trim() || !categoryId) return;
    createTask.mutate({
      category_id: categoryId,
      title: title.trim(),
      due_date: due || undefined,
      first_step: firstStep.trim() || undefined,
      source: "manual",
    });
    setTitle("");
    setDue("");
    setFirstStep("");
    setShowMore(false);
  }

  function toggle(task: Task, done: boolean) {
    updateTask.mutate({
      id: task.id,
      patch: {
        status: done ? "complete" : "not_started",
        completed_at: done ? new Date().toISOString() : undefined,
      },
    });
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <p className="px-1 py-3 text-sm text-[var(--muted)]">{emptyText}</p>
      )}

      {tasks.map((task) => {
        const done = task.status === "complete";
        const tone = dueTone(task);
        return (
          <div
            key={task.id}
            className="card animate-pop group flex items-start gap-3 p-3"
            style={{ opacity: done ? 0.6 : 1 }}
          >
            <div className="pt-0.5">
              <TickCircle checked={done} onChange={(n) => toggle(task, n)} accent={accent} label={task.title} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium"
                style={{ textDecoration: done ? "line-through" : "none" }}
              >
                {task.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {tone && <Pill color={tone.color}>{tone.label}</Pill>}
                {!done && task.first_step && (
                  <span className="text-xs text-[var(--muted)]">first step: {task.first_step}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => removeTask.mutate(task.id)}
              className="text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete task"
            >
              ✕
            </button>
          </div>
        );
      })}

      {showAdd && categoryId && (
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add a task…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <button
              onClick={() => setShowMore((s) => !s)}
              className="text-xs text-[var(--muted)]"
              type="button"
            >
              {showMore ? "less" : "more"}
            </button>
            <button
              onClick={add}
              disabled={!title.trim()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: accent }}
            >
              Add
            </button>
          </div>
          {showMore && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-[var(--muted)]">
                Due date
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Tiny first step
                <input
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  placeholder="e.g. open the assignment brief"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
