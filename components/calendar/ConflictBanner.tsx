"use client";

import { useState } from "react";
import type { CalendarBlock } from "@/lib/types";
import { useUpdateCalendarBlock } from "@/lib/queries";

interface Props {
  pairs: [CalendarBlock, CalendarBlock][];
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
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA"); // yyyy-mm-dd in local tz
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

export default function ConflictBanner({ pairs, onRemove }: Props) {
  const [adjustState, setAdjustState] = useState<AdjustState | null>(null);
  const update = useUpdateCalendarBlock();

  if (pairs.length === 0) return null;

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
        ⚠ {pairs.length} scheduling conflict{pairs.length !== 1 ? "s" : ""} — adjust or remove to resolve
      </p>
      <div className="space-y-2">
        {pairs.map(([a, b], i) => (
          <div
            key={`${a.id}-${b.id}-${i}`}
            className="rounded-xl px-3 py-2.5 space-y-2"
            style={{ background: "rgba(255,255,255,0.65)", border: "1px solid #e8c84044" }}
          >
            <BlockRow
              block={a}
              onRemove={onRemove}
              onStartAdjust={handleStartAdjust}
              onAdjustField={handleAdjustField}
              adjustState={adjustState}
              onSave={handleSave}
              onCancel={() => setAdjustState(null)}
              isSaving={update.isPending}
            />
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 border-t" style={{ borderColor: "#e8c84055" }} />
              <span className="text-[10px] font-medium" style={{ color: "#8a6800", opacity: 0.7 }}>
                overlaps
              </span>
              <div className="flex-1 border-t" style={{ borderColor: "#e8c84055" }} />
            </div>
            <BlockRow
              block={b}
              onRemove={onRemove}
              onStartAdjust={handleStartAdjust}
              onAdjustField={handleAdjustField}
              adjustState={adjustState}
              onSave={handleSave}
              onCancel={() => setAdjustState(null)}
              isSaving={update.isPending}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
