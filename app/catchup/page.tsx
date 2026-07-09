"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useCategories,
  useCheckins,
  useCreateSession,
  useMetrics,
  useSessions,
  useSessionTemplates,
  useSettings,
  useTasks,
  useUpdateSession,
  useUpsertCheckin,
} from "@/lib/queries";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { findMissedDays, reconstructMissedDayPlan, type MissedDay } from "@/lib/missedDays";
import { prettyDate, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import { IconChip } from "@/components/ui";
import LogSheet from "@/components/LogSheet";
import SessionEditor from "@/components/SessionEditor";
import { LeafMark } from "@/components/decor";
import type { AppSettings, Category, Checkin, Session, SessionTemplate, Task } from "@/lib/types";
import type { DraftSuggestion } from "@/lib/planner";

export default function CatchupPage() {
  const { data: categories = [] } = useCategories();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const { data: checkins = [], isLoading: checkinsLoading } = useCheckins();
  const { data: settings } = useSettings();
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const { data: metrics = [] } = useMetrics();
  const today = todayKey();

  // Freeze the list of missed days once, on first load with full data — so
  // logging something for one day doesn't yank other days out of view mid-session
  // (that day naturally stops being "missed" on your NEXT visit instead).
  const [missedDays, setMissedDays] = useState<MissedDay[] | null>(null);
  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current) return;
    if (sessionsLoading || tasksLoading || checkinsLoading || !settings) return;
    readyRef.current = true;
    setMissedDays(
      findMissedDays(sessions, tasks, checkins, settings.onboarding_completed_at, today),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsLoading, tasksLoading, checkinsLoading, settings]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Catching up</h1>
        <p className="text-sm text-[var(--muted)]">
          No pressure — just fill in what you remember. Missed days don&apos;t count against you,
          and your goals update the moment you log something.
        </p>
      </header>

      {missedDays === null && (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      )}

      {missedDays !== null && missedDays.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <LeafMark size={36} />
          <p className="text-sm text-[var(--muted)]">You&apos;re all caught up — nothing to fill in.</p>
        </div>
      )}

      {missedDays !== null &&
        missedDays.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            categories={categories}
            tasks={tasks}
            sessions={sessions}
            checkins={checkins}
            settings={settings}
            library={library}
            metrics={metrics}
          />
        ))}

      <Link
        href="/"
        className="block text-center text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)]"
      >
        ← Back to today
      </Link>
    </div>
  );
}

// ── One missed day: reconstructed suggestions + freeform add + rest-day ───────

