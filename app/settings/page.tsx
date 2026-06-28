"use client";

import { useState } from "react";
import IntroTour from "@/components/IntroTour";
import {
  useCategories,
  useCreateCategory,
  useRemoveCategory,
  useReorderCategories,
  useSaveSettings,
  useSettings,
  useUpdateCategory,
} from "@/lib/queries";
import { PALETTE, PALETTE_KEYS, accentOf } from "@/lib/palette";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Category, DayIndex } from "@/lib/types";
import { Button } from "@/components/ui";
import ConnectionsPanel from "@/components/calendar/ConnectionsPanel";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const SCHEDULE_ROWS: { key: "gym" | "tennis" | "study"; label: string }[] = [
  { key: "study", label: "Study days" },
  { key: "gym", label: "Gym days" },
  { key: "tennis", label: "Tennis days" },
];
const WEIGHTS: { key: "neglect" | "readiness" | "deadline" | "balance"; label: string; hint: string }[] = [
  { key: "deadline", label: "Deadline urgency", hint: "Prioritise approaching due dates" },
  { key: "neglect", label: "Neglected areas", hint: "Nudge areas you haven't touched lately" },
  { key: "readiness", label: "Readiness", hint: "Lean into how ready you feel today" },
  { key: "balance", label: "Balance", hint: "Spread suggestions across areas" },
];

