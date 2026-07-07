"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCalendarBlocks,
  useCategories,
  useCheckin,
  useCreateCalendarBlock,
  useCreateSession,
  useRemoveSession,
  useSaveSuggestions,
  useSessions,
  useSessionTemplates,
  useSettings,
  useSuggestions,
  useTasks,
  useUpdateSession,
  useUpdateSuggestion,
} from "@/lib/queries";
import { buildPlan } from "@/lib/planner";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { inferDurationFromBlocks } from "@/lib/sessionInfer";
import { findFreeSlot } from "@/lib/timeSlot";
import { addDays, dayIndex, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { useTilt } from "@/lib/useTilt";
import type { Suggestion, Category, Session } from "@/lib/types";
import { Button, Pill } from "./ui";
import SessionEditor from "./SessionEditor";
import TickCircle from "./TickCircle";
import CompassRose from "./CompassRose";

const RAIN_COLORS = ["#5b8a72", "#a8c3b5", "#d98e63", "#c9b46b", "#7faf97", "#3e6b54"];

// Fixed starfield for the day-complete space scene. A few are tinted green /
// apricot so the palette reads through the stars, not just the nebula. Sizes in
// px; `o` drives the twinkle's bright point; `d` is the animation delay.
const STARS: { x: number; y: number; r: number; o: number; d: number; c: string }[] = [
  { x: 8, y: 22, r: 2.2, o: 0.95, d: 0, c: "#ffffff" },
  { x: 20, y: 12, r: 1.3, o: 0.7, d: 1.4, c: "#ffffff" },
  { x: 33, y: 30, r: 1, o: 0.5, d: 0.7, c: "var(--accent)" },
  { x: 15, y: 55, r: 1.6, o: 0.8, d: 2.1, c: "#ffffff" },
  { x: 6, y: 78, r: 1.2, o: 0.6, d: 0.3, c: "#ffffff" },
  { x: 26, y: 84, r: 2, o: 0.85, d: 1.8, c: "var(--primary-mid)" },
  { x: 44, y: 16, r: 1.1, o: 0.55, d: 2.6, c: "#ffffff" },
  { x: 50, y: 88, r: 1.4, o: 0.7, d: 0.9, c: "#ffffff" },
  { x: 63, y: 12, r: 1.8, o: 0.9, d: 1.2, c: "#ffffff" },
  { x: 72, y: 28, r: 1, o: 0.5, d: 2.3, c: "var(--accent)" },
  { x: 88, y: 18, r: 1.5, o: 0.75, d: 0.5, c: "#ffffff" },
  { x: 94, y: 42, r: 1.2, o: 0.6, d: 1.9, c: "#ffffff" },
  { x: 82, y: 58, r: 2.1, o: 0.9, d: 0.2, c: "#ffffff" },
  { x: 92, y: 80, r: 1.3, o: 0.65, d: 1.5, c: "var(--primary-mid)" },
  { x: 70, y: 86, r: 1.1, o: 0.55, d: 2.8, c: "#ffffff" },
  { x: 58, y: 68, r: 0.9, o: 0.45, d: 1.0, c: "#ffffff" },
  { x: 38, y: 62, r: 1, o: 0.5, d: 2.0, c: "#ffffff" },
  { x: 78, y: 40, r: 0.9, o: 0.45, d: 0.6, c: "var(--accent)" },
];

// Rotating all-done rewards — variety keeps the dopamine hit from habituating.
const CELEBRATIONS = [
  { emoji: "🎉", title: "Day complete", line: "Every session ticked off — that's the whole plan. Beautifully done.", rain: true, spin: false },
  { emoji: "🌱", title: "Every seed planted", line: "You did the whole day. This is how the habit takes root.", rain: false, spin: false },
  { emoji: "🧭", title: "Pointed north all day", line: "Whole plan, done. That's a direction you can be proud of.", rain: false, spin: true },
  { emoji: "🌟", title: "That's the full set", line: "You finished everything you set out to do today.", rain: false, spin: false },
];

// Parse a "~9am" / "~5:30pm" slot label back into minutes-from-midnight.
function parseSlot(slot: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(slot);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

export default function Plan() {
  const today = todayKey();
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useSessions();
  const { data: settings } = useSettings();
  const { data: checkin } = useCheckin(today);
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const { data: suggestions = [], isLoading } = useSuggestions(today);
  const { data: calendarBlocks = [] } = useCalendarBlocks(
    `${today}T00:00:00.000Z`,
    `${today}T23:59:59.999Z`,
  );

  const yesterday = addDays(today, -1);
  const { data: yesterdaySuggestions = [] } = useSuggestions(yesterday);
  const updateYesterday = useUpdateSuggestion(yesterday);

  const carryOver = useMemo(
    () =>
      yesterdaySuggestions.filter(
        (s) => (s.est_minutes ?? 0) > 0 && s.category_id && s.status === "pending",
      ),
    [yesterdaySuggestions],
  );

  // Pre-compute a suggested time slot for each actionable suggestion based on today's calendar.
  const slotMap = useMemo(() => {
    const map = new Map<string, string>();
    const usedEnds: number[] = [];
    for (const s of suggestions.filter((s) => (s.est_minutes ?? 0) > 0)) {
      const slot = findFreeSlot(
        calendarBlocks.filter(() => true),
        s.est_minutes ?? 45,
      );
      if (slot) map.set(s.id, slot);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions.map((s) => s.id).join(), calendarBlocks.length]);

  const save = useSaveSuggestions();
  const update = useUpdateSuggestion(today);
  const createSession = useCreateSession();
  const removeSession = useRemoveSession();
  const updateSession = useUpdateSession();
  const createBlock = useCreateCalendarBlock();
  const generatedRef = useRef(false);

  // The session auto-logged when a suggestion was accepted — so the card can let
  // you correct what you actually did (type + duration) after ticking it off.
  function loggedSessionFor(suggestionId: string): Session | undefined {
    return sessions.find(
      (sess) =>
        (sess.payload as { suggestion_id?: string; auto_logged?: boolean })?.suggestion_id ===
          suggestionId &&
        (sess.payload as { auto_logged?: boolean })?.auto_logged === true,
    );
  }

  // The "N/M … this week" insight is baked into the suggestion at plan-generation
  // time, so it goes stale the moment you log a session. Recompute the running
  // count live from today's sessions while preserving the label + ✓.
  const weekStart = addDays(today, -dayIndex(today));
  function liveInsight(s: Suggestion): string | undefined {
    const stored = s.personal_insight;
    if (!stored || !s.category_id) return stored;
    const m = stored.match(/^(\d+)\/(\d+)(.*)$/);
    if (!m) return stored; // avg/streak insight — leave as-is
    const goal = Number(m[2]);
    const suffix = m[3].replace(/\s*✓\s*$/, "");
    const count = sessions.filter(
      (x) => x.category_id === s.category_id && x.date >= weekStart,
    ).length;
    return `${count}/${goal}${suffix}${count >= goal ? " ✓" : ""}`;
  }

  // Commit-to-time: turn a suggested slot into a planned block ("at 9am I will…").
  function commitTime(s: Suggestion, slot: string) {
    const mins = parseSlot(slot);
    if (mins == null || !s.category_id) return;
    const start = new Date();
    start.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    const end = new Date(start.getTime() + (s.est_minutes ?? 45) * 60_000);
    createBlock.mutate({
      title: s.text.split("\n")[0],
      category_id: s.category_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      source: "compass",
      busy: false,
      status: "planned",
    });
  }

  // Generate the plan once per day after check-in, persisting it so accept/
  // dismiss choices survive reloads. Regeneration keeps prior feedback.
  useEffect(() => {
    if (!settings || !checkin || isLoading) return;
    if (generatedRef.current) return;
    if (suggestions.length > 0) return;
    generatedRef.current = true;
    const draft = buildPlan({ date: today, checkin, categories, tasks, sessions, settings, calendarBlocks, library });
    save.mutate({ date: today, items: draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, checkin, isLoading, suggestions.length]);

  function handleToggle(s: (typeof suggestions)[number], accepted: boolean) {
    update.mutate({ id: s.id, patch: { status: accepted ? "accepted" : "pending" } });
    if (!s.category_id || (s.est_minutes ?? 0) === 0) return;

    if (accepted) {
      const alreadyLogged = sessions.some(
        (sess) =>
          (sess.payload as { suggestion_id?: string; auto_logged?: boolean })
            ?.suggestion_id === s.id &&
          (sess.payload as { auto_logged?: boolean })?.auto_logged === true,
      );
      if (!alreadyLogged) {
        createSession.mutate({
          category_id: s.category_id,
          date: today,
          type: s.session_type ?? "Session",
          duration_minutes:
            inferDurationFromBlocks(s.category_id, calendarBlocks) ?? s.est_minutes,
          payload: { auto_logged: true, suggestion_id: s.id },
        });
      }
    } else {
      const toRemove = sessions.find(
        (sess) =>
          (sess.payload as { suggestion_id?: string; auto_logged?: boolean })
            ?.suggestion_id === s.id &&
          (sess.payload as { auto_logged?: boolean })?.auto_logged === true,
      );
      if (toRemove) removeSession.mutate(toRemove.id);
    }
  }

  function regenerate() {
    if (!settings || !checkin) return;
    const draft = buildPlan({ date: today, checkin, categories, tasks, sessions, settings, calendarBlocks, library });
    save.mutate({ date: today, items: draft });
  }

  const visibleUnsorted = suggestions.filter(
    (s) => s.status !== "dismissed" && s.status !== "snoozed",
  );
  // Completed items sink to the bottom (stable within each group) so the plan
  // always leads with what's still to do.
  const visible = [...visibleUnsorted].sort(
    (a, b) => (a.status === "accepted" ? 1 : 0) - (b.status === "accepted" ? 1 : 0),
  );
  const actionable = visible.filter((s) => s.est_minutes !== 0);
  const doneCount = actionable.filter((s) => s.status === "accepted").length;
  const allDone = actionable.length > 0 && doneCount === actionable.length;

  // Fogg's B=MAP: surface exactly one obvious next action so the plan never
  // reads as an equally-weighted wall. The first not-yet-done session leads.
  const nextId = actionable.find((s) => s.status !== "accepted")?.id;

  // Fire the celebration only on the transition into "all done", never on load.
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateVariant, setCelebrateVariant] = useState(0);
  const mounted = useRef(false);
  const wasAllDone = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      wasAllDone.current = allDone;
      return;
    }
    if (allDone && !wasAllDone.current) {
      setCelebrateVariant(Math.floor(Math.random() * CELEBRATIONS.length));
      setCelebrating(true);
      const t = window.setTimeout(() => setCelebrating(false), 2800);
      wasAllDone.current = allDone;
      return () => window.clearTimeout(t);
    }
    wasAllDone.current = allDone;
  }, [allDone]);
  const celebration = CELEBRATIONS[celebrateVariant];

  // Plan-reveal moment: arriving fresh from check-in, briefly "build" the day
  // before the cards deal in — turns plan generation into an anticipated reward.
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    let flag = false;
    try {
      flag = sessionStorage.getItem("compass:reveal") === "1";
      if (flag) sessionStorage.removeItem("compass:reveal");
    } catch {
      /* sessionStorage unavailable — skip the reveal */
    }
    if (!flag) return;
    setRevealing(true);
    const t = window.setTimeout(() => setRevealing(false), 1100);
    return () => window.clearTimeout(t);
  }, []);

  if (!checkin) return null;

  return (
    <section className="space-y-3">
      {celebrating && celebration.rain && <ConfettiRain />}

      {/* Carry-over from yesterday */}
      {carryOver.length > 0 && (
        <div
          className="rounded-2xl p-3.5 space-y-2"
          style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
        >
          <p className="text-xs font-semibold text-[var(--muted)]">From yesterday</p>
          {carryOver.map((s) => {
            const cat = categories.find((c) => c.id === s.category_id);
            const accent = cat ? accentOf(cat.color).accent : "#7d7c6e";
            return (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span>{cat?.icon ?? "📋"}</span>
                <span className="flex-1 truncate text-[var(--muted)]">
                  {s.text.split("\n")[0]}
                </span>
                <button
                  onClick={() => {
                    updateYesterday.mutate({ id: s.id, patch: { status: "dismissed" } });
                    createSession.mutate({
                      category_id: s.category_id!,
                      date: yesterday,
                      type: s.session_type ?? "Session",
                      duration_minutes: s.est_minutes,
                      payload: { auto_logged: true, suggestion_id: s.id },
                    });
                  }}
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold hover:opacity-100"
                  style={{ background: accent + "22", color: accent }}
                >
                  ✓ done
                </button>
                <button
                  onClick={() =>
                    updateYesterday.mutate({ id: s.id, patch: { status: "dismissed" } })
                  }
                  className="shrink-0 text-xs text-[var(--muted)] hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Your day, gently planned</h2>
        <div className="flex items-center gap-3">
          {actionable.length > 0 && (
            // Endowed progress: the check-in already counts as your first tick,
            // so the day never starts at 0/N.
            <span className="text-xs font-medium text-[var(--muted)]">
              {doneCount + 1}/{actionable.length + 1} · check-in ✓
            </span>
          )}
          <button onClick={regenerate} className="text-xs text-[var(--muted)] underline hover:text-[var(--foreground)] hover:opacity-100">
            refresh
          </button>
        </div>
      </div>

      {allDone && (
        <div
          className="animate-celebrate relative overflow-hidden rounded-2xl p-6 text-center"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
            boxShadow: "var(--shadow-3)",
          }}
        >
          {/* Deep-space base with the site's green + apricot integrated as nebula. */}
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background: [
                "radial-gradient(135% 115% at 16% 10%, color-mix(in srgb, var(--primary-mid) 60%, transparent), transparent 58%)",
                "radial-gradient(125% 115% at 90% 94%, color-mix(in srgb, var(--accent) 52%, transparent), transparent 58%)",
                "radial-gradient(90% 80% at 62% 42%, color-mix(in srgb, var(--mist) 34%, transparent), transparent 68%)",
                "#0a110e",
              ].join(", "),
            }}
          />
          {/* Starfield */}
          <div className="absolute inset-0" aria-hidden>
            {STARS.map((s, i) => (
              <span
                key={i}
                className="star"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.r,
                  height: s.r,
                  background: s.c,
                  boxShadow: s.r >= 1.8 ? `0 0 ${s.r * 2.5}px ${s.c}` : undefined,
                  ["--star-o" as string]: s.o,
                  animationDelay: `${s.d}s`,
                }}
              />
            ))}
          </div>

          <div className="relative">
            <div className="mb-2.5">
              <CompassRose size={88} spin onDark />
            </div>
            <p className="text-base font-bold" style={{ color: "#fffef8" }}>
              {celebration.title}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>
              {celebration.line}
            </p>
          </div>
        </div>
      )}

      {revealing ? (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            ✨ Building your day…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card animate-pulse p-4" style={{ height: 76, opacity: 0.55 }} />
          ))}
        </div>
      ) : (
        <>
      {visible.length === 0 && (
        <div className="card p-6 text-center">
          <CompassRose size={72} />
          <p className="mt-3 text-sm text-[var(--muted)]">
            Nothing pressing today — enjoy the breathing room.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((s, i) => {
          const cat = categories.find((c) => c.id === s.category_id);
          const accent = cat ? accentOf(cat.color).accent : "#5b8a72";
          return s.est_minutes === 0 ? (
            <Affirmation key={s.id} suggestion={s} index={i} />
          ) : (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              category={cat}
              accent={accent}
              isNext={s.id === nextId}
              index={i}
              suggestedTime={slotMap.get(s.id)}
              personalInsight={liveInsight(s)}
              loggedSession={loggedSessionFor(s.id)}
              onUpdateSession={(patch) => {
                const ls = loggedSessionFor(s.id);
                if (ls) updateSession.mutate({ id: ls.id, patch });
              }}
              onCommitTime={
                slotMap.get(s.id) ? () => commitTime(s, slotMap.get(s.id)!) : undefined
              }
              onToggle={(n) => handleToggle(s, n)}
              onSnooze={() => update.mutate({ id: s.id, patch: { status: "snoozed" } })}
              onDismiss={() => update.mutate({ id: s.id, patch: { status: "dismissed" } })}
            />
          );
        })}
      </div>
        </>
      )}

      {suggestions.some((s) => s.status === "snoozed") && (
        <Button
          variant="ghost"
          onClick={() =>
            suggestions
              .filter((s) => s.status === "snoozed")
              .forEach((s) => update.mutate({ id: s.id, patch: { status: "pending" } }))
          }
        >
          Bring back snoozed
        </Button>
      )}
    </section>
  );
}

