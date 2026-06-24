"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckin, useSettings, useUpsertCheckin } from "@/lib/queries";
import { dayIndex, todayKey, greeting } from "@/lib/date";
import type { Capacity } from "@/lib/types";
import { Button } from "@/components/ui";

const MENTAL = [
  { v: 1, emoji: "😞", color: "#f87171", label: "Rough" },
  { v: 2, emoji: "😕", color: "#fb923c", label: "Low" },
  { v: 3, emoji: "😐", color: "#fbbf24", label: "Okay" },
  { v: 4, emoji: "🙂", color: "#7faf97", label: "Good" },
  { v: 5, emoji: "😄", color: "#5b8a72", label: "Great" },
];

const CAPACITIES: { v: Capacity; title: string; sub: string; emoji: string }[] = [
  { v: "light", title: "Light day", sub: "Gentle, low pressure", emoji: "🌱" },
  { v: "medium", title: "Medium day", sub: "A steady, balanced day", emoji: "☀️" },
  { v: "big", title: "Big day", sub: "Ready to take things on", emoji: "🚀" },
];

function ScaleRow({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex justify-between gap-2">
      {MENTAL.map((m) => {
        const active = value === m.v;
        return (
          <button
            key={m.v}
            type="button"
            onClick={() => onChange(m.v)}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3 transition-all"
            style={{
              borderColor: active ? m.color : "var(--border)",
              background: active ? m.color + "22" : "var(--surface)",
              transform: active ? "scale(1.05)" : "scale(1)",
            }}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[11px] text-[var(--muted)]">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Choice({
  options,
  value,
  onChange,
  color,
}: {
  options: { v: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="rounded-full px-4 py-2 text-sm font-medium transition-all"
            style={{ background: active ? color : color + "1a", color: active ? "#fff" : color }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CheckinPage() {
  const router = useRouter();
  const today = todayKey();
  const { data: settings } = useSettings();
  const { data: existing } = useCheckin(today);
  const upsert = useUpsertCheckin();

  const di = dayIndex(today);
  const isGym = settings?.weeklySchedule.gym.includes(di as never) ?? false;
  const isTennis = settings?.weeklySchedule.tennis.includes(di as never) ?? false;

  const [mental, setMental] = useState<number | undefined>(existing?.mental);
  const [uni, setUni] = useState<number | undefined>(existing?.uni_readiness);
  const [capacity, setCapacity] = useState<Capacity | undefined>(existing?.capacity);
  const [note, setNote] = useState<string>((existing?.extra?.note as string) ?? "");
  const [extra, setExtra] = useState<Record<string, unknown>>(existing?.extra ?? {});

  const accent = "#5b8a72";

  const steps = useMemo(() => {
    const s = ["mental", "uni", "capacity"];
    if (isGym) s.push("gym");
    if (isTennis) s.push("tennis");
    return s;
  }, [isGym, isTennis]);

  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function canAdvance() {
    if (current === "mental") return mental !== undefined;
    if (current === "uni") return uni !== undefined;
    if (current === "capacity") return capacity !== undefined;
    return true;
  }

  function save() {
    if (mental === undefined || uni === undefined || capacity === undefined) return;
    upsert.mutate(
      {
        date: today,
        mental,
        uni_readiness: uni,
        capacity,
        note: note || undefined,
        extra: { ...extra, note },
      },
      { onSuccess: () => router.push("/") },
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-[var(--muted)]">{greeting(settings?.greetingName ?? "")}</p>
        <h1 className="text-2xl font-bold">A quick check-in</h1>
        <p className="text-sm text-[var(--muted)]">Takes about 30 seconds. No wrong answers.</p>
      </header>

      {/* progress dots */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? accent : "var(--border)" }}
          />
        ))}
      </div>

      <div key={current} className="card animate-fade-slide space-y-4 p-5">
        {current === "mental" && (
          <>
            <h2 className="text-lg font-semibold">How are you feeling mentally today?</h2>
            <ScaleRow value={mental} onChange={setMental} />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One word, if you like (optional)"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </>
        )}

        {current === "uni" && (
          <>
            <h2 className="text-lg font-semibold">How ready do you feel for uni work?</h2>
            <ScaleRow value={uni} onChange={setUni} />
          </>
        )}

        {current === "capacity" && (
          <>
            <h2 className="text-lg font-semibold">How much can you take on today?</h2>
            <div className="space-y-2">
              {CAPACITIES.map((c) => {
                const active = capacity === c.v;
                return (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCapacity(c.v)}
                    className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all"
                    style={{
                      borderColor: active ? accent : "var(--border)",
                      background: active ? accent + "14" : "var(--surface)",
                    }}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <span>
                      <span className="block font-semibold">{c.title}</span>
                      <span className="block text-sm text-[var(--muted)]">{c.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {current === "gym" && (
          <>
            <h2 className="text-lg font-semibold">How&apos;s your body — soreness / energy?</h2>
            <ScaleRow
              value={extra.gym_body as number | undefined}
              onChange={(v) => setExtra((e) => ({ ...e, gym_body: v }))}
            />
            <p className="pt-1 text-sm font-medium">What&apos;s the plan?</p>
            <Choice
              color={accent}
              value={extra.gym_plan as string | undefined}
              onChange={(v) => setExtra((e) => ({ ...e, gym_plan: v }))}
              options={[
                { v: "push", label: "Push" },
                { v: "maintain", label: "Maintain" },
                { v: "recover", label: "Recover" },
              ]}
            />
          </>
        )}

        {current === "tennis" && (
          <>
            <h2 className="text-lg font-semibold">How are you feeling about hitting today?</h2>
            <ScaleRow
              value={extra.tennis_feel as number | undefined}
              onChange={(v) => setExtra((e) => ({ ...e, tennis_feel: v }))}
            />
            <p className="pt-1 text-sm font-medium">Focus?</p>
            <Choice
              color={accent}
              value={extra.tennis_focus as string | undefined}
              onChange={(v) => setExtra((e) => ({ ...e, tennis_focus: v }))}
              options={[
                { v: "match", label: "Match play" },
                { v: "drills", label: "Drills" },
                { v: "serve", label: "Serve" },
                { v: "light", label: "Light" },
              ]}
            />
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/")}>
          Skip for today
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="soft" color={accent} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {!isLast ? (
            <Button
              variant="primary"
              color={accent}
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button variant="primary" color={accent} disabled={!canAdvance()} onClick={save}>
              Done ✓
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
