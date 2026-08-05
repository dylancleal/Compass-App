"use client";

import Link from "next/link";
import { useSaveSettings, useSessions, useSettings } from "@/lib/queries";
import { todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { defaultWeeklyTarget, weeklyGoalProgress, weeksGoalHitStreak, type GoalStatus } from "@/lib/stats";
import { detectDomain } from "@/lib/categorySetup";
import type { Category } from "@/lib/types";
import { AnimatedBar, ProgressRing } from "@/components/ui";

// Identity verb per domain — for the "You train 4× a week" framing that only
// appears once a goal has been sustained for a couple of weeks.
function identityVerb(name: string): string {
  switch (detectDomain(name)) {
    case "gym": return "train";
    case "tennis": return "play";
    case "uni": return "study";
    case "running": return "run";
    case "swimming": return "swim";
    default: return "show up";
  }
}

const STATUS_META: Record<GoalStatus, { color: string; bg: string; label: string }> = {
  met: { color: "var(--success-text)", bg: "var(--success-soft)", label: "Goal met" },
  ontrack: { color: "var(--info-text)", bg: "var(--info-soft)", label: "On track" },
  behind: { color: "var(--warn-text)", bg: "var(--warn-soft)", label: "Behind pace" },
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

  // Goal-gradient: one session from the finish line gets an urgent, bright nudge.
  const nearComplete = status !== "met" && remaining === 1;
  // Identity framing: earned only after sustaining the goal 2+ prior weeks.
  const goalStreakWeeks = weeksGoalHitStreak(sessions, category.id, target, today);
  const identity = goalStreakWeeks >= 2;

  function setTarget(next: number) {
    const n = Math.max(1, Math.min(14, next));
    save.mutate({ weeklyTargets: { ...(settings?.weeklyTargets ?? {}), [category.id]: n } });
  }

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: meta.bg, background: "var(--surface)" }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-[var(--muted)]">
          {identity ? `You ${identityVerb(category.name)} ${target}× a week 💪` : "This week's goal"}
        </span>
        {nearComplete ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: accent + "22", color: accent }}
          >
            1 to go 🔥
          </span>
        ) : (
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing
          value={pct / 100}
          color={status === "behind" ? "var(--warn-text)" : accent}
          size={78}
          stroke={8}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-xl font-bold" style={{ color: accent }}>
              {done}
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--muted)]">of {target}</span>
          </div>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {line(status, remaining, daysLeft, done)}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              onClick={() => setTarget(target - 1)}
              className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
              aria-label="Lower goal"
            >
              −
            </button>
            <span className="w-14 text-center text-xs text-[var(--muted)]">goal {target}/wk</span>
            <button
              onClick={() => setTarget(target + 1)}
              className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
              aria-label="Raise goal"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact multi-area summary. Each row links to that area's full Trends panel.
// Used on the Today page and the Trends Overview tab.
export function GoalsOverview({
  categories,
  showHeader = true,
}: {
  categories: Category[];
  showHeader?: boolean;
}) {
  const { data: settings } = useSettings();
  const { data: sessions = [] } = useSessions();
  const today = todayKey();

  if (categories.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {showHeader && (
        <p className="mb-3 text-xs font-medium text-[var(--muted)]">This week&apos;s goals</p>
      )}
      <div className="space-y-1">
        {categories.map((cat) => {
          const target = targetFor(settings, cat);
          const { accent } = accentOf(cat.color);
          const { done, status } = weeklyGoalProgress(sessions, cat.id, target, today);
          const meta = STATUS_META[status];
          const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
          return (
            <Link
              key={cat.id}
              href={`/trends?area=${cat.id}`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--background)]"
            >
              <span className="w-24 shrink-0 truncate text-xs text-[var(--muted)]">
                {cat.icon} {cat.name}
              </span>
              <div className="flex-1">
                <AnimatedBar pct={pct} color={status === "behind" ? "var(--warn-text)" : accent} track="var(--border)" />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-medium" style={{ color: meta.color }}>
                {done}/{target}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
