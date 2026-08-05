"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useCategories,
  useCreateCategory,
  useSaveSettings,
  useSessionTemplates,
  useSettings,
  useTasks,
  queryKeys,
} from "@/lib/queries";
import { accentOf, PALETTE_KEYS } from "@/lib/palette";
import CategorySetupSheet from "@/components/CategorySetupSheet";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import { buildWeekPreview } from "@/lib/preview";
import { APP_VARIANT } from "@/lib/appVariant";
import type { AppSettings, Category, CategoryMetadata, SessionTemplate, Task } from "@/lib/types";

// ── Curated starter tiles ─────────────────────────────────────────────────────

const TILES = [
  { name: "Gym", icon: "💪", color: "green", desc: "Strength & fitness" },
  { name: "Tennis", icon: "🎾", color: "teal", desc: "Court time & skill" },
  { name: "Uni work", icon: "📚", color: "blue", desc: "Study & assignments" },
  { name: "Work", icon: "💼", color: "slate", desc: "Career & projects" },
  { name: "Finances", icon: "💰", color: "amber", desc: "Savings & budgeting" },
  { name: "Job searching", icon: "🔍", color: "indigo", desc: "Applications & networking" },
  { name: "Running", icon: "🏃", color: "rose", desc: "Running & endurance" },
  { name: "Swimming", icon: "🏊", color: "teal", desc: "Pool & open water" },
  { name: "Social", icon: "👥", color: "violet", desc: "Friends & family" },
  { name: "Reading", icon: "📖", color: "amber", desc: "Books & knowledge" },
  { name: "Sleep", icon: "😴", color: "indigo", desc: "Rest & recovery" },
] as const;

type TileName = (typeof TILES)[number]["name"];

// A narrowed variant (e.g. the study+gym commercial build) only shows a subset
// of tiles here; TILES itself stays the full canonical list since handlePick
// still matches selected names against it to build categories.
const VISIBLE_TILES = APP_VARIANT.onboardingTiles
  ? TILES.filter((t) => APP_VARIANT.onboardingTiles!.includes(t.name))
  : TILES;

// ── Step 1 — Category picker ──────────────────────────────────────────────────

function StepPick({
  onNext,
  pending,
}: {
  onNext: (selected: TileName[], customName?: string) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<Set<TileName>>(new Set());
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  function toggle(name: TileName) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const anySelected = selected.size > 0 || (showCustom && customName.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">What do you want to work on?</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Pick the areas that matter to you — you can add more later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VISIBLE_TILES.map((tile) => {
          const accent = accentOf(tile.color);
          const active = selected.has(tile.name);
          return (
            <button
              key={tile.name}
              onClick={() => toggle(tile.name)}
              className="flex flex-col items-start gap-1.5 rounded-2xl p-3.5 text-left transition-all hover:scale-[1.02]"
              style={{
                background: active ? accent.soft : "var(--surface)",
                border: active ? `2px solid ${accent.accent}` : "2px solid var(--border)",
              }}
            >
              <span className="text-2xl">{tile.icon}</span>
              <p className="text-sm font-semibold" style={{ color: active ? accent.text : "var(--foreground)" }}>
                {tile.name}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {tile.desc}
              </p>
            </button>
          );
        })}

        {/* Custom tile */}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="flex flex-col items-start gap-1.5 rounded-2xl p-3.5 text-left transition-all hover:scale-[1.02]"
          style={{
            background: showCustom ? "var(--info-soft)" : "var(--surface)",
            border: showCustom ? "2px solid var(--info-text)" : "2px solid var(--border)",
          }}
        >
          <span className="text-2xl">✨</span>
          <p className="text-sm font-semibold">Something else</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Custom area</p>
        </button>
      </div>

      {showCustom && (
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g. Rock climbing, Cooking, Guitar…"
          className="w-full rounded-xl border px-3 py-2.5 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          autoFocus
        />
      )}

      <button
        onClick={() =>
          onNext([...selected] as TileName[], showCustom && customName.trim() ? customName.trim() : undefined)
        }
        disabled={!anySelected || pending}
        className="btn-life w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--primary)", color: "var(--on-primary)" }}
      >
        {pending ? "Setting up…" : "Continue →"}
      </button>
    </div>
  );
}

