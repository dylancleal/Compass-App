"use client";

import { useState } from "react";
import Link from "next/link";
import { useCategories, useTasks } from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { taskProgress, openTasks } from "@/lib/stats";
import { ProgressRing } from "@/components/ui";
import { detectDomain, isSetupComplete } from "@/lib/categorySetup";
import CategorySetupSheet from "@/components/CategorySetupSheet";
import { useStartCheckout, useSwitchActiveCategory } from "@/lib/subscription";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: tasks = [] } = useTasks();
  const [setupCat, setSetupCat] = useState<Category | null>(null);
  const { switchTo } = useSwitchActiveCategory();
  const startCheckout = useStartCheckout();
  const pausedCats = categories.filter((c) => c.metadata?.paused_reason === "downgrade");
  const currentActive = categories.find((c) => c.active);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Your areas</h1>
        <p className="text-sm text-[var(--muted)]">A calm overview of everything you care about.</p>
      </header>

      {isLoading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {categories
          .filter((c) => c.active)
          .map((cat) => {
            const accent = accentOf(cat.color);
            const catTasks = tasks.filter((t) => t.category_id === cat.id);
            const { done, total, ratio } = taskProgress(catTasks);
            const open = openTasks(catTasks).length;
            const domain = detectDomain(cat.name);
            const setupDone = isSetupComplete(cat.metadata, domain);
            return (
              <div key={cat.id} className="relative">
                <Link
                  href={`/categories/${cat.id}`}
                  className="card animate-pop flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5"
                  style={{ background: accent.soft }}
                >
                  <ProgressRing value={total ? ratio : 0} color={accent.accent} size={56}>
                    <span className="text-base">{cat.icon}</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: accent.text }}>
                      {cat.name}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {total === 0
                        ? "No tasks yet"
                        : open === 0
                          ? `All ${total} done — lovely`
                          : `${open} open · ${done} done`}
                    </p>
                  </div>
                </Link>
                {!setupDone && (
                  <button
                    onClick={() => setSetupCat(cat)}
                    className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:scale-105"
                    style={{ background: accent.soft, color: accent.text, border: `1px solid ${accent.accent}55` }}
                  >
                    Set up →
                  </button>
                )}
                {domain === "uni" && (
                  <Link
                    href="/uni"
                    className="absolute bottom-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:scale-105"
                    style={{ background: accent.soft, color: accent.text, border: `1px solid ${accent.accent}55` }}
                  >
                    deadlines →
                  </Link>
                )}
              </div>
            );
          })}
      </div>

      {pausedCats.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Paused areas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pausedCats.map((cat) => (
              <div
                key={cat.id}
                className="card flex items-center gap-3 p-4 opacity-70"
                style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg" style={{ background: "var(--background)" }}>
                  {cat.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{cat.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Paused — upgrade to use both areas, or switch to this one for free.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => switchTo(cat, currentActive)}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      Switch to this area
                    </button>
                    <button
                      onClick={() => startCheckout.mutate()}
                      disabled={startCheckout.isPending}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {setupCat && (
        <CategorySetupSheet
          category={setupCat}
          mode="sheet"
          onSave={() => setSetupCat(null)}
          onSkip={() => setSetupCat(null)}
        />
      )}

      <Link href="/settings" className="block text-center text-sm text-[var(--muted)] underline transition-all duration-150 hover:text-[var(--foreground)] hover:scale-105">
        Add or edit areas in Settings
      </Link>
    </div>
  );
}
