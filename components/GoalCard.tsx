"use client";

import { useSaveSettings, useSessions, useSettings } from "@/lib/queries";
import { todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { defaultWeeklyTarget, weeklyGoalProgress, type GoalStatus } from "@/lib/stats";
import type { Category } from "@/lib/types";

const STATUS_META: Record<GoalStatus, { color: string; bg: string; label: string }> = {
  met: { color: "#0F6E56", bg: "#E1F5EE", label: "Goal met" },
  ontrack: { color: "#185FA5", bg: "#E6F1FB", label: "On track" },
  behind: { color: "#854F0B", bg: "#FAEEDA", label: "Behind pace" },
};

function targetFor(
  settings: { weeklyTargets?: Record<string, number>; weeklySchedule: { gym: unknown[]; tennis: unknown[]; study: unknown[] } } | undefined,
  cat: Pick<Category, "id" | "name">,
): number {
  const explicit = settings?.weeklyTargets?.[cat.id];
  if (typeof explicit === "number") return explicit;
  return defaultWeeklyTarget(cat.name, settings?.weeklySchedule);
}

function line(status: GoalStatus, remaining: number, daysLeft: number, done: number): string {
  if (status === "met") return `${done} session${done === 1 ? "" : "s"} logged this week — lovely consistency.`;
  if (status === "ontrack")
    return daysLeft === 0
      ? `${remaining} to go and it's the last day — you've got this.`
      : `Right on pace. ${remaining} more across the next ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
  return daysLeft === 0
    ? `Last day — ${remaining} session${remaining === 1 ? "" : "s"} to hit your goal.`
    : `${remaining} more to stay on track, with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`;
}

// Full goal card — sits at the top of an area's Trends panel.
export function GoalCard({ category }: { category: Category }) {
  const { data: settings } = useSettings();
  const { data: sessions = [] } = useSessions();
  const save = useSaveSettings();
  const today = todayKey();

  const target = targetFor(settings, category);
  const { accent } = accentOf(category.color);
  const { done, status, remaining, daysLeft } = weeklyGoalProgress(sessions, category.id, target, today);
  const meta = STATUS_META[status];
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;

  function setTarget(next: number) {
    const n = Math.max(1, Math.min(14, next));
    save.mutate({ weeklyTargets: { ...(settings?.weeklyTargets ?? {}), [category.id]: n } });
  }

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: meta.bg, background: "var(--surface)" }}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">This week&apos;s goal</span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold leading-none" style={{ color: accent }}>
            {done}
          </span>
          <span className="text-sm text-[var(--muted)]">of {target} sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTarget(target - 1)}
            className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
            aria-label="Lower goal"
          >
            −
          </button>
          <span className="w-10 text-center text-xs text-[var(--muted)]">goal {target}</span>
          <button
            onClick={() => setTarget(target + 1)}
            className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
            aria-label="Raise goal"
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--background)]">
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: status === "behind" ? "#BA7517" : accent,
            borderRadius: 999,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      <p className="text-xs leading-relaxed text-[var(--muted)]">{line(status, remaining, daysLeft, done)}</p>
    </div>
  );
}

// Compact multi-area summary — used on the Overview tab.
export function GoalsOverview({ categories }: { categories: Category[] }) {
  const { data: settings } = useSettings();
  const { data: sessions = [] } = useSessions();
  const today = todayKey();

  if (categories.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-xs font-medium text-[var(--muted)]">This week&apos;s goals</p>
      <div className="space-y-3">
        {categories.map((cat) => {
          const target = targetFor(settings, cat);
          const { accent } = accentOf(cat.color);
          const { done, status } = weeklyGoalProgress(sessions, cat.id, target, today);
          const meta = STATUS_META[status];
          const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
          return (
            <div key={cat.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-[var(--muted)]">
                {cat.icon} {cat.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--background)]">
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: status === "behind" ? "#BA7517" : accent,
                    borderRadius: 999,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-medium" style={{ color: meta.color }}>
                {done}/{target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
