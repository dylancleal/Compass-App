"use client";

import { useState } from "react";
import Link from "next/link";
import { useCategories, useCheckin, useMetrics, useSettings } from "@/lib/queries";
import { greeting, prettyDate, todayKey } from "@/lib/date";
import { accentOf } from "@/lib/palette";
import type { Category } from "@/lib/types";
import Plan from "@/components/Plan";
import TaskList from "@/components/TaskList";
import LogSheet from "@/components/LogSheet";
import { GoalsOverview } from "@/components/GoalCard";

const MENTAL_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];
const CAP_LABEL: Record<string, string> = { light: "Light day", medium: "Medium day", big: "Big day" };

export default function TodayPage() {
  const today = todayKey();
  const { data: settings } = useSettings();
  const { data: checkin } = useCheckin(today);
  const { data: categories = [] } = useCategories();
  const { data: metrics = [] } = useMetrics();
  const [logCat, setLogCat] = useState<Category | null>(null);

  const activeCats = categories.filter((c) => c.active);

  return (
    <div className="space-y-7">
      <header className="space-y-0.5">
        <p className="text-sm text-[var(--muted)]">{prettyDate(today)}</p>
        <h1 className="text-2xl font-bold">{greeting(settings?.greetingName ?? "")}</h1>
      </header>

      {/* Check-in entry / summary */}
      {!checkin ? (
        <Link
          href="/checkin"
          className="card animate-pop block p-5"
          style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
        >
          <p className="text-lg font-semibold" style={{ color: "var(--primary)" }}>
            Ready for a quick check-in? 🌿
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tell me how today feels and I&apos;ll shape a gentle plan with you. ~30 seconds.
          </p>
        </Link>
      ) : (
        <div className="card flex items-center gap-4 p-4">
          <span className="text-3xl">{MENTAL_EMOJI[checkin.mental]}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{CAP_LABEL[checkin.capacity]}</p>
            <p className="text-sm text-[var(--muted)]">
              Mind {checkin.mental}/5 · Uni readiness {checkin.uni_readiness}/5
            </p>
          </div>
          <Link href="/checkin" className="text-xs text-[var(--muted)] underline">
            redo
          </Link>
        </div>
      )}

      {/* Personalised plan */}
      <Plan />

      {/* Weekly goals — glanceable here, tap through to Trends for detail */}
      {activeCats.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--muted)]">This week&apos;s goals</h2>
            <Link href="/trends" className="text-xs text-[var(--muted)] underline">
              details
            </Link>
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
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium"
                style={{ background: accent.soft, color: accent.text }}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick-tick tasks */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Quick-tick</h2>
          <Link href="/categories" className="text-xs text-[var(--muted)] underline">
            all areas
          </Link>
        </div>
        <TaskList
          accent="#5b8a72"
          showAdd={false}
          hideCompleted
          emptyText="No open tasks — beautifully clear. ✨"
        />
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
