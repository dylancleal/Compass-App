"use client";

import { useState } from "react";
import { useUpdateCategory } from "@/lib/queries";
import { detectDomain, getSetupFields } from "@/lib/categorySetup";
import type { Category, CategoryMetadata } from "@/lib/types";

interface Props {
  category: Category;
  /** inline = embedded in onboarding flow; sheet = bottom sheet overlay */
  mode?: "inline" | "sheet";
  onSave?: (meta: CategoryMetadata) => void;
  onSkip?: () => void;
}

export default function CategorySetupSheet({
  category,
  mode = "sheet",
  onSave,
  onSkip,
}: Props) {
  const domain = detectDomain(category.name);
  const fields = getSetupFields(domain, category.name);
  const [meta, setMeta] = useState<CategoryMetadata>(category.metadata ?? {});
  const [tagInput, setTagInput] = useState("");
  const update = useUpdateCategory();

  function setField(key: keyof CategoryMetadata, value: unknown) {
    setMeta((prev) => ({ ...prev, [key]: value }));
  }

  function addTag(key: keyof CategoryMetadata) {
    const val = tagInput.trim();
    if (!val) return;
    const existing = (meta[key] as string[] | undefined) ?? [];
    if (!existing.includes(val)) setField(key, [...existing, val]);
    setTagInput("");
  }

  function removeTag(key: keyof CategoryMetadata, tag: string) {
    const existing = (meta[key] as string[] | undefined) ?? [];
    setField(key, existing.filter((t) => t !== tag));
  }

  function handleSave() {
    update.mutate(
      { id: category.id, patch: { metadata: meta } },
      { onSuccess: () => onSave?.(meta) },
    );
  }

  const content = (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-bold">
          {category.icon} Set up {category.name}
        </p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
          A few quick questions so suggestions feel tailored to you, not generic.
        </p>
      </div>

      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <label className="block text-sm font-semibold">
            {field.label}
            {field.optional && (
              <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--muted)" }}>
                optional
              </span>
            )}
          </label>

          {field.hint && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {field.hint}
            </p>
          )}

          {field.type === "pills" && field.options && (
            <div className="flex flex-wrap gap-2">
              {field.options.map((opt) => {
                const active = meta[field.key] === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => setField(field.key, active ? undefined : opt.value)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:scale-[1.03]"
                    style={{
                      background: active ? "var(--primary)" : "var(--surface)",
                      color: active ? "#fffdf9" : "var(--foreground)",
                      border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {field.type === "number" && (
            <input
              type="number"
              value={(meta[field.key] as number | undefined) ?? ""}
              onChange={(e) =>
                setField(field.key, e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder={field.placeholder}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            />
          )}

          {field.type === "text" && (
            <input
              type="text"
              value={(meta[field.key] as string | undefined) ?? ""}
              onChange={(e) => setField(field.key, e.target.value || undefined)}
              placeholder={field.placeholder}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            />
          )}

          {field.type === "textarea" && (
            <textarea
              value={(meta[field.key] as string | undefined) ?? ""}
              onChange={(e) => setField(field.key, e.target.value || undefined)}
              placeholder={field.placeholder}
              rows={3}
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            />
          )}

          {field.type === "tags" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(field.key);
                    }
                  }}
                  placeholder={field.placeholder}
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                />
                <button
                  onClick={() => addTag(field.key)}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {((meta[field.key] as string[] | undefined) ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(field.key, tag)}
                      className="opacity-60 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        {onSkip && (
          <button
            onClick={onSkip}
            className="flex-1 rounded-xl py-2.5 text-sm"
            style={{ color: "var(--muted)" }}
          >
            Skip for now
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-105"
          style={{ background: "var(--primary)", color: "#fffdf9", opacity: update.isPending ? 0.7 : 1 }}
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  if (mode === "inline") return <div>{content}</div>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onSkip?.()}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl p-6 pb-safe"
        style={{ background: "var(--bg)", maxHeight: "90dvh", overflowY: "auto" }}
      >
        {content}
      </div>
    </div>
  );
}
