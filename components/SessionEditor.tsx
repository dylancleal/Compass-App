"use client";

import { useState } from "react";
import { sessionTypesFor } from "@/lib/sessionTypes";

// Compact inline editor for a logged session's actual type + duration. Purely
// presentational — the parent decides what to do with the patch on save.
export default function SessionEditor({
  categoryName,
  initialType,
  initialDuration,
  accent,
  onSave,
  onCancel,
}: {
  categoryName: string;
  initialType: string;
  initialDuration?: number;
  accent: string;
  onSave: (patch: { type: string; duration_minutes?: number }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(initialType);
  const [duration, setDuration] = useState(
    initialDuration != null ? String(initialDuration) : "",
  );

  const base = sessionTypesFor(categoryName);
  // Keep the current type visible even if it isn't in the curated list (e.g. "Session").
  const options = base.includes(type) ? base : [type, ...base];

  return (
    <div className="space-y-2.5">
      <div>
        <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 hover:opacity-100"
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
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[var(--muted)]">Duration</span>
        <input
          type="number"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="min"
          className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        />
        <span className="text-xs text-[var(--muted)]">min</span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onCancel}
            className="rounded-lg px-2.5 py-1 text-xs text-[var(--muted)] hover:opacity-100"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({ type, duration_minutes: duration ? Number(duration) : undefined })
            }
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
            style={{ background: accent }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
