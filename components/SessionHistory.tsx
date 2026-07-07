"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";
import { useRemoveSession, useUpdateSession } from "@/lib/queries";
import { prettyDate, todayKey } from "@/lib/date";
import SessionEditor from "./SessionEditor";

// Recent logged sessions for one category, each editable (type + duration) or
// deletable — the general "fix what I actually did after the fact" surface.
export default function SessionHistory({
  sessions,
  categoryName,
  accent,
}: {
  sessions: Session[];
  categoryName: string;
  accent: string;
}) {
  const update = useUpdateSession();
  const remove = useRemoveSession();
  const [editing, setEditing] = useState<string | null>(null);

  const recent = [...sessions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created_at.localeCompare(a.created_at)))
    .slice(0, 12);

  if (recent.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No sessions logged yet.</p>;
  }

  const today = todayKey();

  return (
    <div className="space-y-2">
      {recent.map((s) => (
        <div key={s.id} className="card p-3">
          {editing === s.id ? (
            <SessionEditor
              categoryName={categoryName}
              initialType={s.type}
              initialDuration={s.duration_minutes}
              accent={accent}
              onCancel={() => setEditing(null)}
              onSave={(patch) => {
                update.mutate({ id: s.id, patch });
                setEditing(null);
              }}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.type}
                  {s.duration_minutes ? (
                    <span className="text-[var(--muted)]"> · {s.duration_minutes} min</span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {s.date === today ? "Today" : prettyDate(s.date)}
                </p>
              </div>
              <button
                onClick={() => setEditing(s.id)}
                className="text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 transition-colors hover:text-[var(--foreground)]"
              >
                edit
              </button>
              <button
                onClick={() => remove.mutate(s.id)}
                aria-label="Delete session"
                className="text-[var(--muted)] transition-all hover:scale-110 hover:text-[#c06b5a]"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
