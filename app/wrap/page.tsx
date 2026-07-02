"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCategories,
  useCheckin,
  useSessions,
  useSessionTemplates,
  useSettings,
  useTasks,
  useUpsertCheckin,
} from "@/lib/queries";
import { addDays, todayKey } from "@/lib/date";
import { buildPlan } from "@/lib/planner";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { Button } from "@/components/ui";

const RATINGS = [
  { v: 3, emoji: "🌟", label: "Great", color: "#5b8a72" },
  { v: 2, emoji: "😌", label: "Okay",  color: "#7a9bb5" },
  { v: 1, emoji: "😕", label: "Rough", color: "#c06b5a" },
];

function fmtMin(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function WrapPage() {
  const router = useRouter();
  const today = todayKey();
  const { data: checkin } = useCheckin(today);
  const { data: sessions = [] } = useSessions();
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: settings } = useSettings();
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const upsert = useUpsertCheckin();

  const existing = (checkin?.extra?.evening_rating as number | undefined);
  const [rating, setRating] = useState<number | undefined>(existing);
  const [note, setNote] = useState<string>(
    (checkin?.extra?.evening_note as string | undefined) ?? "",
  );
  const [saved, setSaved] = useState(false);

  // Today's tally for the peak-end moment.
  const todaySessions = sessions.filter((s) => s.date === today);
  const countToday = todaySessions.length;
  const minutesToday = todaySessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => s.date));
    let n = 0;
    let cursor = today;
    for (let i = 0; i < 90; i++) {
      if (days.has(cursor)) n++;
      else if (i > 0) break; // today may be empty without breaking the run
      cursor = addDays(cursor, -1);
    }
    return n;
  }, [sessions, today]);

  // One-line sketch of tomorrow, to plant the next intention.
  const tomorrowChips = useMemo(() => {
    if (!settings) return [];
    const plan = buildPlan({
      date: addDays(today, 1),
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
  }, [settings, categories.length, sessions.length, tasks.length, library.length]);

  function save() {
    if (!rating) return;
    const base = checkin
      ? { mental: checkin.mental, uni_readiness: checkin.uni_readiness, capacity: checkin.capacity, note: checkin.note }
      : { mental: 3, uni_readiness: 3, capacity: "medium" as const };
    upsert.mutate(
      {
        date: today,
        ...base,
        extra: { ...(checkin?.extra ?? {}), evening_rating: rating, evening_note: note || undefined },
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  const chosen = RATINGS.find((r) => r.v === rating);

  // ── Peak-end moment ─────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div
          className="animate-celebrate card p-6 text-center"
          style={{
            background: "linear-gradient(135deg, var(--primary-soft), var(--accent-soft))",
            borderColor: "var(--mist)",
          }}
        >
          <div className="text-5xl">🌙</div>
          <h1 className="mt-2 text-xl font-bold" style={{ color: "var(--primary)" }}>
            Day closed
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {rating === 3 && "A good one — whatever you did today, keep it."}
            {rating === 2 && "Steady days add up. Rest well."}
            {rating === 1 && "Noted. Tomorrow's plan will be a little gentler."}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              [String(countToday), countToday === 1 ? "session" : "sessions"],
              [fmtMin(minutesToday), "logged"],
              [streak > 0 ? `${streak}d` : "—", "streak"],
            ].map(([val, lab]) => (
              <div
                key={lab}
                className="rounded-xl p-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{val}</p>
                <p className="text-[10px] text-[var(--muted)]">{lab}</p>
              </div>
            ))}
          </div>
        </div>

        {tomorrowChips.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Tomorrow looks like</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tomorrowChips.map((c, i) => (
                <span
                  key={i}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  {c.icon} {c.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <Button variant="primary" color="#5b8a72" onClick={() => router.push("/")} className="w-full">
          Back to today →
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-7">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Close the day</h1>
        <p className="text-sm text-[var(--muted)]">
          One tap — then you&apos;re done. Compass uses this to shape tomorrow.
        </p>
      </header>

      {/* Rating buttons */}
      <div className="grid grid-cols-3 gap-3">
        {RATINGS.map((r) => {
          const active = rating === r.v;
          return (
            <button
              key={r.v}
              onClick={() => setRating(r.v)}
              className="flex flex-col items-center gap-2 rounded-2xl border py-5 transition-all hover:scale-[1.03] hover:opacity-100"
              style={{
                borderColor: active ? r.color : "var(--border)",
                background: active ? r.color + "18" : "var(--surface)",
              }}
            >
              <span className="text-3xl">{r.emoji}</span>
              <span
                className="text-sm font-semibold"
                style={{ color: active ? r.color : "var(--muted)" }}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Optional note */}
      {rating && (
        <div className="space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              rating === 3
                ? "What made it great? (optional)"
                : rating === 1
                ? "What got in the way? (optional)"
                : "Anything to note? (optional)"
            }
            className="w-full rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
            style={{ background: "var(--surface)" }}
            autoFocus
          />
        </div>
      )}

      {/* Insight */}
      {chosen && (
        <p className="text-sm text-[var(--muted)]">
          {chosen.v === 3 && "Nice — whatever you did today, keep it."}
          {chosen.v === 2 && "Steady days add up. Tomorrow's a fresh start."}
          {chosen.v === 1 && "Noted. Tomorrow's plan will be a little gentler."}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/")}>
          Skip
        </Button>
        <Button
          variant="primary"
          color="#5b8a72"
          disabled={!rating || upsert.isPending}
          onClick={save}
        >
          Save & close →
        </Button>
      </div>
    </div>
  );
}
