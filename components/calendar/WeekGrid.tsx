"use client";

import type { CalendarBlock, Category } from "@/lib/types";
import { blockBox, dayWindowFor } from "@/lib/schedule";
import { addDays, todayKey } from "@/lib/date";
import BlockChip from "./BlockChip";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00
const DAY_WIN = { startHour: 7, endHour: 21 };

interface Props {
  weekStart: string; // Monday yyyy-mm-dd
  blocks: CalendarBlock[];
  categories: Category[];
  onClickBlock: (block: CalendarBlock) => void;
  onClickSlot: (dayKey: string, hour: number) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeekGrid({ weekStart, blocks, categories, onClickBlock, onClickSlot }: Props) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function blocksFor(dayKey: string) {
    return blocks.filter((b) => {
      const bDay = todayKey(new Date(b.start_at));
      return bDay === dayKey;
    });
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[600px]"
        style={{ gridTemplateColumns: "40px repeat(7, 1fr)" }}
      >
        {/* Header row */}
        <div /> {/* time axis corner */}
        {days.map((day, i) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              className="pb-2 text-center text-xs font-medium"
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

        {/* Time rows */}
        {HOURS.map((hour) => (
          <>
            {/* Hour label */}
            <div
              key={`h${hour}`}
              className="pr-2 pt-0 text-right text-[10px] leading-none"
              style={{ color: "var(--muted)" }}
            >
              {hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayInterval = dayWindowFor(day, DAY_WIN);
              const dayBlocks = blocksFor(day);

              return (
                <div
                  key={`${day}-${hour}`}
                  className="relative border-t border-l cursor-pointer hover:bg-[var(--primary-soft)] transition-colors"
                  style={{
                    height: 48,
                    borderColor: "var(--border)",
                  }}
                  onClick={() => onClickSlot(day, hour)}
                >
                  {hour === HOURS[0] &&
                    dayBlocks.map((block) => {
                      const cat = categories.find((c) => c.id === block.category_id);
                      const box = blockBox(block, dayInterval);
                      const isGhost = block.source === "compass" && block.status === "planned";
                      return (
                        <BlockChip
                          key={block.id}
                          block={block}
                          categoryColor={cat?.color}
                          topPct={box.topPct}
                          heightPct={box.heightPct}
                          isGhost={isGhost}
                          onClick={() => onClickBlock(block)}
                        />
                      );
                    })}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
