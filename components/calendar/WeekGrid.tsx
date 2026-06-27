"use client";

import type { CalendarBlock, Category } from "@/lib/types";
import { blockBox, dayWindowFor } from "@/lib/schedule";
import { addDays, todayKey } from "@/lib/date";
import BlockChip from "./BlockChip";

const HOUR_H = 64; // px per hour row
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am – 8pm
const TOTAL_H = HOURS.length * HOUR_H; // 896px — full column height
const DAY_WIN = { startHour: 7, endHour: 21 };
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtHour(h: number) {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface Props {
  weekStart: string;
  blocks: CalendarBlock[];
  categories: Category[];
  conflictIds?: Set<string>;
  onClickBlock: (block: CalendarBlock) => void;
  onClickSlot: (dayKey: string, hour: number) => void;
}

export default function WeekGrid({
  weekStart,
  blocks,
  categories,
  conflictIds,
  onClickBlock,
  onClickSlot,
}: Props) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function blocksFor(dayKey: string) {
    return blocks.filter((b) => todayKey(new Date(b.start_at)) === dayKey);
  }

  const colTemplate = "40px repeat(7, 1fr)";

  return (
    <div className="overflow-x-auto" style={{ overflowY: "hidden" }}>
      <div style={{ minWidth: 560 }}>

        {/* ── Day-of-week header ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            paddingBottom: 8,
          }}
        >
          <div /> {/* time-axis corner */}
          {days.map((day, i) => {
            const isToday = day === today;
            return (
              <div
                key={day}
                className="text-center text-xs font-medium"
                style={{ color: isToday ? "var(--primary)" : "var(--muted)" }}
              >
                <div>{DAY_LABELS[i]}</div>
                <div
                  className="mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold"
                  style={
                    isToday
                      ? { background: "var(--primary)", color: "#fffdf9" }
                      : {}
                  }
                >
                  {day.slice(8)}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Body: time axis + day columns ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            height: TOTAL_H,
          }}
        >
          {/* Time-axis labels */}
          <div className="relative" style={{ height: TOTAL_H }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] leading-none"
                style={{
                  top: (hour - 7) * HOUR_H - 5,
                  color: "var(--muted)",
                }}
              >
                {fmtHour(hour)}
              </div>
            ))}
          </div>

          {/* One column per day */}
          {days.map((day) => {
            const dayInterval = dayWindowFor(day, DAY_WIN);
            const dayBlocks = blocksFor(day);

            return (
              <div
                key={day}
                className="relative"
                style={{
                  height: TOTAL_H,
                  borderLeft: "1px solid var(--border)",
                }}
              >
                {/* Hour grid lines + click targets */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 cursor-pointer transition-colors hover:bg-[var(--primary-soft)]"
                    style={{
                      top: (hour - 7) * HOUR_H,
                      height: HOUR_H,
                      borderTop: "1px solid var(--border)",
                    }}
                    onClick={() => onClickSlot(day, hour)}
                  />
                ))}

                {/* Calendar blocks — absolute over the click targets */}
                {dayBlocks.map((block) => {
                  const cat = categories.find((c) => c.id === block.category_id);
                  const box = blockBox(block, dayInterval);
                  const isGhost =
                    block.source === "compass" && block.status === "planned";
                  const isConflict = conflictIds?.has(block.id) ?? false;
                  return (
                    <BlockChip
                      key={block.id}
                      block={block}
                      categoryColor={cat?.color}
                      topPct={box.topPct}
                      heightPct={box.heightPct}
                      isGhost={isGhost}
                      isConflict={isConflict}
                      onClick={() => onClickBlock(block)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
