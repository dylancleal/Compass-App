"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCategories,
  useCalendarBlocks,
  useCheckin,
  useCreateSession,
  useMetrics,
  useRemoveSession,
  useSettings,
  useSessions,
  useSessionTemplates,
  useSuggestions,
  useTasks,
} from "@/lib/queries";
import { findConflictPairs, findConflictGroups } from "@/lib/schedule";
import { addDays, daypart, greeting, prettyDate, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { useTilt } from "@/lib/useTilt";
import { buildPlan } from "@/lib/planner";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import type { Category } from "@/lib/types";
import Plan from "@/components/Plan";
import TaskList from "@/components/TaskList";
import LogSheet from "@/components/LogSheet";
import DayArc from "@/components/DayArc";
import { GoalsOverview } from "@/components/GoalCard";
import DeadlineChip from "@/components/calendar/DeadlineChip";
import { isDeadlineLike } from "@/lib/categoryMatcher";

const MENTAL_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];
const CAP_LABEL: Record<string, string> = { light: "Light day", medium: "Medium day", big: "Big day" };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function TodayPage() {
  const today = todayKey();
  const router = useRouter();
  const { data: settings } = useSettings();
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const { data: checkin } = useCheckin(today);
  const { data: categories = [] } = useCategories();
  const { data: metrics = [] } = useMetrics();
  const { data: allBlocks = [] } = useCalendarBlocks(
    `${today}T00:00:00.000Z`,
    `${today}T23:59:59.999Z`,
  );
  const { data: tasks = [] } = useTasks();
  const { data: suggestions = [] } = useSuggestions(today);
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const createSession = useCreateSession();
  const removeSession = useRemoveSession();
  const [logCat, setLogCat] = useState<Category | null>(null);
  const checkinTiltRef = useTilt<HTMLAnchorElement>(!checkin);

  // Day-state, used to morph what leads the page by time + progress.
  const wrapped = !!checkin?.extra?.evening_rating;
  const isLateDay = new Date().getHours() >= 16;
  const actionable = suggestions.filter(
    (s) => s.est_minutes !== 0 && s.status !== "dismissed" && s.status !== "snoozed",
  );
  const allDone = actionable.length > 0 && actionable.every((s) => s.status === "accepted");

  // One-line sketch of tomorrow — planted tonight to seed intention.
  const tomorrow = addDays(today, 1);
  const tomorrowChips = useMemo(() => {
    if (!settings || !wrapped) return [];
    const plan = buildPlan({
      date: tomorrow,
      assume: { capacity: "medium", mental: 3, uni_readiness: 3 },
      categories,
      tasks,
      sessions,
      settings,
      calendarBlocks: [],
      library,
    });
    const seen = new Set<string>();
    const chips: { icon: string; label: string }[] = [];
    for (const s of plan) {
      if ((s.est_minutes ?? 0) <= 0 || !s.category_id || seen.has(s.category_id)) continue;
      seen.add(s.category_id);
      const cat = categories.find((c) => c.id === s.category_id);
      if (!cat) continue;
      chips.push({ icon: cat.icon, label: s.text.split("\n")[0].split(" — ")[0].split(" ·")[0] });
      if (chips.length >= 3) break;
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapped, settings, categories.length, sessions.length, tasks.length, library.length]);

  function blockDoneSession(blockId: string) {
    return sessions.find(
      (s) =>
        (s.payload as { block_id?: string; auto_logged?: boolean })?.block_id === blockId &&
        (s.payload as { auto_logged?: boolean })?.auto_logged === true,
    );
  }

  function toggleBlockDone(blockId: string, categoryId: string, startAt: string, endAt: string) {
    const existing = blockDoneSession(blockId);
    if (existing) {
      removeSession.mutate(existing.id);
    } else {
      const durationMin = Math.round(
        (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
      );
      createSession.mutate({
        category_id: categoryId,
        date: today,
        type: "Session",
        duration_minutes: durationMin > 0 ? durationMin : undefined,
        payload: { auto_logged: true, block_id: blockId },
      });
    }
  }

  // Redirect brand-new users to onboarding. Wait for sessions to load first
  // so existing users without the flag set don't get bounced.
  useEffect(() => {
    if (!settings || sessionsLoading) return;
    if (settings.onboarding_completed_at) return;
    if (sessions.length > 0) return; // existing user — has activity, skip
    router.replace("/onboarding");
  }, [settings, sessions, sessionsLoading, router]);

  const activeCats = categories.filter((c) => c.active);

  // Only timed, non-ghost blocks for today's schedule display
  const todayBlocks = useMemo(
    () =>
      allBlocks
        .filter((b) => !b.all_day && !(b.source === "compass" && b.status === "planned"))
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [allBlocks],
  );

  const conflictPairs = useMemo(() => findConflictPairs(allBlocks), [allBlocks]);
  const conflictGroups = useMemo(() => findConflictGroups(conflictPairs), [conflictPairs]);
  const conflictIds = useMemo(
    () => new Set(conflictPairs.flatMap(([a, b]) => [a.id, b.id])),
    [conflictPairs],
  );

  return (
    <div className="space-y-7">
      {/* Header — day-arc + greeting, conflict badge top-right */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm text-[var(--muted)]">{prettyDate(today)}</p>
          <h1 className="text-2xl font-bold">{greeting(settings?.greetingName ?? "")}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {conflictGroups.length > 0 && (
            <Link
              href="/calendar"
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 hover:scale-105 hover:brightness-95 active:scale-95"
              style={{
                background: "var(--warn-soft)",
                color: "var(--warn-text)",
                border: "1px solid color-mix(in srgb, var(--warn-text) 45%, transparent)",
              }}
            >
              ⚠ {conflictGroups.length} conflict{conflictGroups.length !== 1 ? "s" : ""}
            </Link>
          )}
          <DayArc />
        </div>
      </header>

      {/* Hero — morphs with the time of day and how far through the day you are */}
      {!checkin ? (
        // No check-in yet → the check-in is the one thing to do.
        <Link
          ref={checkinTiltRef}
          href="/checkin"
          className="card card-interactive animate-pop block p-6 hover:brightness-[1.03]"
          style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
        >
          <p className="text-xl font-semibold" style={{ color: "var(--primary)" }}>
            {daypart() === "morning"
              ? "Good morning — start with a check-in 🌿"
              : "Ready for a quick check-in? 🌿"}
          </p>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Tell me how today feels and I&apos;ll shape a gentle plan with you. ~30 seconds.
          </p>
          <span className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--primary)" }}>
            Start check-in →
          </span>
        </Link>
      ) : wrapped ? (
        // Day closed → quiet "sealed" state + a one-line sketch of tomorrow.
        <div
          className="card animate-pop p-5"
          style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--primary)" }}>
                Day sealed
              </p>
              <p className="text-xs text-[var(--muted)]">You closed the loop today. Rest well.</p>
            </div>
          </div>
          {tomorrowChips.length > 0 && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium text-[var(--muted)]">Tomorrow looks like</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tomorrowChips.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isLateDay ? (
        // Late in the day, not yet wrapped → nudge to close the loop (peak-end).
        <Link
          href="/wrap"
          className="card card-interactive animate-pop flex items-center gap-3 p-5 hover:brightness-[1.03]"
          style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
        >
          <span className="text-2xl">🌙</span>
          <div className="flex-1">
            <p className="text-base font-semibold" style={{ color: "var(--primary)" }}>
              How did today land?
            </p>
            <p className="text-xs text-[var(--muted)]">
              One tap to close the day{allDone ? " — you finished your plan 🎉" : ""}.
            </p>
          </div>
          <span className="text-sm text-[var(--muted)]">→</span>
        </Link>
      ) : (
        // Checked in, mid-day → compact summary; the plan below is the focus.
        <div className="card flex items-center gap-4 p-4">
          <span className="text-3xl">{MENTAL_EMOJI[checkin.mental]}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{CAP_LABEL[checkin.capacity]}</p>
            <p className="text-sm text-[var(--muted)]">
              Mind {checkin.mental}/5 · Uni readiness {checkin.uni_readiness}/5
            </p>
          </div>
          <Link href="/checkin" className="text-xs text-[var(--muted)] underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105">
            redo
          </Link>
        </div>
      )}

      {/* Personalised plan */}
      <div data-tour="suggestions">
        <Plan />
      </div>

      {/* Weekly goals — glanceable here, tap through to Trends for detail */}
      {activeCats.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--muted)]">This week&apos;s goals</h2>
            <Link href="/trends" className="text-xs text-[var(--muted)] underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105">
              details
            </Link>
          </div>
          <GoalsOverview categories={activeCats} showHeader={false} />
        </section>
      )}

      {/* Quick log */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Quick log</h2>
        <div className="flex flex-wrap gap-2">
          {activeCats.map((c) => {
            const accent = accentOf(c.color);
            return (
              <button
                key={c.id}
                onClick={() => setLogCat(c)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium hover:scale-[1.05] hover:opacity-100 hover:shadow-sm"
                style={{ background: accent.soft, color: accent.text }}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Today's schedule — calendar blocks */}
      {todayBlocks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--muted)]">Today&apos;s schedule</h2>
            <Link
              href="/calendar"
              className="text-xs text-[var(--muted)] underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105"
            >
              calendar →
            </Link>
          </div>
          <div className="space-y-1.5">
            {todayBlocks.map((block) => {
              const isConflict = conflictIds.has(block.id);
              const alreadyTasked = tasks.some(
                (t) => t.source === "calendar" && t.title === block.title,
              );
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
                  style={{
                    background: isConflict ? "var(--warn-soft)" : "var(--surface)",
                    border: isConflict
                      ? "1px solid color-mix(in srgb, var(--warn-text) 40%, transparent)"
                      : "1px solid var(--border)",
                    borderLeft: isConflict ? "3px solid var(--warn-text)" : "3px solid #7a9bb5",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: isConflict ? "var(--warn-text)" : "var(--foreground)" }}
                    >
                      {isConflict && <span className="mr-1">⚠</span>}
                      {block.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {fmtTime(block.start_at)}–{fmtTime(block.end_at)}
                      {block.source !== "manual" && (
                        <span className="ml-1 opacity-60">· {block.source}</span>
                      )}
                    </p>
                  </div>
                  {block.category_id && isDeadlineLike(block.title) && (
                    <DeadlineChip block={block} alreadyTasked={alreadyTasked} />
                  )}
                  {block.category_id && !isDeadlineLike(block.title) && (
                    <button
                      onClick={() =>
                        toggleBlockDone(block.id, block.category_id!, block.start_at, block.end_at)
                      }
                      title={blockDoneSession(block.id) ? "Mark undone" : "Mark done"}
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105 hover:opacity-100"
                      style={
                        blockDoneSession(block.id)
                          ? { background: "#5b8a7222", color: "#3e6b54" }
                          : { background: "var(--border)", color: "var(--muted)" }
                      }
                    >
                      {blockDoneSession(block.id) ? "✓ done" : "done?"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick-tick tasks */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Quick-tick</h2>
          <Link href="/categories" className="text-xs text-[var(--muted)] underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105">
            all areas
          </Link>
        </div>
        <TaskList
          accent="#5b8a72"
          showAdd={false}
          hideCompleted
          emptyText="No open tasks — beautifully clear. ✨"
        />
      </section>

      {logCat && (
        <LogSheet
          open={!!logCat}
          onClose={() => setLogCat(null)}
          category={logCat}
          metrics={metrics.filter((m) => m.category_id === logCat.id)}
          accent={accentOf(logCat.color).accent}
        />
      )}
    </div>
  );
}
