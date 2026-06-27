"use client";

import { useState } from "react";
import { useCreateTask, useCategories } from "@/lib/queries";
import { todayKey } from "@/lib/date";
import type { CalendarBlock } from "@/lib/types";

interface Props {
  block: CalendarBlock;
  alreadyTasked?: boolean;
}

export default function DeadlineChip({ block, alreadyTasked }: Props) {
  const [state, setState] = useState<"idle" | "picking" | "loading" | "done">(
    alreadyTasked ? "done" : "idle",
  );
  const [selectedCatId, setSelectedCatId] = useState(block.category_id ?? "");
  const { data: categories = [] } = useCategories();
  const create = useCreateTask();

  function handleConfirm() {
    if (!selectedCatId) return;
    setState("loading");
    create.mutate(
      {
        title: block.title,
        due_date: todayKey(new Date(block.start_at)),
        category_id: selectedCatId,
        status: "not_started",
        source: "calendar",
      },
      {
        onSuccess: () => setState("done"),
        onError: () => setState("picking"),
      },
    );
  }

  if (state === "done") {
    return (
      <span
        className="shrink-0 text-[11px] font-medium"
        style={{ color: "#5b8a72", opacity: 0.75 }}
      >
        ✓ tasked
      </span>
    );
  }

  if (state === "picking" || state === "loading") {
    const activeCategories = categories.filter((c) => c.active);
    return (
      <div
        className="flex shrink-0 flex-col gap-1.5 rounded-xl p-2"
        style={{ background: "#f0f4ff", border: "1px solid #c5cef0", minWidth: 170 }}
      >
        <p className="text-[10px] font-semibold" style={{ color: "#5b6fa8" }}>
          Add as task in:
        </p>
        <div className="flex flex-wrap gap-1">
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
              style={{
                background: selectedCatId === cat.id ? "#5b6fa8" : "#e8ecf8",
                color: selectedCatId === cat.id ? "#fff" : "#5b6fa8",
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setState("idle")}
            disabled={state === "loading"}
            className="flex-1 rounded-lg py-1 text-[11px]"
            style={{ background: "#e8ecf8", color: "#5b6fa8" }}
          >
            cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCatId || state === "loading"}
            className="flex-1 rounded-lg py-1 text-[11px] font-semibold"
            style={{
              background: selectedCatId ? "#5b6fa8" : "#c5cef0",
              color: "#fff",
              opacity: state === "loading" ? 0.6 : 1,
            }}
          >
            {state === "loading" ? "…" : "Add"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("picking")}
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
      style={{
        background: "#f0f4ff",
        color: "#5b6fa8",
        border: "1px solid #c5cef0",
        opacity: 0.85,
      }}
      title="Add as task"
    >
      📌 task?
    </button>
  );
}
