"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, Metric, MetricLog, Session } from "@/lib/types";
import {
  useCreateMetricLog,
  useCreateSession,
  useMetricLogs,
  useSessions,
  useUpdateSession,
} from "@/lib/queries";
import { todayKey } from "@/lib/date";
import { shouldPromptSkillConfidence } from "@/lib/sessionInfer";
import { Button, ScalePicker, Sheet } from "./ui";

const SESSION_TYPES: Record<string, string[]> = {
  Gym: ["Push", "Pull", "Legs", "Full body", "Cardio", "Mobility", "Recovery"],
  Tennis: ["Serve", "Forehand", "Backhand", "Volleys", "Match", "Fitness"],
  "Uni work": ["Study", "Reading", "Problem set", "Revision", "Past paper", "Group work"],
  "Job searching": ["Applications", "Follow-ups", "Interview", "Networking"],
  Finances: ["Review", "Budgeting"],
};

const ENERGY_EMOJI = ["", "😴", "😕", "😐", "😊", "⚡"];

const FEEL_OPTIONS = [
  { v: "too_short", label: "Could've done more", emoji: "⚡" },
  { v: "just_right", label: "Felt just right", emoji: "✓" },
  { v: "too_much", label: "That was enough", emoji: "💤" },
];

const SKILL_FEEL_OPTIONS = [
  { v: 1, label: "Rough — really struggled" },
  { v: 2, label: "Inconsistent — glimpses" },
  { v: 3, label: "Getting there — more good than bad" },
  { v: 4, label: "Clicking — felt natural" },
  { v: 5, label: "Solid — confident all session" },
];

