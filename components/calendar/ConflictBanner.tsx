"use client";

import type { CalendarBlock } from "@/lib/types";

interface Props {
  pairs: [CalendarBlock, CalendarBlock][];
  onRemove: (id: string) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BlockRow({ block, onRemove }: { block: CalendarBlock; onRemove: (id: string) => void }) {
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
  if (pairs.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "#fef9ec", border: "1.5px solid #e8c84088" }}
    >
      <p className="text-sm font-semibold" style={{ color: "#8a6800" }}>
        ⚠ {pairs.length} scheduling conflict{pairs.length !== 1 ? "s" : ""} — remove one to resolve
      </p>
      <div className="space-y-2">
        {pairs.map(([a, b], i) => (
          <div
            key={`${a.id}-${b.id}-${i}`}
            className="rounded-xl px-3 py-2.5 space-y-2"
            style={{ background: "rgba(255,255,255,0.65)", border: "1px solid #e8c84044" }}
          >
            <BlockRow block={a} onRemove={onRemove} />
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 border-t" style={{ borderColor: "#e8c84055" }} />
              <span className="text-[10px] font-medium" style={{ color: "#8a6800", opacity: 0.7 }}>
                overlaps
              </span>
              <div className="flex-1 border-t" style={{ borderColor: "#e8c84055" }} />
            </div>
            <BlockRow block={b} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </div>
  );
}
