"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCategories,
  useCalendarBlocks,
  useCalendarConnections,
  useCheckin,
  useCheckins,
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
import { addDays, daypart, greeting, prettyDate, startOfWeek, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { useTilt } from "@/lib/useTilt";
import { buildPlan } from "@/lib/planner";
import { findMissedDays } from "@/lib/missedDays";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { APP_VARIANT } from "@/lib/appVariant";
import { useAccessLevel, useStartCheckout } from "@/lib/subscription";
import type { Category } from "@/lib/types";
import Plan from "@/components/Plan";
import TaskList from "@/components/TaskList";
import LogSheet from "@/components/LogSheet";
import DayArc from "@/components/DayArc";
import QuickAddTask from "@/components/QuickAddTask";
import { ParallaxLeaf } from "@/components/decor";
import { IconChip, QuietLink } from "@/components/ui";
import { GoalsOverview } from "@/components/GoalCard";
import DeadlineChip from "@/components/calendar/DeadlineChip";
import { isDeadlineLike } from "@/lib/categoryMatcher";

const CAP_LABEL: Record<string, string> = { light: "Light day", medium: "Medium day", big: "Big day" };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function TodayPage() {
  const today = todayKey();
  const router = useRouter();
  const { data: settings } = useSettings();
  const accessLevel = useAccessLevel();
  const startCheckout = useStartCheckout();
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
  const { data: connections = [] } = useCalendarConnections();
  const { data: checkins = [] } = useCheckins();
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

  // Fresh-start ritual: at the week's turn (Sun, or Mon morning) invite a look
  // back — but only if last week actually had activity worth reflecting on.
  const nowDow = new Date().getDay();
  const showFreshWeek = nowDow === 0 || (nowDow === 1 && new Date().getHours() < 12);
  const lastWeekStart = addDays(startOfWeek(today), -7);
  const lastWeekEnd = addDays(lastWeekStart, 6);
  const lastWeekCount = sessions.filter(
    (s) => s.date >= lastWeekStart && s.date <= lastWeekEnd,
  ).length;
  const freshWeek = showFreshWeek && lastWeekCount > 0;

  // Gentle catch-up nudge: days in the last week with no session, no completed
  // task, and no deliberate close-out (evening wrap or an earlier catch-up
  // dismissal). Recomputed live so it clears itself once you've caught up.
  const missedDays = useMemo(
    () =>
      settings
        ? findMissedDays(sessions, tasks, checkins, settings.onboarding_completed_at, today)
        : [],
    [settings, sessions, tasks, checkins, today],
  );

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
  // so existing users without the flag set don't get bounced. Also treat anyone
  // who already logged a session OR connected a calendar as established — this
  // stops a returning-from-Google-OAuth user (whose flag write may have raced,
  // or whose PWA cold-restarted to "/") from being thrown back into onboarding.
  useEffect(() => {
    if (!settings || sessionsLoading) return;
    if (settings.onboarding_completed_at) return;
    if (sessions.length > 0) return; // existing user — has activity, skip
    if (connections.length > 0) return; // has a calendar connection — not new
    router.replace("/onboarding");
  }, [settings, sessions, sessionsLoading, connections.length, router]);

  const activeCats = categories.filter((c) => c.active);
  const pausedCats = categories.filter((c) => c.metadata?.paused_reason === "downgrade");

  // Today's page can have several true-at-once nudges (catch-up, fresh-week
  // recap, a free-tier downgrade). Stacking every applicable one as a full
  // card reads as noisy, but nothing here is allowed to go fully silent —
  // the downgrade notice especially, since a paused area disappearing without
  // explanation would feel like a bait-and-switch. Compromise: the single
  // highest-priority nudge stays a full card, the rest compress into a row
  // of small chips — still visible and one tap away, just not shouting.
  const nudges = [
    pausedCats.length > 0 && {
      key: "paused",
      href: "/categories",
      bg: "var(--info-soft)",
      textColor: "var(--info-text)",
      title: `Trial ended — ${pausedCats.map((c) => c.name).join(", ")} paused`,
      description: `${activeCats.map((c) => c.name).join(", ") || "Your other area"} is still fully yours. Switch areas or upgrade anytime.`,
      chipLabel: "Areas paused",
    },
    missedDays.length > 0 && {
      key: "catchup",
      href: "/catchup",
      bg: "var(--info-soft)",
      textColor: "var(--info-text)",
      title: missedDays.length === 1 ? "1 day to catch up" : `${missedDays.length} days to catch up`,
      description: `Log what you remember from ${prettyDate(missedDays[0].date)}${missedDays.length > 1 ? " onward" : ""} — takes a minute.`,
      chipLabel: missedDays.length === 1 ? "1 day to log" : `${missedDays.length} days to log`,
    },
    freshWeek && {
      key: "freshweek",
      href: "/review",
      bg: "var(--accent-soft)",
      textColor: "var(--accent)",
      title: "Fresh week",
      description: `See how last week landed — ${lastWeekCount} session${lastWeekCount === 1 ? "" : "s"} logged.`,
      chipLabel: "Last week's recap",
    },
  ].filter((n): n is Exclude<typeof n, false> => n !== false);
  const [primaryNudge, ...compactNudges] = nudges;

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
      <header className="relative flex items-start justify-between gap-3">
        <ParallaxLeaf />
        <div className="space-y-0.5">
          <p className="text-sm text-[var(--muted)]">{prettyDate(today)}</p>
          <h1 className="text-2xl font-bold">{greeting(settings?.greetingName ?? "")}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-10">
          {conflictGroups.length > 0 && (
            // Bounded signal, not a floating alarm: a small LED dot + label,
            // same visual weight as any other status readout — present, not
            // shouting. (Was a warn-orange pill rendered before the greeting
            // even resolves; critique flagged this as the page opening on an
            // alarm instead of a greeting.)
            <Link
              href="/calendar"
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all duration-150 hover:opacity-80 active:scale-95"
              style={{ color: "var(--warn-text)" }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--warn-text)", boxShadow: "var(--led-glow, none)" }}
                aria-hidden
              />
              <span className="font-mono tabular-nums">
                {conflictGroups.length} conflict{conflictGroups.length !== 1 ? "s" : ""}
              </span>
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
          data-tour="checkin-card"
          className="card card-interactive animate-pop block p-6 hover:brightness-[1.03]"
          style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
        >
          <p className="text-xl font-semibold" style={{ color: "var(--primary)" }}>
            {daypart() === "morning"
              ? "Good morning — start with a check-in"
              : "Ready for a quick check-in?"}
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
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--primary)" }}>
              Day sealed
            </p>
            <p className="text-xs text-[var(--muted)]">You closed the loop today. Rest well.</p>
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
          <div className="flex-1">
            <p className="text-base font-semibold" style={{ color: "var(--primary)" }}>
              How did today land?
            </p>
            <p className="text-xs text-[var(--muted)]">
              One tap to close the day{allDone ? " — you finished your plan" : ""}.
            </p>
          </div>
          <span className="text-sm text-[var(--muted)]">→</span>
        </Link>
      ) : (
        // Checked in, mid-day → compact summary; the plan below is the focus.
        <div className="card flex items-center gap-4 p-4">
          <div className="flex-1">
            <p className="text-sm font-semibold">{CAP_LABEL[checkin.capacity]}</p>
            <p className="text-sm text-[var(--muted)]">
              Mind {checkin.mental}/5 · Uni readiness {checkin.uni_readiness}/5
            </p>
          </div>
          <QuietLink href="/checkin">redo</QuietLink>
        </div>
      )}

      {/* Coach entry point — always visible (not conditional like the nudges
          below), so it reads as a standing feature rather than an alert.
          Deliberately quieter than the hero above it (plain surface, no
          primary-soft fill) — the morphing hero above is the one thing with
          "start here" weight; critique flagged the two competing at equal
          visual register before this. */}
      {APP_VARIANT.id === "study" && accessLevel !== "free" && (
        <Link
          href="/trends"
          className="card card-interactive flex items-center gap-3 p-3.5 hover:brightness-110"
        >
          <span className="text-lg opacity-80">✨</span>
          <div className="flex-1">
            <p className="text-sm font-medium">Your coach is ready</p>
            <p className="text-xs text-[var(--muted)]">
              Ask what to focus on today, or how your streaks are looking.
            </p>
          </div>
          <span className="text-sm text-[var(--muted)]">→</span>
        </Link>
      )}

      {/* Highest-priority nudge (downgrade notice > catch-up > fresh-week)
          stays a full card; anything else true at the same time compresses
          into chips right below rather than stacking more full cards. */}
      {primaryNudge && (
        <Link
          href={primaryNudge.href}
          className="card card-interactive flex items-center gap-3 p-4 hover:brightness-[1.03]"
          style={{ background: primaryNudge.bg, borderColor: "var(--mist)" }}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: primaryNudge.textColor }}>
              {primaryNudge.title}
            </p>
            <p className="text-xs text-[var(--muted)]">{primaryNudge.description}</p>
          </div>
          <span className="text-sm text-[var(--muted)]">→</span>
        </Link>
      )}
      {(compactNudges.length > 0 || (APP_VARIANT.id === "study" && accessLevel === "free")) && (
        <div className="flex flex-wrap gap-2">
          {compactNudges.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.03] hover:opacity-100"
              style={{ background: n.bg, color: n.textColor, border: "1px solid var(--border)" }}
            >
              {n.chipLabel}
            </Link>
          ))}
          {/* Coach teaser — free tier doesn't get the full "Your coach is
              ready" card below, but it shouldn't vanish from the product
              entirely either; a small upgrade chip keeps it discoverable
              without implying it's actually available to tap into. */}
          {APP_VARIANT.id === "study" && accessLevel === "free" && (
            <button
              onClick={() => startCheckout.mutate()}
              disabled={startCheckout.isPending}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.03] hover:opacity-100 disabled:opacity-60"
              style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--border)" }}
            >
              <span aria-hidden>✨</span>
              {startCheckout.isPending ? "…" : "Unlock AI coach"}
            </button>
          )}
        </div>
      )}

      {/* Personalised plan — a card per suggestion (tick circle, expandable
          "how to approach" steps, a suggested time computed from free gaps
          around your real synced calendar), same for every account. Lodestone
          briefly had a calendar-grid alternative here (DayTimeline) instead;
          removed per explicit product direction — the grid buried the science
          content a tap away and read as a downgrade from this card view. */}
      <div data-tour="suggestions">
        <Plan />
      </div>

      {/* Weekly goals — glanceable here, tap through to Trends for detail */}
      {activeCats.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--muted)]">This week&apos;s goals</h2>
            <QuietLink href="/trends">details</QuietLink>
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
                className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-all hover:scale-[1.05] hover:opacity-100"
                style={{
                  background: "var(--surface)",
                  color: accent.text,
                  border: "1px solid var(--border)",
                  boxShadow: "inset 0 1px 0 var(--card-highlight), var(--shadow-1)",
                }}
              >
                <IconChip emoji={c.icon} color={accent.accent} size={26} />
                {c.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Today's schedule — real calendar blocks (synced events, manual
          entries, and anything already accepted from the plan above). */}
      {todayBlocks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--muted)]">Today&apos;s schedule</h2>
            <QuietLink href="/calendar">calendar →</QuietLink>
          </div>
          {/* Split-strip: bezel-outlined instrument rows, a channel-color LED
              dot instead of a colored border bar (the "side-tab" pattern the
              redesign retires — it showed up on 4 of 6 surfaces critiqued).
              Conflicts get the same amber signal language as the header
              badge, not a separate louder red treatment. */}
          <div className="space-y-1.5">
            {todayBlocks.map((block) => {
              const isConflict = conflictIds.has(block.id);
              const alreadyTasked = tasks.some(
                (t) => t.source === "calendar" && t.title === block.title,
              );
              const cat = categories.find((c) => c.id === block.category_id);
              const dotColor = isConflict ? "var(--warn-text)" : cat ? accentOf(cat.color).accent : "var(--muted)";
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
                  style={{
                    background: "var(--surface)",
                    borderColor: isConflict ? "color-mix(in srgb, var(--warn-text) 45%, var(--border))" : "var(--border)",
                  }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: dotColor, boxShadow: `var(--led-glow, none)`, color: dotColor }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: isConflict ? "var(--warn-text)" : "var(--foreground)" }}
                    >
                      {block.title}
                    </p>
                    <p className="font-mono text-xs tabular-nums" style={{ color: "var(--muted)" }}>
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
                      className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105 hover:opacity-100"
                      style={
                        blockDoneSession(block.id)
                          ? { background: "var(--success-soft)", color: "var(--success-text)", borderColor: "transparent" }
                          : { background: "transparent", color: "var(--foreground)", borderColor: "var(--border)" }
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
          <QuietLink href="/categories">all areas</QuietLink>
        </div>
        <TaskList
          accent="#5b8a72"
          showAdd={false}
          hideCompleted
          emptyText="No open tasks — beautifully clear."
        />
        <QuickAddTask categories={activeCats} />
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
