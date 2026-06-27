"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCategories,
  useCreateCategory,
  useSaveSettings,
  useSettings,
} from "@/lib/queries";
import { accentOf, PALETTE_KEYS } from "@/lib/palette";
import CategorySetupSheet from "@/components/CategorySetupSheet";
import type { Category, CategoryMetadata } from "@/lib/types";

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

// ── Step 1 — Category picker ──────────────────────────────────────────────────

function StepPick({
  onNext,
}: {
  onNext: (selected: TileName[], customName?: string) => void;
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
        {TILES.map((tile) => {
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
            background: showCustom ? "#f0f4ff" : "var(--surface)",
            border: showCustom ? "2px solid #6a7ba8" : "2px solid var(--border)",
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
        disabled={!anySelected}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-105 disabled:opacity-40"
        style={{ background: "var(--primary)", color: "#fffdf9" }}
      >
        Continue →
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
}: {
  categories: Category[];
  currentIndex: number;
  total: number;
  onNext: (meta: CategoryMetadata) => void;
  onSkip: () => void;
}) {
  const cat = categories[currentIndex];
  if (!cat) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        category={cat}
        mode="inline"
        onSave={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

// ── Step 3 — Connect calendar ─────────────────────────────────────────────────

function StepCalendar({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Connect your calendar</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Compass reads your schedule so the planner never suggests the gym on a day you
          already booked a class, and surfaces deadline events automatically.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        {[
          { icon: "⚡", text: "Suggestions avoid your already-busy blocks" },
          { icon: "📌", text: "Assignment deadlines become task prompts" },
          { icon: "⚠", text: "Overlapping events flagged as conflicts" },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <a
        href="/calendar"
        className="block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all hover:brightness-105"
        style={{ background: "var(--primary)", color: "#fffdf9" }}
        onClick={onFinish}
      >
        Connect calendar →
      </a>

      <button
        onClick={onFinish}
        className="w-full py-2 text-sm"
        style={{ color: "var(--muted)" }}
      >
        Skip for now — I&apos;ll connect later
      </button>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

type Step = "pick" | "setup" | "calendar";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: existingCategories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const saveSettings = useSaveSettings();
  const { data: settings } = useSettings();

  const [step, setStep] = useState<Step>("pick");
  const [createdCategories, setCreatedCategories] = useState<Category[]>([]);
  const [setupIndex, setSetupIndex] = useState(0);

  async function handlePick(selected: TileName[], customName?: string) {
    // Create categories that don't already exist
    const existingNames = new Set(existingCategories.map((c) => c.name));
    const toCreate = [
      ...TILES.filter((t) => selected.includes(t.name) && !existingNames.has(t.name)),
      ...(customName && !existingNames.has(customName)
        ? [{ name: customName, icon: "✨", color: "slate" }]
        : []),
    ];

    const created: Category[] = [];
    for (const tile of toCreate) {
      try {
        const cat = await new Promise<Category>((resolve, reject) => {
          createCategory.mutate(
            { name: tile.name, icon: tile.icon, color: tile.color, active: true },
            { onSuccess: resolve, onError: reject },
          );
        });
        created.push(cat);
      } catch {
        // continue — don't block onboarding on a single category failure
      }
    }

    // Also include existing categories that were selected (they still need setup)
    const existingSelected = existingCategories.filter((c) =>
      selected.includes(c.name as TileName),
    );
    const allForSetup = [...existingSelected, ...created];

    setCreatedCategories(allForSetup);
    setSetupIndex(0);
    setStep("setup");
  }

  function handleSetupNext() {
    const next = setupIndex + 1;
    if (next < createdCategories.length) {
      setSetupIndex(next);
    } else {
      setStep("calendar");
    }
  }

  async function handleFinish() {
    await new Promise<void>((resolve) => {
      saveSettings.mutate(
        { onboarding_completed_at: new Date().toISOString() },
        { onSuccess: () => resolve(), onError: () => resolve() },
      );
    });
    router.push("/checkin");
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-base"
            style={{ background: "var(--primary-soft)" }}
          >
            🧭
          </span>
          <span className="font-bold tracking-tight">Compass</span>
        </div>

        {step === "pick" && <StepPick onNext={handlePick} />}

        {step === "setup" && createdCategories.length > 0 && (
          <StepSetup
            categories={createdCategories}
            currentIndex={setupIndex}
            total={createdCategories.length}
            onNext={handleSetupNext}
            onSkip={handleSetupNext}
          />
        )}

        {step === "setup" && createdCategories.length === 0 && (
          // Nothing to set up — skip straight to calendar
          <StepCalendar onFinish={handleFinish} />
        )}

        {step === "calendar" && <StepCalendar onFinish={handleFinish} />}
      </div>
    </div>
  );
}
