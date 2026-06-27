"use client";

import { useState } from "react";
import type { CalendarBlock } from "@/lib/types";
import { useUpdateCalendarBlock } from "@/lib/queries";

interface Props {
  groups: CalendarBlock[][];
  onRemove: (id: string) => void;
}

interface AdjustState {
  id: string;
  date: string;      // yyyy-mm-dd local
  startTime: string; // HH:MM local
  endTime: string;   // HH:MM local
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}

function localTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BlockRow({
  block,
  onRemove,
  onStartAdjust,
  onAdjustField,
  adjustState,
  onSave,
  onCancel,
  isSaving,
}: {
  block: CalendarBlock;
  onRemove: (id: string) => void;
  onStartAdjust: (block: CalendarBlock) => void;
  onAdjustField: (field: keyof Omit<AdjustState, "id">, value: string) => void;
  adjustState: AdjustState | null;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const isAdjusting = adjustState?.id === block.id;

  if (isAdjusting && adjustState) {
    return (
      <div className="space-y-2.5">
        <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {block.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={adjustState.date}
            onChange={(e) => onAdjustField("date", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] transition-colors"
          />
          <input
            type="time"
            value={adjustState.startTime}
            onChange={(e) => onAdjustField("startTime", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] transition-colors"
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>–</span>
          <input
            type="time"
            value={adjustState.endTime}
            onChange={(e) => onAdjustField("endTime", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg px-3 py-1 text-xs font-semibold text-[#fffdf9] transition-all duration-150 hover:scale-[1.03] hover:brightness-110 active:scale-95 disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1 text-xs font-medium transition-all duration-150 hover:opacity-70"
            style={{ color: "var(--muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {block.title}
        </p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {fmt(block.start_at)}–{fmt(block.end_at)}
        </p>
      </div>
      <button
        onClick={() => onStartAdjust(block)}
        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:scale-105 active:scale-95"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        Adjust
      </button>
      <button
        onClick={() => onRemove(block.id)}
        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:scale-105 active:scale-95"
        style={{ background: "#f8ece8", color: "#c06b5a" }}
      >
        Remove
      </button>
    </div>
  );
}

export default function ConflictBanner({ groups, onRemove }: Props) {
  const [adjustState, setAdjustState] = useState<AdjustState | null>(null);
  const update = useUpdateCalendarBlock();

  if (groups.length === 0) return null;

  const totalBlocks = groups.reduce((n, g) => n + g.length, 0);

  function handleStartAdjust(block: CalendarBlock) {
    setAdjustState({
      id: block.id,
      date: localDate(block.start_at),
      startTime: localTime(block.start_at),
      endTime: localTime(block.end_at),
    });
  }

  function handleAdjustField(field: keyof Omit<AdjustState, "id">, value: string) {
    setAdjustState((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  function handleSave() {
    if (!adjustState) return;
    const start = new Date(`${adjustState.date}T${adjustState.startTime}`);
    const end = new Date(`${adjustState.date}T${adjustState.endTime}`);
    update.mutate(
      { id: adjustState.id, patch: { start_at: start.toISOString(), end_at: end.toISOString() } },
      { onSuccess: () => setAdjustState(null) },
    );
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "#fef9ec", border: "1.5px solid #e8c84088" }}
    >
      <p className="text-sm font-semibold" style={{ color: "#8a6800" }}>
        ⚠ {totalBlocks} events have time conflicts — adjust or remove to resolve
      </p>
      <div className="space-y-2">
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="rounded-xl px-3 py-2.5 space-y-2"
            style={{ background: "rgba(255,255,255,0.65)", border: "1px solid #e8c84044" }}
          >
            {group.map((block, bi) => (
              <div key={block.id}>
                <BlockRow
                  block={block}
                  onRemove={onRemove}
                  onStartAdjust={handleStartAdjust}
                  onAdjustField={handleAdjustField}
                  adjustState={adjustState}
                  onSave={handleSave}
                  onCancel={() => setAdjustState(null)}
                  isSaving={update.isPending}
                />
                {bi < group.length - 1 && (
                  <div
                    className="mt-2 border-t"
                    style={{ borderColor: "#e8c84033" }}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