// ── Actionable session card, with collapsible "how to approach" steps ─────────

function SuggestionCard({
  suggestion: s,
  category: cat,
  accent,
  isNext = false,
  index = 0,
  suggestedTime,
  personalInsight,
  loggedSession,
  onUpdateSession,
  onCommitTime,
  onToggle,
  onSnooze,
  onDismiss,
}: {
  suggestion: Suggestion;
  category?: Category;
  accent: string;
  isNext?: boolean;
  index?: number;
  suggestedTime?: string;
  personalInsight?: string;
  loggedSession?: Session;
  onUpdateSession?: (patch: { type: string; duration_minutes?: number }) => void;
  onCommitTime?: () => void;
  onToggle: (next: boolean) => void;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  const accepted = s.status === "accepted";
  const [open, setOpen] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const highlight = isNext && !accepted;
  const tiltRef = useTilt<HTMLDivElement>(highlight);

  // The suggestion text packs a header (and maybe a "Task:" line) followed by
  // "· " bullet steps. Split so the headline stays, the steps tuck away.
  const lines = s.text.split("\n");
  const headerLines = lines.filter((l) => !l.trimStart().startsWith("·"));
  const steps = lines
    .filter((l) => l.trimStart().startsWith("·"))
    .map((l) => l.replace(/^\s*·\s*/, ""));

  // ── Completed → a calm, compact "done" row (settles to the bottom of the plan).
  if (accepted) {
    return (
      <div
        className="animate-pop rounded-2xl p-3"
        style={{
          background: `color-mix(in srgb, ${accent} 8%, var(--surface))`,
          border: `1px solid ${accent}22`,
          animationDelay: `${index * 60}ms`,
        }}
      >
        {adjusting && loggedSession && onUpdateSession && cat ? (
          <SessionEditor
            categoryName={cat.name}
            initialType={loggedSession.type}
            initialDuration={loggedSession.duration_minutes}
            accent={accent}
            onCancel={() => setAdjusting(false)}
            onSave={(patch) => {
              onUpdateSession(patch);
              setAdjusting(false);
            }}
          />
        ) : (
          <div className="flex items-center gap-3">
            <TickCircle checked accent={accent} size={22} onChange={onToggle} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {headerLines[0]}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                {cat ? `${cat.icon} ` : ""}
                {loggedSession
                  ? `${loggedSession.type}${loggedSession.duration_minutes ? ` · ${loggedSession.duration_minutes} min` : ""}`
                  : "done"}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: accent + "22", color: accent }}
            >
              {(() => {
                // Show the live weekly count (e.g. "1/4 ✓") so ticking visibly
                // moves the goal; fall back to a plain done marker otherwise.
                const m = personalInsight?.match(/^(\d+\/\d+)/);
                if (!m) return "✓ done";
                return m[1] + (/✓\s*$/.test(personalInsight ?? "") ? " ✓" : "");
              })()}
            </span>
            {loggedSession && onUpdateSession && (
              <button
                onClick={() => setAdjusting(true)}
                className="shrink-0 text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 transition-colors hover:text-[var(--foreground)]"
              >
                adjust
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={tiltRef}
      className={`card animate-pop p-4 ${highlight ? "animate-breathe" : ""}`}
      style={{
        // longhand (not the borderLeft shorthand) so it never conflicts with a
        // borderColor set elsewhere during rerender
        borderLeftWidth: "3px",
        borderLeftStyle: "solid",
        borderLeftColor: accent,
        opacity: accepted ? 0.72 : 1,
        transition: highlight ? "transform 0.25s ease, opacity 0.3s ease" : "opacity 0.3s ease",
        animationDelay: `${index * 60}ms`,
        ...(highlight ? { boxShadow: `0 0 0 1.5px ${accent}55` } : {}),
      }}
    >
      {highlight && (
        <div
          className="mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: accent + "1f", color: accent }}
        >
          <span aria-hidden>🌿</span> Start here
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <TickCircle checked={accepted} accent={accent} onChange={onToggle} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{headerLines[0]}</p>
          {headerLines.slice(1).map((line, i) => (
            <p key={i} className="mt-0.5 text-sm text-[var(--muted)]">
              {line}
            </p>
          ))}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {cat && (
              <Pill color={accent}>
                {cat.icon} {cat.name}
              </Pill>
            )}
            {s.est_minutes ? <Pill color="#7d7c6e">~{s.est_minutes} min</Pill> : null}
            {suggestedTime && !accepted &&
              (committed ? (
                <Pill color="#5b8a72">🗓 planned {suggestedTime}</Pill>
              ) : onCommitTime ? (
                <button
                  onClick={() => {
                    onCommitTime();
                    setCommitted(true);
                  }}
                  title="Add this to today's calendar"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all hover:scale-105"
                  style={{ background: "#7a9bb522", color: "#7a9bb5" }}
                >
                  🕐 {suggestedTime} · plan it
                </button>
              ) : (
                <Pill color="#7a9bb5">🕐 {suggestedTime}</Pill>
              ))}
            {personalInsight && (
              <Pill color="#5b8a72">{personalInsight}</Pill>
            )}
          </div>

          {steps.length > 0 && (
            <div className="mt-2.5">
              <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all hover:brightness-95 hover:opacity-100"
                style={{ background: accent + "14", color: accent }}
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>📋</span>
                  {open ? "Hide the approach" : `How to approach this — ${steps.length} steps`}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div className={`collapsible ${open ? "open" : ""}`}>
                <div>
                  <ol className="mt-2 space-y-1.5 pl-1">
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-snug">
                        <span
                          className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                          style={{ background: accent + "22", color: accent }}
                        >
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-[var(--muted)]">{s.reason}</p>
        </div>

        {!accepted && (
          <div className="flex flex-col gap-1">
            <button onClick={onSnooze} className="text-xs text-[var(--muted)] hover:scale-125 hover:opacity-100" title="Snooze">
              💤
            </button>
            <button onClick={onDismiss} className="text-xs text-[var(--muted)] hover:scale-125 hover:text-[#c06b5a] hover:opacity-100" title="Not today">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Affirmation / momentum note — visually distinct from actionable cards ─────

function Affirmation({ suggestion: s, index = 0 }: { suggestion: Suggestion; index?: number }) {
  return (
    <div
      className="animate-pop relative overflow-hidden rounded-2xl p-3.5"
      style={{
        background: "linear-gradient(135deg, var(--success-soft), var(--primary-soft))",
        border: "1px dashed color-mix(in srgb, var(--success-text) 40%, transparent)",
        animationDelay: `${index * 60}ms`,
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
            {s.text}
          </p>
          <p className="text-xs" style={{ color: "var(--success-text)", opacity: 0.85 }}>
            {s.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Full-screen confetti rain for the all-done celebration ────────────────────

function ConfettiRain() {
  const pieces = Array.from({ length: 64 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const size = 6 + Math.random() * 7;
        return (
          <span
            key={i}
            className="confetti-rain-piece"
            style={
              {
                left: `${Math.random() * 100}%`,
                width: size,
                height: size,
                background: RAIN_COLORS[i % RAIN_COLORS.length],
                animationDelay: `${Math.random() * 0.7}s`,
                animationDuration: `${1.6 + Math.random() * 1.3}s`,
                "--rot": `${Math.random() * 720 - 360}deg`,
                "--drift": `${Math.random() * 90 - 45}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
