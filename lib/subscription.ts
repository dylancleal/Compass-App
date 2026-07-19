"use client";

// Subscription/access-level logic for Lodestone (the "study" variant only —
// Compass is never gated). Mirrors the shape of lib/suggestionActions.ts and
// lib/planGeneration.ts: a pure derivation function plus hooks that wrap
// lib/queries.ts reads, so every gated call site shares one source of truth
// instead of scattering date-math/status checks around the codebase.

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { APP_VARIANT } from "@/lib/appVariant";
import { getSupabase } from "@/lib/supabaseClient";
import {
  useCategories,
  useSessions,
  useSettings,
  useSaveSettings,
  useUpdateCategory,
} from "@/lib/queries";
import type { AppSettings, Category, Session } from "@/lib/types";

export type AccessLevel = "trial" | "paid" | "free" | "past_due";

// Compass (personal variant) always resolves to "paid" — this is the single
// choke point that keeps Compass's UI byte-for-byte unaffected by any of
// this; no other call site needs its own APP_VARIANT check.
//
// NEXT_PUBLIC_DISABLE_PAYWALL is a temporary, reversible kill-switch for
// early friend-testing before Stripe is live — set it on the Lodestone
// Vercel project and everyone gets full access regardless of trial/sub
// status. No per-user data is touched; unset it later and real access
// levels apply immediately on next load.
export function getAccessLevel(
  settings:
    | Pick<AppSettings, "trial_ends_at" | "stripe_subscription_status" | "revenuecat_expires_at">
    | undefined
    | null,
  now: Date = new Date(),
): AccessLevel {
  if (process.env.NEXT_PUBLIC_DISABLE_PAYWALL === "true") return "paid";
  if (APP_VARIANT.id !== "study") return "paid";
  if (!settings) return "paid"; // permissive while loading — a flash of full access beats a flash of the free UI for a paying user
  // Native (RevenueCat) purchases are checked first and independently of
  // Stripe — a user with an active Play Store subscription is "paid" even
  // if their (separate) web/Stripe status says otherwise, and vice versa.
  if (settings.revenuecat_expires_at && new Date(settings.revenuecat_expires_at) > now) return "paid";
  const status = settings.stripe_subscription_status;
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "active" || status === "trialing") return "paid";
  if (settings.trial_ends_at && new Date(settings.trial_ends_at) > now) return "trial";
  return "free";
}

// past_due keeps full access — Stripe's own dunning retries act as the
// grace period, so there's no separate grace-period timer to maintain here.
export function hasFullAccess(level: AccessLevel): boolean {
  return level !== "free";
}

export function useAccessLevel(): AccessLevel {
  const { data: settings } = useSettings();
  return getAccessLevel(settings);
}

export function canActivateCategory(categories: Pick<Category, "active">[], level: AccessLevel): boolean {
  if (hasFullAccess(level)) return true;
  return categories.filter((c) => c.active).length === 0;
}

// Most-recently-active category wins; ties broken by category.order (lower
// = created first). Falls back to the first category if nobody has ever
// logged a session yet.
function pickKeeper(categories: Category[], sessions: Session[]): Category {
  const lastSessionAt = new Map<string, string>();
  for (const s of sessions) {
    if (!s.category_id) continue;
    const prev = lastSessionAt.get(s.category_id);
    if (!prev || s.date > prev) lastSessionAt.set(s.category_id, s.date);
  }
  const sorted = [...categories].sort((a, b) => {
    const da = lastSessionAt.get(a.id);
    const db_ = lastSessionAt.get(b.id);
    if (da && db_) return da > db_ ? -1 : 1;
    if (da) return -1;
    if (db_) return 1;
    return a.order - b.order;
  });
  return sorted[0];
}

// Runs on every load (mounted once in AuthGate). Idempotent: no-ops once at
// most one category is active. Never deletes anything — pauses via the same
// `active` flag every other part of the app already filters on, tagged with
// metadata.paused_reason so it's distinguishable from a future manual-archive
// feature.
export function useApplyFreeDowngrade() {
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();
  const { data: sessions = [] } = useSessions();
  const updateCategory = useUpdateCategory();
  const saveSettings = useSaveSettings();
  const level = getAccessLevel(settings);

  useEffect(() => {
    if (level !== "free") return;
    const active = categories.filter((c) => c.active);
    if (active.length <= 1) return;
    const keeper = pickKeeper(active, sessions);
    for (const cat of active) {
      if (cat.id === keeper.id) continue;
      updateCategory.mutate({
        id: cat.id,
        patch: { active: false, metadata: { ...cat.metadata, paused_reason: "downgrade" } },
      });
    }
    saveSettings.mutate({ downgraded_at: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, categories.map((c) => `${c.id}:${c.active}`).join(), sessions.length]);
}

// Symmetric to useApplyFreeDowngrade: once full access returns (upgrade or
// a fresh trial), any category paused specifically by the downgrade
// mechanism reactivates automatically — no manual re-setup after paying.
export function useReactivateOnUpgrade() {
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();
  const updateCategory = useUpdateCategory();
  const level = getAccessLevel(settings);

  useEffect(() => {
    if (!hasFullAccess(level)) return;
    const paused = categories.filter((c) => c.metadata?.paused_reason === "downgrade");
    for (const cat of paused) {
      const { paused_reason: _drop, ...restMeta } = cat.metadata ?? {};
      updateCategory.mutate({ id: cat.id, patch: { active: true, metadata: restMeta } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, categories.map((c) => `${c.id}:${c.metadata?.paused_reason}`).join()]);
}

// Free-tier users can still switch WHICH single area is active — that costs
// nothing; having two simultaneously is what's actually gated.
export function useSwitchActiveCategory() {
  const updateCategory = useUpdateCategory();
  return {
    switchTo: (target: Category, current?: Category) => {
      if (current && current.id !== target.id) {
        // Tag it the same way the downgrade mechanism does — otherwise it's
        // deactivated but invisible: not shown in "Paused areas", and never
        // picked up by useReactivateOnUpgrade later.
        updateCategory.mutate({
          id: current.id,
          patch: { active: false, metadata: { ...current.metadata, paused_reason: "downgrade" } },
        });
      }
      const { paused_reason: _drop, ...restMeta } = target.metadata ?? {};
      updateCategory.mutate({ id: target.id, patch: { active: true, metadata: restMeta } });
    },
  };
}

// Stubbed against /api/stripe/* routes that don't exist yet — the UI states
// (buttons, upgrade callouts) can be built and demoed now; the real fetch
// gets wired in once Stripe credentials exist.
export function useStartCheckout() {
  return useMutation({
    mutationFn: async () => {
      const token = (await getSupabase()!.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not start checkout");
      const { url } = await res.json();
      window.location.href = url;
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const token = (await getSupabase()!.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not open billing portal");
      const { url } = await res.json();
      window.location.href = url;
    },
  });
}
