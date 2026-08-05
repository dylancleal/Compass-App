"use client";

import { useState } from "react";
import IntroTour from "@/components/IntroTour";
import {
  useCategories,
  useCreateCategory,
  useRemoveCategory,
  useReorderCategories,
  useSaveSettings,
  useSettings,
  useUpdateCategory,
} from "@/lib/queries";
import { PALETTE, PALETTE_KEYS, accentOf } from "@/lib/palette";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { detectDomain } from "@/lib/categorySetup";
import type { Category, DayIndex } from "@/lib/types";
import { APP_VARIANT } from "@/lib/appVariant";
import {
  canActivateCategory,
  useAccessLevel,
  useDeleteAccount,
  useOpenBillingPortal,
  useStartCheckout,
} from "@/lib/subscription";
import { usePresentCustomerCenter, usePresentPaywall } from "@/lib/revenuecat";
import { Button } from "@/components/ui";
import ConnectionsPanel from "@/components/calendar/ConnectionsPanel";
import UpgradeCallout from "@/components/UpgradeCallout";
import ThemeToggle from "@/components/ThemeToggle";
import { pushSupported, useDisablePush, useEnablePush, usePushSubscribed } from "@/lib/pushNotifications";
import { useDisableNativePush, useEnableNativePush, useNativePushSubscribed } from "@/lib/nativePush";
import { useIsNativePlatform } from "@/lib/platform";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// weeklySchedule only has slots for these three domains (see lib/planner.ts's
// SCHEDULED map and app/checkin/page.tsx) — a category outside them has no
// schedule row at all, which is a real gap but a schema change, not a UI fix.
// detectDomain's "uni" label maps onto the schedule/settings schema's "study"
// key — the two vocabularies don't match 1:1, so this pairs them explicitly.
const SCHEDULE_SLOTS: { schedKey: "gym" | "tennis" | "study"; domain: ReturnType<typeof detectDomain> }[] = [
  { schedKey: "study", domain: "uni" },
  { schedKey: "gym", domain: "gym" },
  { schedKey: "tennis", domain: "tennis" },
];
const WEIGHTS: { key: "neglect" | "readiness" | "deadline" | "balance"; label: string; hint: string }[] = [
  { key: "deadline", label: "Deadline urgency", hint: "Prioritise approaching due dates" },
  { key: "neglect", label: "Neglected areas", hint: "Nudge areas you haven't touched lately" },
  { key: "readiness", label: "Readiness", hint: "Lean into how ready you feel today" },
  { key: "balance", label: "Balance", hint: "Spread suggestions across areas" },
];

