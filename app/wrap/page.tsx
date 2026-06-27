"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckin, useUpsertCheckin } from "@/lib/queries";
import { todayKey } from "@/lib/date";
import { Button } from "@/components/ui";

const RATINGS = [
  { v: 3, emoji: "🌟", label: "Great", color: "#5b8a72" },
  { v: 2, emoji: "😌", label: "Okay",  color: "#7a9bb5" },
  { v: 1, emoji: "😕", label: "Rough", color: "#c06b5a" },
];

export default function WrapPage() {
  const router = useRouter();
  const today = todayKey();
  const { data: checkin } = useCheckin(today);
  const upsert = useUpsertCheckin();

  const existing = (checkin?.extra?.evening_rating as number | undefined);
  const [rating, setRating] = useState<number | undefined>(existing);
  const [note, setNote] = useState<string>(
    (checkin?.extra?.evening_note as string | undefined) ?? "",
  );

  function save() {
    if (!rating || !checkin) return;
    upsert.mutate(
      {
        date: today,
        mental: checkin.mental,
        uni_readiness: checkin.uni_readiness,
        capacity: checkin.capacity,
        note: checkin.note,
        extra: { ...checkin.extra, evening_rating: rating, evening_note: note || undefined },
      },
      { onSuccess: () => router.push("/") },
    );
  }

  function saveWithoutCheckin() {
    // No morning check-in — store minimal data so the wrap still works.
    upsert.mutate(
      {
        date: today,
        mental: 3,
        uni_readiness: 3,
        capacity: "medium",
        extra: { evening_rating: rating, evening_note: note || undefined },
      },
      { onSuccess: () => router.push("/") },
    );
  }

  const chosen = RATINGS.find((r) => r.v === rating);

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
          onClick={checkin ? save : saveWithoutCheckin}
        >
          Save & close →
        </Button>
      </div>
    </div>
  );
}