function DayCard({
  day,
  categories,
  tasks,
  sessions,
  checkins,
  settings,
  library,
  metrics,
}: {
  day: MissedDay;
  categories: Category[];
  tasks: Task[];
  sessions: Session[];
  checkins: Checkin[];
  settings: AppSettings | undefined;
  library: SessionTemplate[];
  metrics: ReturnType<typeof useMetrics>["data"];
}) {
  const { date, weekdayLabel } = day;
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const upsertCheckin = useUpsertCheckin();

  const items = useMemo(
    () => (settings ? reconstructMissedDayPlan(date, categories, tasks, sessions, settings, library) : []),
    [date, categories, tasks, sessions, settings, library],
  );

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [markedRest, setMarkedRest] = useState(false);
  const [logCat, setLogCat] = useState<Category | null>(null);

  const daySessions = sessions.filter((s) => s.date === date);
  const hasAnyLogged = daySessions.length > 0;
  const existingCheckin = checkins.find((c) => c.date === date);
  const alreadyReviewed = existingCheckin?.extra?.catchup_reviewed === true;
  const showRestButton = !hasAnyLogged && !markedRest && !alreadyReviewed;
  const activeCats = categories.filter((c) => c.active);

  function logItem(item: DraftSuggestion) {
    if (!item.category_id) return;
    createSession.mutate({
      category_id: item.category_id,
      date,
      type: item.session_type ?? "Session",
      duration_minutes: item.est_minutes,
      payload: { catch_up: true },
    });
  }

  function markRestDay() {
    upsertCheckin.mutate({
      date,
      mental: existingCheckin?.mental ?? 3,
      uni_readiness: existingCheckin?.uni_readiness ?? 3,
      capacity: "light",
      note: existingCheckin?.note,
      extra: { ...(existingCheckin?.extra ?? {}), catchup_reviewed: true },
    });
    setMarkedRest(true);
  }

  const visibleItems = items.filter((i) => i.category_id && !dismissed.has(i.category_id));

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm font-semibold">
        {weekdayLabel} <span className="text-[var(--muted)] font-normal">· {prettyDate(date)}</span>
      </p>

      {visibleItems.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Nothing was suggested that day — but you can still log what you did below.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <DayItemRow
              key={item.category_id}
              item={item}
              date={date}
              categories={categories}
              sessions={sessions}
              onLog={() => logItem(item)}
              onDismiss={() =>
                setDismissed((prev) => new Set(prev).add(item.category_id as string))
              }
              onUpdateSession={(id, patch) => updateSession.mutate({ id, patch })}
            />
          ))}
        </div>
      )}

      {/* Freeform: log something that wasn't in the reconstructed list */}
      {activeCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
          {activeCats.map((c) => {
            const accent = accentOf(c.color);
            return (
              <button
                key={c.id}
                onClick={() => setLogCat(c)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium transition-all hover:scale-105"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: accent.text }}
              >
                <IconChip emoji={c.icon} color={accent.accent} size={20} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {showRestButton && (
        <button
          onClick={markRestDay}
          className="w-full rounded-xl py-2 text-xs font-medium transition-all hover:opacity-100"
          style={{ background: "var(--success-soft)", color: "var(--success-text)" }}
        >
          🌿 Nothing to log — mark as a rest day
        </button>
      )}
      {(markedRest || alreadyReviewed) && !hasAnyLogged && (
        <p className="text-xs" style={{ color: "var(--success-text)" }}>
          🌿 Marked as a rest day — your streak is protected.
        </p>
      )}

      {logCat && (
        <LogSheet
          open
          onClose={() => setLogCat(null)}
          category={logCat}
          metrics={(metrics ?? []).filter((m) => m.category_id === logCat.id)}
          accent={accentOf(logCat.color).accent}
          initialDate={date}
        />
      )}
    </div>
  );
}

// ── One reconstructed item — "did you do this?" or, once logged, an editable row.

function DayItemRow({
  item,
  date,
  categories,
  sessions,
  onLog,
  onDismiss,
  onUpdateSession,
}: {
  item: DraftSuggestion;
  date: string;
  categories: Category[];
  sessions: Session[];
  onLog: () => void;
  onDismiss: () => void;
  onUpdateSession: (id: string, patch: { type: string; duration_minutes?: number }) => void;
}) {
  const cat = categories.find((c) => c.id === item.category_id);
  const accent = cat ? accentOf(cat.color).accent : "#5b8a72";
  const logged = sessions.find((s) => s.date === date && s.category_id === item.category_id);
  const [adjusting, setAdjusting] = useState(false);
  const headline = item.text.split("\n")[0];

  if (logged) {
    return (
      <div
        className="rounded-xl p-2.5"
        style={{ background: `color-mix(in srgb, ${accent} 8%, var(--surface))`, border: `1px solid ${accent}22` }}
      >
        {adjusting ? (
          <SessionEditor
            categoryName={cat?.name ?? ""}
            initialType={logged.type}
            initialDuration={logged.duration_minutes}
            accent={accent}
            onCancel={() => setAdjusting(false)}
            onSave={(patch) => {
              onUpdateSession(logged.id, patch);
              setAdjusting(false);
            }}
          />
        ) : (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-base" style={{ color: accent }}>✓</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {cat?.icon} {cat?.name}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {logged.type}
                {logged.duration_minutes ? ` · ${logged.duration_minutes} min` : ""}
              </p>
            </div>
            <button
              onClick={() => setAdjusting(true)}
              className="shrink-0 text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)]"
            >
              adjust
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="card flex items-center gap-3 p-2.5"
      style={{ borderLeftWidth: "3px", borderLeftStyle: "solid", borderLeftColor: accent }}
    >
      <span className="shrink-0 text-lg">{cat?.icon ?? "🌿"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{headline}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {cat?.name}
          {item.est_minutes ? ` · ~${item.est_minutes} min` : ""}
        </p>
      </div>
      <button
        onClick={onLog}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105"
        style={{ background: accent, color: "#fff" }}
      >
        ✓ did it
      </button>
      <button
        onClick={onDismiss}
        aria-label="Not that"
        className="shrink-0 text-[var(--muted)] transition-all hover:scale-110 hover:text-[#c06b5a]"
      >
        ✕
      </button>
    </div>
  );
}