export default function SettingsPage() {
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const removeCat = useRemoveCategory();
  const reorder = useReorderCategories();
  const saveSettings = useSaveSettings();

  const [newName, setNewName] = useState("");
  const [tourOpen, setTourOpen] = useState(false);

  function move(cat: Category, dir: -1 | 1) {
    const ordered = [...categories].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((c) => c.id === cat.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    reorder.mutate(ordered.map((c) => c.id));
  }

  function toggleDay(key: "gym" | "tennis" | "study", day: DayIndex) {
    if (!settings) return;
    const cur = settings.weeklySchedule[key];
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    saveSettings.mutate({ weeklySchedule: { ...settings.weeklySchedule, [key]: next } });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Make Compass yours.</p>
      </header>

      {/* Profile */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Your name</h2>
        <input
          defaultValue={settings?.greetingName ?? ""}
          onBlur={(e) => saveSettings.mutate({ greetingName: e.target.value })}
          placeholder="What should I call you?"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
        />
      </section>

      {/* Areas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Areas</h2>
        <div className="space-y-2">
          {[...categories]
            .sort((a, b) => a.order - b.order)
            .map((cat) => {
              const accent = accentOf(cat.color);
              return (
                <div key={cat.id} className="card space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={cat.icon}
                      onBlur={(e) => updateCat.mutate({ id: cat.id, patch: { icon: e.target.value } })}
                      className="w-10 rounded-lg border border-[var(--border)] px-1 py-1.5 text-center"
                    />
                    <input
                      defaultValue={cat.name}
                      onBlur={(e) => updateCat.mutate({ id: cat.id, patch: { name: e.target.value } })}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm font-medium"
                      style={{ color: accent.text }}
                    />
                    <button onClick={() => move(cat, -1)} className="px-1 text-[var(--muted)] hover:scale-125 hover:text-[var(--foreground)] hover:opacity-100" aria-label="Move up">
                      ↑
                    </button>
                    <button onClick={() => move(cat, 1)} className="px-1 text-[var(--muted)] hover:scale-125 hover:text-[var(--foreground)] hover:opacity-100" aria-label="Move down">
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${cat.name}? Its tasks and logs stay in storage.`))
                          removeCat.mutate(cat.id);
                      }}
                      className="px-1 text-[var(--muted)] hover:scale-110 hover:text-[#c06b5a] hover:opacity-100"
                      aria-label="Delete area"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => updateCat.mutate({ id: cat.id, patch: { color: key } })}
                        aria-label={PALETTE[key].label}
                        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-125 hover:opacity-100"
                        style={{
                          background: PALETTE[key].accent,
                          borderColor: cat.color === key ? "var(--foreground)" : "transparent",
                          transform: cat.color === key ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="card flex items-center gap-2 p-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                createCat.mutate({ name: newName.trim(), color: "slate", icon: "⭐", active: true });
                setNewName("");
              }
            }}
            placeholder="Add a new area…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <Button
            variant="soft"
            color="#3e6b54"
            disabled={!newName.trim()}
            onClick={() => {
              createCat.mutate({ name: newName.trim(), color: "slate", icon: "⭐", active: true });
              setNewName("");
            }}
          >
            Add
          </Button>
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Weekly schedule</h2>
        <p className="text-xs text-[var(--muted)]">
          Tells the check-in which questions to ask and shapes your daily plan.
        </p>
        <div className="card space-y-3 p-4">
          {SCHEDULE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2">
              <span className="text-sm">{row.label}</span>
              <div className="flex gap-1">
                {DAYS.map((d, i) => {
                  const on = settings?.weeklySchedule[row.key].includes(i as DayIndex) ?? false;
                  return (
                    <button
                      key={i}
                      onClick={() => toggleDay(row.key, i as DayIndex)}
                      className="h-8 w-8 rounded-full text-xs font-semibold transition-all hover:scale-110 hover:opacity-100"
                      style={{
                        background: on ? "var(--primary)" : "var(--background)",
                        color: on ? "#fffdf9" : "var(--muted)",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Planner weights */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Planner tuning</h2>
        <div className="card space-y-4 p-4">
          {WEIGHTS.map((w) => (
            <div key={w.key}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{w.label}</span>
                <span className="text-xs text-[var(--muted)]">
                  {(settings?.plannerWeights[w.key] ?? 1).toFixed(1)}×
                </span>
              </div>
              <p className="mb-1 text-xs text-[var(--muted)]">{w.hint}</p>
              <input
                type="range"
                min={0}
                max={2}
                step={0.5}
                value={settings?.plannerWeights[w.key] ?? 1}
                onChange={(e) =>
                  settings &&
                  saveSettings.mutate({
                    plannerWeights: {
                      ...settings.plannerWeights,
                      [w.key]: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-emerald-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Calendar connections */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Calendar connections</h2>
        <div className="card p-4">
          <ConnectionsPanel />
        </div>
      </section>

      {/* Help */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Help</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">How Compass works</p>
              <p className="text-xs text-[var(--muted)]">Replay the intro tour any time.</p>
            </div>
            <button
              onClick={() => setTourOpen(true)}
              className="rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              Replay tour
            </button>
          </div>
        </div>
      </section>

      {tourOpen && (
        <IntroTour forceOpen onClose={() => setTourOpen(false)} />
      )}

      {/* Integrations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Sync & integrations</h2>
        <div className="card space-y-3 p-4 text-sm">
          <Row
            label="Cloud sync (Supabase)"
            status={isSupabaseConfigured() ? "Connected" : "Local-only"}
            on={isSupabaseConfigured()}
            note={
              isSupabaseConfigured()
                ? "Your data syncs across devices."
                : "Running locally on this device. Add Supabase keys to sync — see README."
            }
          />
          <Row label="OnTrack (Deakin)" status="Phase 3" on={false} note="Pull uni tasks & deadlines automatically." />
          {isSupabaseConfigured() && (
            <div className="border-t border-[var(--border)] pt-3">
              <button
                onClick={() => getSupabase()?.auth.signOut()}
                className="text-xs text-red-500 underline hover:text-red-700 hover:opacity-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, status, on, note }: { label: string; status: string; on: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-[var(--muted)]">{note}</p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: on ? "var(--primary-soft)" : "var(--background)", color: on ? "var(--primary)" : "var(--muted)" }}
      >
        {status}
      </span>
    </div>
  );
}
