"use client";

import { useState } from "react";
import { useCreateTask } from "@/lib/queries";
import { todayKey } from "@/lib/date";
import type { CalendarBlock } from "@/lib/types";

interface Props {
  block: CalendarBlock;
}

export default function DeadlineChip({ block }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const create = useCreateTask();

  if (state === "done") return null;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (state !== "idle" || !block.category_id) return;
    setState("loading");
    create.mutate(
      {
        title: block.title,
        due_date: todayKey(new Date(block.start_at)),
        category_id: block.category_id,
        status: "not_started",
        source: "calendar",
      },
      {
        onSuccess: () => setState("done"),
        onError: () => setState("idle"),
      },
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:scale-105 hover:opacity-100 active:scale-95"
      style={{
        background: "#f0f4ff",
        color: "#5b6fa8",
        border: "1px solid #c5cef0",
        opacity: state === "loading" ? 0.6 : 0.85,
      }}
      title="Add as task"
    >
      {state === "loading" ? "…" : "📌 task?"}
    </button>
  );
}
