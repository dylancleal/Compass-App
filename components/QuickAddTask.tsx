"use client";

import { useState } from "react";
import { useCreateTask } from "@/lib/queries";
import type { Category } from "@/lib/types";

// Add a full task from the Today page (choose which area it belongs to). Tasks
// feed the planner — recency counts as activity and due dates drive urgency.
export default function QuickAddTask({ categories }: { categories: Category[] }) {
  const create = useCreateTask();
  const [open, setOpen] = useState(false);
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  if (categories.length === 0) return null;

  function add() {
    if (!title.trim() || !catId) return;
    create.mutate({
      category_id: catId,
      title: title.trim(),
      due_date: due || undefined,
      source: "manual",
    });
    setTitle("");
    setDue("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed py-2.5 text-xs font-medium transition-all hover:opacity-100"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        + add a task
      </button>
    );
  }

  return (
    <div className="card space-y-2 p-3">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task…"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
        />
        <button
          onClick={add}
          disabled={!title.trim() || create.isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110"
          style={{ background: "var(--primary)" }}
        >
          Add
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          aria-label="Due date (optional)"
        />
        <button
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          done
        </button>
      </div>
    </div>
  );
}
