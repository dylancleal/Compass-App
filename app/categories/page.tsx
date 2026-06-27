"use client";

import { useState } from "react";
import Link from "next/link";
import { useCategories, useTasks } from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import { taskProgress, openTasks } from "@/lib/stats";
import { ProgressRing } from "@/components/ui";
import { detectDomain, isSetupComplete } from "@/lib/categorySetup";
import CategorySetupSheet from "@/components/CategorySetupSheet";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: tasks = [] } = useTasks();
  const [setupCat, setSetupCat] = useState<Category | null>(null);

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
              </div>
            );
          })}
      </div>

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