export default function SettingsPage() {
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const removeCat = useRemoveCategory();
  const reorder = useReorderCategories();
  const saveSettings = useSaveSettings();
  const accessLevel = useAccessLevel();
  const startCheckout = useStartCheckout();
  const openBillingPortal = useOpenBillingPortal();
  const presentPaywall = usePresentPaywall();
  const presentCustomerCenter = usePresentCustomerCenter();
  const [nativeBillingPending, setNativeBillingPending] = useState(false);
  const [nativeBillingError, setNativeBillingError] = useState("");
  const { subscribed: pushSubscribed, refresh: refreshPushSubscribed } = usePushSubscribed();
  const enablePush = useEnablePush();
  const disablePush = useDisablePush();
  const { subscribed: nativePushSubscribed, refresh: refreshNativePushSubscribed } = useNativePushSubscribed();
  const enableNativePush = useEnableNativePush();
  const disableNativePush = useDisableNativePush();
  const isNative = useIsNativePlatform();

  const deleteAccount = useDeleteAccount();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [newName, setNewName] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const canAddArea = canActivateCategory(categories, accessLevel);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  // Auto-saved fields (name/blur, area name-icon/blur, weight sliders) mutate
  // silently otherwise — flash a "Saved" tick next to whichever field just
  // succeeded, keyed so multiple fields sharing one mutation hook don't
  // cross-light each other.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  function flash(key: string) {
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
  }

  // Weekly Schedule only has real questions to ask for a category that
  // actually exists — a renamed or removed area shouldn't leave a live,
  // toggleable row for a name the user no longer has (see critique).
  const activeCats = categories.filter((c) => c.active);
  const scheduleRows = SCHEDULE_SLOTS.map(({ schedKey, domain }) => ({
    domain: schedKey,
    cat: activeCats.find((c) => detectDomain(c.name) === domain),
  })).filter((row): row is { domain: "gym" | "tennis" | "study"; cat: Category } => !!row.cat);

  function move(cat: Category, dir: -1 | 1) {
    const ordered = [...categories].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((c) => c.id === cat.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    reorder.mutate(ordered.map((c) => c.id));
  }

  function toggleDay(key: "gym" | "tennis" | "study", day: DayIndex) {
    if (!settings) return;
    const cur = settings.weeklySchedule[key];
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    saveSettings.mutate({ weeklySchedule: { ...settings.weeklySchedule, [key]: next } });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Make {APP_VARIANT.name} yours.</p>
      </header>

      {/* Appearance — moved here from the top nav to give the scrollable
          Today/Calendar/Progress/Areas row more breathing room. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Appearance</h2>
        <div className="card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-[var(--muted)]">Light, dark, or match your device.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {/* Profile */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Your name</h2>
        <div className="flex items-center gap-2">
          <input
            defaultValue={settings?.greetingName ?? ""}
            onBlur={(e) => saveSettings.mutate({ greetingName: e.target.value }, { onSuccess: () => flash("name") })}
            placeholder="What should I call you?"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
          />
          <SavedTick show={savedKey === "name"} />
        </div>
      </section>

      {/* Areas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Areas</h2>
        <div className="space-y-2">
          {[...categories]
            .sort((a, b) => a.order - b.order)
            .map((cat) => {
              const accent = accentOf(cat.color);
              return (
                <div key={cat.id} className="card space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={cat.icon}
                      onBlur={(e) =>
                        updateCat.mutate(
                          { id: cat.id, patch: { icon: e.target.value } },
                          { onSuccess: () => flash(`icon-${cat.id}`) },
                        )
                      }
                      className="w-10 rounded-lg border border-[var(--border)] px-1 py-1.5 text-center"
                    />
                    <input
                      defaultValue={cat.name}
                      onBlur={(e) =>
                        updateCat.mutate(
                          { id: cat.id, patch: { name: e.target.value } },
                          { onSuccess: () => flash(`name-${cat.id}`) },
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm font-medium"
                      style={{ color: accent.text }}
                    />
                    <SavedTick show={savedKey === `icon-${cat.id}` || savedKey === `name-${cat.id}`} />
                    <button
                      onClick={() => move(cat, -1)}
                      className="grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)] hover:scale-110 hover:text-[var(--foreground)] hover:opacity-100"
                      aria-label={`Move ${cat.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(cat, 1)}
                      className="grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)] hover:scale-110 hover:text-[var(--foreground)] hover:opacity-100"
                      aria-label={`Move ${cat.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setConfirmingRemove(cat.id)}
                      className="grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)] hover:scale-105 hover:text-[#c06b5a] hover:opacity-100"
                      aria-label={`Delete ${cat.name}`}
                    >
                      ✕
                    </button>
                  </div>
                  {confirmingRemove === cat.id && (
                    <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: "#c06b5a", background: "var(--background)" }}>
                      <p className="text-xs" style={{ color: "#c06b5a" }}>
                        Remove {cat.icon} {cat.name}? Its tasks and logs stay in storage, but it disappears from
                        every screen.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmingRemove(null)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold transition-all hover:brightness-105"
                          style={{ background: "var(--surface)", color: "var(--muted)" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            removeCat.mutate(cat.id);
                            setConfirmingRemove(null);
                          }}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-105"
                          style={{ background: "#a13f2e" }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => updateCat.mutate({ id: cat.id, patch: { color: key } })}
                        aria-label={PALETTE[key].label}
                        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-125 hover:opacity-100"
                        style={{
                          background: PALETTE[key].accent,
                          borderColor: cat.color === key ? "var(--foreground)" : "transparent",
                          transform: cat.color === key ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {canAddArea ? (
          <div className="card flex items-center gap-2 p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createCat.mutate({ name: newName.trim(), color: "slate", icon: "⭐", active: true });
                  setNewName("");
                }
              }}
              placeholder="Add a new area…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <Button
              variant="soft"
              color="#3e6b54"
              disabled={!newName.trim()}
              onClick={() => {
                createCat.mutate({ name: newName.trim(), color: "slate", icon: "⭐", active: true });
                setNewName("");
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <UpgradeCallout feature="A second area" />
        )}
      </section>

      {/* Weekly schedule — only areas that actually exist get a row; see
          scheduleRows above for why (renamed/removed categories previously
          left a live, toggleable row for a name the user no longer has). */}
      {scheduleRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Weekly schedule</h2>
          <p className="text-xs text-[var(--muted)]">
            Tells the check-in which questions to ask and shapes your daily plan.
          </p>
          <div className="card space-y-3 p-4">
            {scheduleRows.map(({ domain, cat }) => (
              <div key={domain} className="space-y-1.5">
                <span className="text-sm">
                  {cat.icon} {cat.name} days
                </span>
                <div className="flex justify-between gap-1">
                  {DAYS.map((d, i) => {
                    const on = settings?.weeklySchedule[domain].includes(i as DayIndex) ?? false;
                    return (
                      <button
                        key={i}
                        onClick={() => toggleDay(domain, i as DayIndex)}
                        aria-label={`${FULL_DAYS[i]}${on ? ", scheduled" : ""}`}
                        aria-pressed={on}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all hover:scale-105 hover:opacity-100"
                        style={{
                          background: on ? "var(--primary)" : "var(--background)",
                          color: on ? "var(--on-primary)" : "var(--muted)",
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Planner weights */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Planner tuning</h2>
        <div className="card space-y-4 p-4">
          {WEIGHTS.map((w) => (
            <div key={w.key}>
              <div className="flex items-center justify-between">
                <label htmlFor={`weight-${w.key}`} className="text-sm font-medium">
                  {w.label}
                </label>
                <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <SavedTick show={savedKey === `weight-${w.key}`} />
                  {(settings?.plannerWeights[w.key] ?? 1).toFixed(1)}×
                </span>
              </div>
              <p id={`weight-${w.key}-hint`} className="mb-1 text-xs text-[var(--muted)]">
                {w.hint}
              </p>
              <input
                id={`weight-${w.key}`}
                aria-describedby={`weight-${w.key}-hint`}
                type="range"
                min={0}
                max={2}
                step={0.5}
                value={settings?.plannerWeights[w.key] ?? 1}
                onChange={(e) =>
                  settings &&
                  saveSettings.mutate(
                    {
                      plannerWeights: {
                        ...settings.plannerWeights,
                        [w.key]: Number(e.target.value),
                      },
                    },
                    { onSuccess: () => flash(`weight-${w.key}`) },
                  )
                }
                className="w-full accent-emerald-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Calendar connections */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Calendar connections</h2>
        {accessLevel !== "free" ? (
          <div className="card p-4">
            <ConnectionsPanel />
          </div>
        ) : (
          <UpgradeCallout feature="Calendar sync" />
        )}
      </section>

      {/* Notifications */}
      <section className="space-y-3" data-tour="notifications-section">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Notifications</h2>
        {accessLevel !== "free" ? (
          isNative ? (
            <div className="card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Event reminders</p>
                <p className="text-xs text-[var(--muted)]">
                  A push notification ~15 minutes before something on your calendar starts.
                  You&apos;ll get a permission prompt the first time you turn this on.
                </p>
                {(enableNativePush.error || disableNativePush.error) && (
                  <p className="text-xs" style={{ color: "#c06b5a" }}>
                    {(enableNativePush.error as Error | null)?.message ||
                      (disableNativePush.error as Error | null)?.message}
                    {" — check that notifications are allowed for this app in Android Settings, then try again."}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const action = nativePushSubscribed ? disableNativePush : enableNativePush;
                  action.mutate(undefined, { onSuccess: refreshNativePushSubscribed });
                }}
                disabled={
                  enableNativePush.isPending || disableNativePush.isPending || nativePushSubscribed === null
                }
                className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105 disabled:opacity-60"
                style={
                  nativePushSubscribed
                    ? { background: "var(--primary-soft)", color: "var(--primary)" }
                    : { background: "var(--primary)", color: "var(--on-primary)" }
                }
              >
                {enableNativePush.isPending || disableNativePush.isPending
                  ? "…"
                  : nativePushSubscribed
                    ? "Turn off"
                    : "Turn on"}
              </button>
            </div>
          ) : pushSupported() ? (
            <div className="card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Event reminders</p>
                <p className="text-xs text-[var(--muted)]">
                  A push notification ~15 minutes before something on your calendar starts.
                  You&apos;ll get a browser permission prompt the first time you turn this on.
                </p>
                {(enablePush.error || disablePush.error) && (
                  <p className="text-xs" style={{ color: "#c06b5a" }}>
                    {(enablePush.error as Error | null)?.message || (disablePush.error as Error | null)?.message}
                    {" — check that your browser allows notifications for this site, then try again."}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const action = pushSubscribed ? disablePush : enablePush;
                  action.mutate(undefined, { onSuccess: refreshPushSubscribed });
                }}
                disabled={enablePush.isPending || disablePush.isPending || pushSubscribed === null}
                className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105 disabled:opacity-60"
                style={
                  pushSubscribed
                    ? { background: "var(--primary-soft)", color: "var(--primary)" }
                    : { background: "var(--primary)", color: "var(--on-primary)" }
                }
              >
                {enablePush.isPending || disablePush.isPending ? "…" : pushSubscribed ? "Turn off" : "Turn on"}
              </button>
            </div>
          ) : (
            <div className="card p-4">
              <p className="text-sm text-[var(--muted)]">Push notifications aren&apos;t supported in this browser.</p>
            </div>
          )
        ) : (
          <UpgradeCallout feature="Event reminders" />
        )}
      </section>

      {/* Subscription — Lodestone only, never rendered for Compass */}
      {APP_VARIANT.id === "study" && (
        <section className="space-y-3" data-tour="subscription-section">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Subscription</h2>
          <div className="card space-y-3 p-4 text-sm">
            {accessLevel === "trial" && settings?.trial_ends_at && (
              <Row
                label="Free trial"
                status="Active"
                on
                note={`Full access until ${new Date(settings.trial_ends_at).toLocaleDateString()}.`}
              />
            )}
            {accessLevel === "paid" && (
              <Row
                label={`${APP_VARIANT.name} Plus`}
                status="Active"
                on
                note={
                  settings?.stripe_current_period_end
                    ? `Renews ${new Date(settings.stripe_current_period_end).toLocaleDateString()}.`
                    : "Full access to both areas, calendar sync, and full history."
                }
              />
            )}
            {accessLevel === "past_due" && (
              <Row
                label={`${APP_VARIANT.name} Plus`}
                status="Payment issue"
                on={false}
                note="We couldn't process your last payment — update your card to keep full access."
              />
            )}
            {accessLevel === "free" && (
              <Row
                label="Free"
                status="Limited"
                on={false}
                note="One area, 7-day history. Upgrade for both areas, calendar sync, and full history."
              />
            )}
            <div className="flex gap-2 pt-1">
              {accessLevel === "free" && (
                <button
                  onClick={async () => {
                    if (!isNative) {
                      startCheckout.mutate();
                      return;
                    }
                    // Native purchases go through Play Billing (via
                    // RevenueCat's dashboard-configured paywall), not
                    // Stripe checkout — Play doesn't allow linking out to a
                    // non-Google payment page for in-app digital content.
                    setNativeBillingPending(true);
                    setNativeBillingError("");
                    try {
                      await presentPaywall();
                    } catch (e) {
                      setNativeBillingError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setNativeBillingPending(false);
                    }
                  }}
                  disabled={isNative ? nativeBillingPending : startCheckout.isPending}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--on-primary)] transition-all hover:brightness-105 disabled:opacity-60"
                  style={{ background: "var(--primary)" }}
                >
                  {(isNative ? nativeBillingPending : startCheckout.isPending) ? "…" : `Upgrade — $4.99/mo`}
                </button>
              )}
              {(accessLevel === "paid" || accessLevel === "past_due") && (
                <button
                  onClick={async () => {
                    if (!isNative) {
                      openBillingPortal.mutate();
                      return;
                    }
                    // A native subscriber's billing lives inside Google
                    // Play, not Stripe — Stripe's portal has no record of
                    // it. RevenueCat's Customer Center shows the real
                    // cancel/manage options backed by the actual store.
                    setNativeBillingPending(true);
                    setNativeBillingError("");
                    try {
                      await presentCustomerCenter();
                    } catch (e) {
                      setNativeBillingError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setNativeBillingPending(false);
                    }
                  }}
                  disabled={isNative ? nativeBillingPending : openBillingPortal.isPending}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105 disabled:opacity-60"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  {(isNative ? nativeBillingPending : openBillingPortal.isPending) ? "…" : "Manage billing"}
                </button>
              )}
            </div>
            {(startCheckout.error || openBillingPortal.error || nativeBillingError) && (
              <p className="text-xs" style={{ color: "#c06b5a" }}>
                {(startCheckout.error as Error | null)?.message ||
                  (openBillingPortal.error as Error | null)?.message ||
                  nativeBillingError}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Help */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Help</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">How {APP_VARIANT.name} works</p>
              <p className="text-xs text-[var(--muted)]">Replay the intro tour any time.</p>
            </div>
            <button
              onClick={() => setTourOpen(true)}
              className="rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              Replay tour
            </button>
          </div>
        </div>
      </section>

      {tourOpen && (
        <IntroTour forceOpen onClose={() => setTourOpen(false)} />
      )}

      {/* Integrations — Compass only. These are internal/personal-project
          details (backend vendor name, a Deakin-specific integration stub)
          that don't mean anything to a real Lodestone customer. */}
      {APP_VARIANT.id !== "study" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Sync & integrations</h2>
          <div className="card space-y-3 p-4 text-sm">
            <Row
              label="Cloud sync (Supabase)"
              status={isSupabaseConfigured() ? "Connected" : "Local-only"}
              on={isSupabaseConfigured()}
              note={
                isSupabaseConfigured()
                  ? "Your data syncs across devices."
                  : "Running locally on this device. Add Supabase keys to sync — see README."
              }
            />
            <Row label="OnTrack (Deakin)" status="Phase 3" on={false} note="Pull uni tasks & deadlines automatically." />
            {isSupabaseConfigured() && (
              <div className="border-t border-[var(--border)] pt-3">
                <button
                  onClick={() => getSupabase()?.auth.signOut()}
                  className="text-xs text-red-500 underline hover:text-red-700 hover:opacity-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {APP_VARIANT.id === "study" && isSupabaseConfigured() && (
        <>
          <div className="pb-2 pt-1 text-center">
            <button
              onClick={() => getSupabase()?.auth.signOut()}
              className="text-xs text-red-500 underline hover:text-red-700 hover:opacity-100"
            >
              Sign out
            </button>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--muted)]">Danger zone</h2>
            <div className="card space-y-3 p-4">
              {!confirmingDelete ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Delete account</p>
                    <p className="text-xs text-[var(--muted)]">
                      Permanently deletes your account and all data — areas, sessions, check-ins, calendar
                      connections. This can&apos;t be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105"
                    style={{ background: "#fce9e5", color: "#a13f2e" }}
                  >
                    Delete…
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium" style={{ color: "#a13f2e" }}>
                    This permanently deletes your account and every area, session, check-in, and calendar
                    connection. It cannot be undone.
                  </p>
                  {isNative && (accessLevel === "paid" || accessLevel === "trial") && (
                    <p className="text-xs" style={{ color: "#a13f2e" }}>
                      If you have an active subscription, cancel it in the Play Store first — deleting your
                      account here does not cancel Play Store billing.
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted)]">
                    Type <strong>DELETE</strong> to confirm.
                  </p>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
                  />
                  {deleteAccount.error && (
                    <p className="text-xs" style={{ color: "#a13f2e" }}>
                      {(deleteAccount.error as Error).message}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirmingDelete(false);
                        setDeleteConfirmText("");
                      }}
                      className="rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-105"
                      style={{ background: "var(--background)", color: "var(--muted)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteAccount.mutate()}
                      disabled={deleteConfirmText !== "DELETE" || deleteAccount.isPending}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-105 disabled:opacity-50"
                      style={{ background: "#a13f2e" }}
                    >
                      {deleteAccount.isPending ? "Deleting…" : "Permanently delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="shrink-0 text-xs font-medium" style={{ color: "var(--success-text)" }} role="status">
      Saved
    </span>
  );
}

function Row({ label, status, on, note }: { label: string; status: string; on: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-[var(--muted)]">{note}</p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: on ? "var(--primary-soft)" : "var(--background)", color: on ? "var(--primary)" : "var(--muted)" }}
      >
        {status}
      </span>
    </div>
  );
}
