"use client";

import type { CalendarBlock } from "@/lib/types";
import { accentOf } from "@/lib/palette";

interface Props {
  block: CalendarBlock;
  categoryColor?: string;
  topPct: number;
  heightPct: number;
  isGhost?: boolean;
  onConfirm?: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
}

export default function BlockChip({
  block,
  categoryColor,
  topPct,
  heightPct,
  isGhost,
  onConfirm,
  onDismiss,
  onClick,
}: Props) {
  const accent = accentOf(categoryColor ?? "slate");
  const isExternal = block.source !== "manual" && block.source !== "compass";
  const short = heightPct < 4;

  return (
    <div
      className="absolute left-1 right-1 overflow-hidden rounded-lg px-1.5 py-1 text-xs leading-tight select-none"
      style={{
        top: `${topPct}%`,
        height: `${Math.max(heightPct, 2)}%`,
        background: isGhost ? "transparent" : accent.soft,
        color: accent.text,
        border: isGhost
          ? `1.5px dashed ${accent.accent}`
          : `1px solid ${accent.accent}33`,
        opacity: isExternal ? 0.7 : 1,
        cursor: isExternal ? "default" : "pointer",
        zIndex: 1,
      }}
      onClick={!isExternal && !isGhost ? onClick : undefined}
    >
      {!short && (
        <p className="truncate font-semibold" style={{ color: accent.text }}>
          {block.title}
        </p>
      )}
      {short && (
        <p className="truncate text-[10px] font-medium" style={{ color: accent.text }}>
          {block.title}
        </p>
      )}
      {isExternal && !short && (
        <span className="text-[10px] opacity-60">🔒 synced</span>
      )}
      {isGhost && !short && (
        <div className="mt-0.5 flex gap-1">
          <button
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: accent.accent }}
            onClick={(e) => { e.stopPropagation(); onConfirm?.(); }}
          >
            Add
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-[10px] font-medium opacity-60"
            style={{ color: accent.text }}
            onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
