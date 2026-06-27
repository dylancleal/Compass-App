"use client";

import type { CalendarBlock } from "@/lib/types";
import { accentOf } from "@/lib/palette";

interface Props {
  block: CalendarBlock;
  categoryColor?: string;
  topPct: number;
  heightPct: number;
  isGhost?: boolean;
  isConflict?: boolean;
  onConfirm?: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function BlockChip({
  block,
  categoryColor,
  topPct,
  heightPct,
  isGhost,
  isConflict,
  onConfirm,
  onDismiss,
  onClick,
}: Props) {
  const accent = accentOf(categoryColor ?? "slate");
  const isExternal = block.source !== "manual" && block.source !== "compass";

  // How many px does this block occupy (approximate, based on typical 64px/hr grid)?
  // We use heightPct of total 14-hr window to estimate rendered px.
  const approxPx = (heightPct / 100) * (14 * 64);
  const tiny = approxPx < 36;   // < ~20 min — just show title on one line
  const compact = approxPx < 64; // < 1 hr — show title + time on same row

  return (
    <div
      className="absolute left-0.5 right-0.5 overflow-hidden rounded-lg select-none"
      style={{
        top: `${topPct}%`,
        height: `${Math.max(heightPct, 1.2)}%`,
        background: isConflict ? "#fef9ec" : isGhost ? "transparent" : accent.soft,
        color: isConflict ? "#8a6800" : accent.text,
        border: isConflict
          ? "1.5px solid #e8c84088"
          : isGhost
          ? `1.5px dashed ${accent.accent}`
          : `1px solid ${accent.accent}44`,
        opacity: isExternal && !isConflict ? 0.82 : 1,
        cursor: isGhost ? "default" : "pointer",
        zIndex: 2,
        padding: tiny ? "1px 6px" : "4px 8px",
      }}
      onClick={!isGhost ? onClick : undefined}
    >
      {tiny ? (
        /* Very short block — single cramped line */
        <p className="truncate text-[11px] font-semibold leading-tight" style={{ color: isConflict ? "#8a6800" : accent.text }}>
          {isConflict && <span className="mr-0.5">⚠</span>}
          {block.title}
        </p>
      ) : compact ? (
        /* Compact — title + time side by side */
        <div className="flex items-baseline gap-1 overflow-hidden">
          <p className="truncate text-xs font-semibold leading-tight" style={{ color: isConflict ? "#8a6800" : accent.text }}>
            {isConflict && <span className="mr-0.5">⚠</span>}
            {block.title}
          </p>
          <p className="shrink-0 text-[10px] opacity-60 leading-tight">{fmtTime(block.start_at)}</p>
        </div>
      ) : (
        /* Full — title on its own line, then time + badge row */
        <>
          <p className="truncate text-sm font-semibold leading-snug" style={{ color: isConflict ? "#8a6800" : accent.text }}>
            {isConflict && <span className="mr-1">⚠</span>}
            {block.title}
          </p>
          <p className="mt-0.5 text-[11px] opacity-60 leading-tight">
            {fmtTime(block.start_at)} – {fmtTime(block.end_at)}
          </p>

          {isGhost && (
            <div className="mt-1.5 flex gap-1">
              <button
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white hover:scale-105 hover:brightness-110"
                style={{ background: accent.accent }}
                onClick={(e) => { e.stopPropagation(); onConfirm?.(); }}
              >
                Add
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-[10px] font-medium opacity-60 hover:opacity-100 hover:scale-105"
                style={{ color: accent.text }}
                onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
              >
                Skip
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