// ── Step 2 — Per-category setup ───────────────────────────────────────────────

function StepSetup({
  categories,
  currentIndex,
  total,
  onNext,
  onSkip,
  onBack,
}: {
  categories: Category[];
  currentIndex: number;
  total: number;
  onNext: (meta: CategoryMetadata) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const cat = categories[currentIndex];
  if (!cat) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--muted)" }}
        >
          ← Back
        </button>
        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {currentIndex + 1} of {total}
        </p>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-6 rounded-full"
              style={{ background: i <= currentIndex ? "var(--primary)" : "var(--border)" }}
            />
          ))}
        </div>
      </div>
      <CategorySetupSheet
        key={cat.id}
        category={cat}
        mode="inline"
        onSave={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

// ── Step 3 — 7-day preview ────────────────────────────────────────────────────

function StepPreview({
  categories,
  library,
  settings,
  tasks,
  onFinish,
  onBack,
  finishing,
}: {
  categories: Category[];
  library: SessionTemplate[];
  settings: AppSettings;
  tasks: Task[];
  onFinish: () => void;
  onBack: () => void;
  finishing: boolean;
}) {
  const preview = useMemo(
    () =>
      buildWeekPreview({
        categories,
        tasks,
        sessions: [],
        settings,
        calendarBlocks: [],
        library,
      }),
    // stable deps — categories/settings won't change during preview display
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <button
          onClick={onBack}
          className="mb-1 text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--muted)" }}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold">Here&apos;s what your next 7 days could look like</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This adapts as you log sessions — the more you track, the more personal it gets.
        </p>
      </div>

      <div className="space-y-2">
        {preview.map((day, i) => (
          <div
            key={day.date}
            className="card animate-fade-slide p-3.5"
            style={{ borderLeft: "3px solid var(--primary)", animationDelay: `${i * 55}ms` }}
          >
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
              {day.weekdayLabel}
            </p>
            {day.items.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Breathing room — nothing scheduled.
              </p>
            ) : (
              <div className="space-y-1">
                {day.items.slice(0, 2).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.headline}</span>
                    <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
                      ~{item.estMin} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        disabled={finishing}
        className="btn-life w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--primary)", color: "var(--on-primary)" }}
      >
        {finishing ? "Starting…" : "Start day 1 →"}
      </button>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

type Step = "pick" | "setup" | "preview";

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: existingCategories = [], data: allCategories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const createCategory = useCreateCategory();
  const saveSettings = useSaveSettings();
  const { data: settings } = useSettings();

  const [step, setStep] = useState<Step>("pick");
  const [createdCategories, setCreatedCategories] = useState<Category[]>([]);
  const [setupIndex, setSetupIndex] = useState(0);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Populated when a category genuinely fails to create (network/auth/RLS,
  // not just an expected duplicate from a seeding race) — previously a bare
  // catch{} swallowed every failure identically, so a real error left an
  // area silently missing with no signal at all.
  const [createErrors, setCreateErrors] = useState<string[]>([]);

  async function handlePick(selected: TileName[], customName?: string) {
    setPicking(true);
    setCreateErrors([]);
    // Refetch first — ensureSeeded() may have just created some of these
    // categories in the background, and the cached existingCategories prop
    // can still be stale at this exact moment, which previously let this
    // create duplicate rows for anything seeding got to first.
    await qc.refetchQueries({ queryKey: queryKeys.categories });
    const existingNames = new Set(
      (qc.getQueryData<Category[]>(queryKeys.categories) ?? existingCategories).map((c) => c.name),
    );
    const toCreate = [
      ...TILES.filter((t) => selected.includes(t.name) && !existingNames.has(t.name)),
      ...(customName && !existingNames.has(customName)
        ? [{ name: customName, icon: "✨", color: "slate" }]
        : []),
    ];

    const failed: string[] = [];
    for (const tile of toCreate) {
      try {
        await new Promise<Category>((resolve, reject) => {
          createCategory.mutate(
            { name: tile.name, icon: tile.icon, color: tile.color, active: true },
            { onSuccess: resolve, onError: reject },
          );
        });
      } catch {
        failed.push(tile.name);
      }
    }
    setCreateErrors(failed);

    // Refetch after mutations to get the definitive list — handles races between
    // ensureSeeded() and these mutations (both may try to create the same category).
    await qc.refetchQueries({ queryKey: queryKeys.categories });
    const fresh = (qc.getQueryData<Category[]>(queryKeys.categories) ?? []);
    const selectedNames = new Set([
      ...selected,
      ...(customName ? [customName as TileName] : []),
    ]);
    // Dedup by name — DB may have duplicates if seeding raced with mutations.
    const seen = new Set<string>();
    const allForSetup = fresh.filter((c) => {
      if (!selectedNames.has(c.name as TileName)) return false;
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    setCreatedCategories(allForSetup);
    setPicking(false);
    if (allForSetup.length === 0) {
      // Nothing to walk through (e.g. every selected tile already existed
      // from seeding) — skip straight to the preview.
      setStep("preview");
    } else {
      setSetupIndex(0);
      setStep("setup");
    }
  }

  async function handleSetupNext() {
    const next = setupIndex + 1;
    if (next < createdCategories.length) {
      setSetupIndex(next);
    } else {
      // Refresh categories so the preview gets the metadata saved during setup
      // (weekly_goal, tennis_weekly_goal, etc.) — createdCategories was set
      // before any setup mutations ran and doesn't have the updated values.
      await qc.refetchQueries({ queryKey: queryKeys.categories });
      const fresh = qc.getQueryData<Category[]>(queryKeys.categories) ?? [];
      const ids = new Set(createdCategories.map((c) => c.id));
      setCreatedCategories(fresh.filter((c) => ids.has(c.id)));
      setStep("preview");
    }
  }

  function handleSetupBack() {
    if (setupIndex > 0) setSetupIndex((i) => i - 1);
    else setStep("pick");
  }

  function handlePreviewBack() {
    if (createdCategories.length > 0) {
      setSetupIndex(createdCategories.length - 1);
      setStep("setup");
    } else {
      setStep("pick");
    }
  }

  // Persist the "onboarding done" flag, then run a follow-up navigation. Kept as
  // an awaited mutation (not a fire-and-forget alongside an <a href>) so the flag
  // is written before we leave — otherwise a user who heads off to connect a
  // calendar can bounce back into onboarding on return.
  async function completeOnboarding(next: string) {
    await new Promise<void>((resolve) => {
      saveSettings.mutate(
        { onboarding_completed_at: new Date().toISOString() },
        { onSuccess: () => resolve(), onError: () => resolve() },
      );
    });
    router.push(next);
  }

  function handleFinish() {
    setFinishing(true);
    return completeOnboarding("/checkin");
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          {APP_VARIANT.logoStyle === "classic" && (
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-base"
              style={{ background: "var(--primary-soft)" }}
            >
              🧭
            </span>
          )}
          <span
            className="font-bold tracking-tight"
            style={
              APP_VARIANT.logoStyle === "glow"
                ? {
                    textShadow:
                      "0 0 14px color-mix(in srgb, var(--primary-mid) 60%, transparent), 0 0 30px color-mix(in srgb, var(--accent) 32%, transparent)",
                  }
                : undefined
            }
          >
            {APP_VARIANT.name}
          </span>
        </div>

        {createErrors.length > 0 && (
          <div
            className="mb-4 rounded-xl p-3 text-xs"
            style={{ background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            Couldn&apos;t create: {createErrors.join(", ")} — you can add{" "}
            {createErrors.length === 1 ? "it" : "these"} anytime in Settings.
          </div>
        )}

        {step === "pick" && <StepPick onNext={handlePick} pending={picking} />}

        {step === "setup" && createdCategories.length > 0 && (
          <StepSetup
            categories={createdCategories}
            currentIndex={setupIndex}
            total={createdCategories.length}
            onNext={handleSetupNext}
            onSkip={handleSetupNext}
            onBack={handleSetupBack}
          />
        )}

        {step === "preview" && settings && (
          <StepPreview
            categories={createdCategories}
            library={library}
            settings={settings}
            tasks={tasks}
            onFinish={handleFinish}
            onBack={handlePreviewBack}
            finishing={finishing}
          />
        )}
      </div>
    </div>
  );
}
