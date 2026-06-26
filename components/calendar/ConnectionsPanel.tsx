"use client";

import { useState } from "react";
import { Sheet, Button } from "@/components/ui";
import type { CalendarConnection } from "@/lib/types";
import {
  useCalendarConnections,
  useCreateCalendarConnection,
  useUpdateCalendarConnection,
  useRemoveCalendarConnection,
  useSyncCalendarConnection,
} from "@/lib/queries";

const PROVIDERS = [
  {
    id: "google" as const,
    label: "Google Calendar",
    icon: "🗓️",
    instructions:
      "In Google Calendar, go to Settings → your calendar → 'Secret address in iCal format'. Copy that URL here.",
  },
  {
    id: "microsoft" as const,
    label: "Outlook / Microsoft",
    icon: "📅",
    instructions:
      "In Outlook.com, go to Settings → Calendar → Shared calendars → 'Publish a calendar'. Choose your calendar, select 'Can view all details', and copy the ICS link.",
  },
  {
    id: "apple" as const,
    label: "Apple Calendar",
    icon: "🍎",
    instructions:
      "In iCloud.com, open Calendar, click Share (📡) next to your calendar, enable 'Public Calendar', then copy the link shown.",
  },
  {
    id: "ics" as const,
    label: "Other / ICS URL",
    icon: "🔗",
    instructions: "Paste any public or secret .ics / iCal URL.",
  },
];

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConnectionRow({ conn }: { conn: CalendarConnection }) {
  const update = useUpdateCalendarConnection();
  const remove = useRemoveCalendarConnection();
  const sync = useSyncCalendarConnection();
  const prov = PROVIDERS.find((p) => p.id === conn.provider) ?? PROVIDERS[3];
  const isSyncing = sync.isPending;

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 hover:shadow-sm"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="text-xl shrink-0 transition-transform duration-150 group-hover:scale-110">
        {prov.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{conn.label}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {conn.last_synced_at ? `Synced ${timeSince(conn.last_synced_at)}` : "Never synced"}
          {sync.isError && (
            <span className="ml-1" style={{ color: "#c06b5a" }}>
              · {sync.error instanceof Error ? sync.error.message : "Sync failed"}
            </span>
          )}
        </p>
      </div>

      {/* Enable toggle */}
      <button
        className="shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
        style={{
          background: conn.enabled ? "var(--primary)" : "var(--border)",
          color: conn.enabled ? "#fffdf9" : "var(--muted)",
        }}
        onClick={() => update.mutate({ id: conn.id, patch: { enabled: !conn.enabled } })}
      >
        {conn.enabled ? "On" : "Off"}
      </button>

      {/* Sync now */}
      <button
        disabled={!conn.ics_url || isSyncing || !conn.enabled}
        className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-medium transition-all duration-150 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: "var(--primary-soft)",
          color: "var(--primary)",
        }}
        onClick={() =>
          conn.ics_url &&
          sync.mutate({ id: conn.id, url: conn.ics_url, provider: conn.provider, label: conn.label })
        }
      >
        {isSyncing ? "Syncing…" : "Sync"}
      </button>

      {/* Remove */}
      <button
        className="shrink-0 cursor-pointer rounded-lg p-1 text-sm transition-all duration-150 hover:scale-110 hover:text-[#c06b5a] active:scale-95"
        style={{ color: "var(--muted)", opacity: 0.5 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
        onClick={() => remove.mutate(conn.id)}
        aria-label="Remove connection"
      >
        ✕
      </button>
    </div>
  );
}

type ProviderID = "google" | "microsoft" | "apple" | "ics";

function AddConnectionSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<ProviderID>("google");
  const [label, setLabel] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  const create = useCreateCalendarConnection();
  const sync = useSyncCalendarConnection();

  const prov = PROVIDERS.find((p) => p.id === provider)!;

  async function handleAdd() {
    if (!icsUrl.trim()) return;
    const conn = await create.mutateAsync({
      provider,
      label: label.trim() || prov.label,
      ics_url: icsUrl.trim(),
      enabled: true,
    });
    sync.mutate({ id: conn.id, url: icsUrl.trim(), provider, label: label.trim() || prov.label });
    setLabel("");
    setIcsUrl("");
    setProvider("google");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Connect a calendar">
      <div className="space-y-4">
        {/* Provider picker */}
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: active ? "var(--primary-soft)" : "var(--surface)",
                  color: active ? "var(--primary)" : "var(--foreground)",
                  border: `1.5px solid ${active ? "var(--mist)" : "var(--border)"}`,
                  boxShadow: active ? "0 0 0 1px var(--mist)" : "none",
                }}
              >
                <span className={`transition-transform duration-150 ${active ? "scale-110" : ""}`}>
                  {p.icon}
                </span>
                <span className="truncate">{p.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Instructions */}
        <div
          className="animate-fade-slide rounded-xl px-3 py-2.5 text-xs leading-relaxed"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          {prov.instructions}
        </div>

        {/* Label */}
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition-all duration-150 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
          placeholder={`Label (e.g. "${prov.label}")`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        {/* ICS URL */}
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition-all duration-150 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
          placeholder="Paste .ics URL here"
          value={icsUrl}
          onChange={(e) => setIcsUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="flex gap-2 pt-1">
          <Button onClick={handleAdd} disabled={!icsUrl.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add & sync"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}

export default function ConnectionsPanel() {
  const { data: connections = [] } = useCalendarConnections();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Connected calendars</p>
        {/* Solid primary button — clearly a CTA, not a greyed-out link */}
        <button
          onClick={() => setAddOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-[#fffdf9] transition-all duration-150 hover:scale-[1.03] hover:brightness-110 active:scale-[0.97]"
          style={{ background: "var(--primary)" }}
        >
          <span className="text-base leading-none">+</span> Add calendar
        </button>
      </div>

      {connections.length === 0 ? (
        <button
          onClick={() => setAddOpen(true)}
          className="w-full cursor-pointer rounded-2xl p-5 text-center text-sm transition-all duration-150 hover:scale-[1.01] hover:shadow-sm active:scale-[0.99]"
          style={{
            border: "1.5px dashed var(--mist)",
            color: "var(--muted)",
            background: "transparent",
          }}
        >
          <p className="mb-1.5 text-2xl">📅</p>
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            Connect your calendars
          </p>
          <p className="mt-0.5 text-xs">
            Google, Outlook, or Apple — tap to get started
          </p>
        </button>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <ConnectionRow key={conn.id} conn={conn} />
          ))}
        </div>
      )}

      <AddConnectionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
