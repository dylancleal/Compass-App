"use client";

import { useState } from "react";
import type { CalendarBlock, Category, Suggestion, Task } from "@/lib/types";
import type { Intention, PlacedIntention } from "@/lib/schedule";
import { blockBox, dayWindowFor } from "@/lib/schedule";
import { proposePlacementsForDay } from "@/lib/calendarPlan";
import { useAcceptSuggestion } from "@/lib/suggestionActions";
import { useGeneratePlan } from "@/lib/planGeneration";
import { useCreateCalendarBlock, useUpdateSuggestion } from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { isDeadlineLike } from "@/lib/categoryMatcher";
import BlockChip from "./BlockChip";
import DeadlineChip from "./DeadlineChip";

const HOUR_H = 64; // px per hour row — matches WeekGrid
const DAY_WIN = { startHour: 7, endHour: 21 };
const HOURS = Array.from(
  { length: DAY_WIN.endHour - DAY_WIN.startHour },
  (_, i) => i + DAY_WIN.startHour,
);
const TOTAL_H = HOURS.length * HOUR_H;

function fmtHour(h: number) {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

interface Props {
  dayKey: string;
  categories: Category[];
  tasks: Task[];
  suggestions: Suggestion[]; // today's, all statuses
  existingBlocks: CalendarBlock[]; // today's real calendar_blocks
  conflictIds: Set<string>;
  onToggleBlockDone: (blockId: string, categoryId: string, startAt: string, endAt: string) => void;
  isBlockDone: (blockId: string) => boolean;
}

export default function DayTimeline({
  dayKey,
  categories,
  tasks,
  suggestions,
  existingBlocks,
  conflictIds,
  onToggleBlockDone,
  isBlockDone,
}: Props) {
  useGeneratePlan(dayKey);

  const dayInterval = dayWindowFor(dayKey, DAY_WIN);
  const pending = suggestions.filter((s) => s.status === "pending" && (s.est_minutes ?? 0) > 0);
  const affirmations = suggestions.filter((s) => s.status === "pending" && (s.est_minutes ?? 0) === 0);
  // Wider-than-default buffer: each placement renders with a ~34px minimum
  // height (room for a title + Add/Skip) on this 64px/hr grid, which needs
  // ~32 real minutes of separation to never visually collide with the next
  // placement — the scheduler's normal 10-minute buffer isn't enough here.
  const { placed, unplaced } = proposePlacementsForDay(pending, tasks, existingBlocks, dayKey, DAY_WIN, 30);

  const acceptSuggestion = useAcceptSuggestion(dayKey);
  const updateSuggestion = useUpdateSuggestion(dayKey);
  const createBlock = useCreateCalendarBlock();
  const [selected, setSelected] = useState<CalendarBlock | null>(null);

  // Unlike the list variant's "Today's schedule" section — which excludes
  // source:"compass"/status:"planned" blocks because those duplicate a
  // still-visible suggestion card — the timeline has no separate card for a
  // confirmed placement, so it needs to render here or it'd vanish entirely
  // once accepted. Only all-day events don't make sense on an hour grid.
  const realBlocks = existingBlocks.filter((b) => !b.all_day);

  function confirmPlacement(p: PlacedIntention) {
    createBlock.mutate(
      {
        title: p.title,
        category_id: p.category_id,
        task_id: p.task_id,
        start_at: p.start_at,
        end_at: p.end_at,
        source: "compass",
        busy: true,
        status: "planned",
      },
      {
        onSuccess: () => {
          const s = suggestions.find((sugg) => sugg.id === p.id);
          if (s) acceptSuggestion.setAccepted(s, true, { durationMin: p.durationMin });
        },
      },
    );
  }

  function dismissPlacement(p: PlacedIntention) {
    updateSuggestion.mutate({ id: p.id, patch: { status: "dismissed" } });
  }

  return (
    <div className="space-y-3">
      {affirmations.map((a, i) => (
        <div
          key={a.id}
          className="animate-pop relative overflow-hidden rounded-2xl p-3.5"
          style={{
            background: "linear-gradient(135deg, var(--success-soft), var(--primary-soft))",
            border: "1px dashed color-mix(in srgb, var(--success-text) 40%, transparent)",
            animationDelay: `${i * 60}ms`,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
              style={{ background: "var(--surface)" }}
              aria-hidden
            >
              🌱
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--success-text)" }}>
                {a.text}
              </p>
              <p className="text-xs" style={{ color: "var(--success-text)", opacity: 0.85 }}>
                {a.reason}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div className="card overflow-hidden rounded-2xl p-3">
        <div className="flex" style={{ height: TOTAL_H }}>
          {/* Time-axis labels */}
          <div className="relative shrink-0" style={{ width: 40, height: TOTAL_H }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] leading-none"
                style={{ top: (hour - DAY_WIN.startHour) * HOUR_H - 5, color: "var(--muted)" }}
              >
                {fmtHour(hour)}
              </div>
            ))}
          </div>

          {/* One day column */}
          <div className="relative flex-1" style={{ height: TOTAL_H, borderLeft: "1px solid var(--border)" }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0"
                style={{ top: (hour - DAY_WIN.startHour) * HOUR_H, height: HOUR_H, borderTop: "1px solid var(--border)" }}
              />
            ))}

            {realBlocks.map((block) => {
              const cat = categories.find((c) => c.id === block.category_id);
              const box = blockBox(block, dayInterval);
              return (
                <BlockChip
                  key={block.id}
                  block={block}
                  categoryColor={cat?.color}
                  topPct={box.topPct}
                  heightPct={box.heightPct}
                  isConflict={conflictIds.has(block.id)}
                  onClick={() => setSelected(block)}
                />
              );
            })}

            {placed.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              const box = blockBox(
                { start_at: p.start_at, end_at: p.end_at } as CalendarBlock,
                dayInterval,
              );
              return (
                <BlockChip
                  key={p.id}
                  block={{ title: p.title, start_at: p.start_at, end_at: p.end_at, source: "manual" } as CalendarBlock}
                  categoryColor={cat?.color}
                  topPct={box.topPct}
                  heightPct={box.heightPct}
                  isGhost
                  onConfirm={() => confirmPlacement(p)}
                  onDismiss={() => dismissPlacement(p)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {unplaced.length > 0 && (
        <UnplacedList
          unplaced={unplaced}
          suggestions={suggestions}
          categories={categories}
          onAccept={(s) => acceptSuggestion.setAccepted(s, true)}
          onDismiss={(s) => updateSuggestion.mutate({ id: s.id, patch: { status: "dismissed" } })}
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div
            className="card relative z-10 w-full max-w-md space-y-3 rounded-b-none rounded-t-3xl p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {fmtTime(selected.start_at)}–{fmtTime(selected.end_at)}
              {selected.source !== "manual" && <span className="ml-1 opacity-60">· {selected.source}</span>}
            </p>
            <div className="flex items-center gap-2 pt-1">
              {/* A confirmed placement (source: "compass") already logged its
                  session the moment it was accepted — toggling "done" here
                  too would double-count. Only real (non-compass) events need
                  this action, same as the list variant's "Today's schedule". */}
              {selected.category_id && selected.source !== "compass" && (
                <button
                  onClick={() =>
                    onToggleBlockDone(selected.id, selected.category_id!, selected.start_at, selected.end_at)
                  }
                  className="rounded-xl px-3 py-2 text-sm font-semibold transition-all hover:scale-[1.03]"
                  style={
                    isBlockDone(selected.id)
                      ? { background: "#5b8a7222", color: "#3e6b54" }
                      : { background: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {isBlockDone(selected.id) ? "✓ done" : "Mark done"}
                </button>
              )}
              {selected.category_id && selected.source === "compass" && (
                <span
                  className="rounded-xl px-3 py-2 text-sm font-semibold"
                  style={{ background: "#5b8a7222", color: "#3e6b54" }}
                >
                  ✓ scheduled
                </span>
              )}
              {selected.category_id && isDeadlineLike(selected.title) && (
                <DeadlineChip
                  block={selected}
                  alreadyTasked={tasks.some((t) => t.source === "calendar" && t.title === selected.title)}
                />
              )}
              <button
                className="ml-auto rounded-xl px-3 py-2 text-sm font-medium hover:text-[var(--foreground)] hover:opacity-100"
                style={{ color: "var(--muted)" }}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnplacedList({
  unplaced,
  suggestions,
  categories,
  onAccept,
  onDismiss,
}: {
  unplaced: Intention[];
  suggestions: Suggestion[];
  categories: Category[];
  onAccept: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}) {
  return (
    <div
      className="rounded-2xl p-3 space-y-1.5"
      style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
    >
      <p className="text-xs font-semibold text-[var(--muted)]">Couldn&apos;t fit today</p>
      {unplaced.map((u) => {
        const s = suggestions.find((sugg) => sugg.id === u.id);
        if (!s) return null;
        const cat = categories.find((c) => c.id === u.category_id);
        const accent = cat ? accentOf(cat.color).accent : "#7d7c6e";
        return (
          <div
            key={u.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            style={{ background: "var(--background)" }}
          >
            <span>{cat?.icon ?? "📋"}</span>
            <span className="flex-1 truncate font-medium">{u.title}</span>
            <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
              ~{u.durationMin} min
            </span>
            <button
              onClick={() => onAccept(s)}
              className="shrink-0 text-xs font-semibold hover:opacity-80"
              style={{ color: accent }}
            >
              done anyway
            </button>
            <button
              onClick={() => onDismiss(s)}
              className="shrink-0 text-xs hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              skip
            </button>
          </div>
        );
      })}
    </div>
  );
}