export default function LogSheet({
  open,
  onClose,
  category,
  metrics,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  category: Category;
  metrics: Metric[];
  accent: string;
}) {
  const { data: allLogs = [] } = useMetricLogs();
  const { data: allSessions = [] } = useSessions();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const createLog = useCreateMetricLog();

  const isTennis = category.name === "Tennis";
  const types = SESSION_TYPES[category.name] ?? ["Session"];

  const [step, setStep] = useState<"log" | "feedback">("log");
  const [savedSession, setSavedSession] = useState<Session | null>(null);

  // Log form state
  const [date, setDate] = useState(todayKey());
  const [type, setType] = useState(types[0]);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});

  // Feedback state
  const [energy, setEnergy] = useState<number | undefined>(undefined);
  const [durationFeel, setDurationFeel] = useState<string | undefined>(undefined);
  const [skillConfidence, setSkillConfidence] = useState<number | undefined>(undefined);

  // Reset everything when sheet closes
  useEffect(() => {
    if (!open) {
      setStep("log");
      setSavedSession(null);
      setEnergy(undefined);
      setDurationFeel(undefined);
      setSkillConfidence(undefined);
    }
  }, [open]);

  // Pre-fill each metric from its most recent logged value (SPEC §10).
  const lastByMetric = useMemo(() => {
    const map: Record<string, MetricLog | undefined> = {};
    for (const m of metrics) {
      map[m.id] = allLogs
        .filter((l) => l.metric_id === m.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    }
    return map;
  }, [allLogs, metrics]);

  function valueFor(m: Metric): string | number | boolean {
    if (m.id in values) return values[m.id];
    const last = lastByMetric[m.id]?.value;
    if (last !== undefined) return last;
    return m.type === "boolean" ? false : "";
  }

  function setValue(id: string, v: string | number | boolean) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function save() {
    let session: Session | undefined;

    if (duration || type) {
      session = await createSession.mutateAsync({
        category_id: category.id,
        date,
        type,
        duration_minutes: duration ? Number(duration) : undefined,
        payload: !isTennis && notes ? { notes } : {},
      });
    }

    // Tennis skips metric logging — feedback is the data source.
    if (!isTennis) {
      for (const m of metrics) {
        const raw = valueFor(m);
        if (raw === "" || raw === undefined) continue;
        const value = m.type === "numeric" || m.type === "scale" ? Number(raw) : raw;
        if ((m.type === "numeric" || m.type === "scale") && Number.isNaN(value as number)) continue;
        createLog.mutate({ metric_id: m.id, date, value });
      }
    }

    // Reset log form
    setValues({});
    setDuration("");
    setNotes("");

    if (session) {
      setSavedSession(session);
      setStep("feedback");
    } else {
      onClose();
    }
  }

  // Determine once at component scope so saveFeedback and the render both see the same value.
  const showSkillConfidence =
    savedSession !== null &&
    isTennis &&
    !["Match", "Fitness"].includes(savedSession?.type ?? "") &&
    shouldPromptSkillConfidence(allSessions, category.id, savedSession?.type ?? "", todayKey());

  function saveFeedback() {
    if (savedSession) {
      const feedback: Record<string, unknown> = {};
      if (energy !== undefined) feedback.energy_after = energy;
      if (durationFeel !== undefined) feedback.duration_feel = durationFeel;
      if (showSkillConfidence && skillConfidence !== undefined) feedback.skill_confidence = skillConfidence;

      if (Object.keys(feedback).length > 0) {
        updateSession.mutate({
          id: savedSession.id,
          patch: {
            payload: { ...savedSession.payload, feedback },
          },
        });
      }
    }
    onClose();
  }

  // ── Feedback step ──────────────────────────────────────────────────────────
  if (step === "feedback" && savedSession) {
    const isSkillSession = isTennis && !["Match", "Fitness"].includes(savedSession.type);
    const skillLabel = isSkillSession ? savedSession.type.toLowerCase() : null;

    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={`How was that ${isTennis ? type : category.name.toLowerCase()} session?`}
      >
        <div className="space-y-5">
          {/* Q1: Energy */}
          <div>
            <p className="mb-2 text-sm font-medium">Energy / focus during?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEnergy(v)}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 transition-all hover:scale-[1.06] hover:opacity-100"
                  style={{
                    borderColor: energy === v ? accent : "var(--border)",
                    background: energy === v ? accent + "22" : "var(--surface)",
                  }}
                >
                  <span className="text-lg">{ENERGY_EMOJI[v]}</span>
                  <span className="text-xs text-[var(--muted)]">{v}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Q2: Duration feel */}
          <div>
            <p className="mb-2 text-sm font-medium">How did the duration feel?</p>
            <div className="space-y-2">
              {FEEL_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setDurationFeel(o.v)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-sm transition-all hover:scale-[1.02] hover:shadow-sm hover:opacity-100"
                  style={{
                    borderColor: durationFeel === o.v ? accent : "var(--border)",
                    background: durationFeel === o.v ? accent + "18" : "var(--surface)",
                  }}
                >
                  <span className="text-base">{o.emoji}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q3: Skill feel (tennis only, prompted occasionally — not every session) */}
          {showSkillConfidence && skillLabel && (
            <div>
              <p className="mb-2 text-sm font-medium">
                How did your{" "}
                <span style={{ color: accent }} className="font-semibold">
                  {skillLabel}
                </span>{" "}
                feel today?
              </p>
              <div className="space-y-1.5">
                {SKILL_FEEL_OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setSkillConfidence(o.v)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all hover:scale-[1.02] hover:shadow-sm hover:opacity-100"
                    style={{
                      borderColor: skillConfidence === o.v ? accent : "var(--border)",
                      background: skillConfidence === o.v ? accent + "18" : "var(--surface)",
                    }}
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full text-center text-xs font-bold leading-5"
                      style={{
                        background: skillConfidence === o.v ? accent : accent + "22",
                        color: skillConfidence === o.v ? "#fff" : accent,
                      }}
                    >
                      {o.v}
                    </span>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--muted)]">
            {isTennis
              ? "Your answers help Compass know which skills need the most attention next time."
              : "Your answers personalise future suggestions — the more you log, the better they get."}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Skip
            </Button>
            <Button
              variant="primary"
              color={accent}
              disabled={energy === undefined && durationFeel === undefined && skillConfidence === undefined}
              onClick={saveFeedback}
            >
              Save feedback
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  // ── Log step ───────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onClose={onClose} title={`Log ${category.name}`}>
      <div className="space-y-4">
        <label className="block text-xs font-medium text-[var(--muted)]">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">
            {isTennis ? "Focus area" : "Session type"}
          </p>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:scale-[1.05] hover:opacity-100"
                style={{
                  background: type === t ? accent : accent + "1a",
                  color: type === t ? "#fff" : accent,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {isTennis ? (
          // Tennis: just a prominent duration field
          <label className="block text-xs font-medium text-[var(--muted)]">
            Duration (min)
            <input
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 45"
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-3 text-lg font-medium"
            />
          </label>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[var(--muted)]">
                Duration (min)
                <input
                  type="number"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="optional"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Notes
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="what worked?"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
            </div>

            {metrics.length > 0 && (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <p className="text-xs font-medium text-[var(--muted)]">Metrics</p>
                {metrics.map((m) => (
                  <div key={m.id}>
                    <p className="mb-1 text-sm font-medium">
                      {m.name}
                      {m.unit ? <span className="text-[var(--muted)]"> ({m.unit})</span> : null}
                    </p>
                    {m.type === "scale" ? (
                      <ScalePicker
                        value={Number(valueFor(m)) || undefined}
                        onChange={(v) => setValue(m.id, v)}
                        color={accent}
                      />
                    ) : m.type === "boolean" ? (
                      <button
                        type="button"
                        onClick={() => setValue(m.id, !valueFor(m))}
                        className="rounded-lg px-4 py-2 text-sm font-medium hover:scale-[1.04] hover:opacity-100"
                        style={{
                          background: valueFor(m) ? accent : accent + "1a",
                          color: valueFor(m) ? "#fff" : accent,
                        }}
                      >
                        {valueFor(m) ? "Yes" : "No"}
                      </button>
                    ) : (
                      <input
                        type={m.type === "numeric" ? "number" : "text"}
                        inputMode={m.type === "numeric" ? "decimal" : undefined}
                        value={String(valueFor(m) ?? "")}
                        onChange={(e) => setValue(m.id, e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" color={accent} onClick={save} disabled={createSession.isPending}>
            Save log
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
