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
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-xl shrink-0">{prov.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{conn.label}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {conn.last_synced_at ? `Synced ${timeSince(conn.last_synced_at)}` : "Never synced"}
          {sync.isError && (
            <span className="ml-1 text-[#c06b5a]">
              · {sync.error instanceof Error ? sync.error.message : "Sync failed"}
            </span>
          )}
        </p>
      </div>

      {/* Enable toggle */}
      <button
        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-all"
        style={{
          background: conn.enabled ? "var(--primary-soft)" : "var(--border)",
          color: conn.enabled ? "var(--primary)" : "var(--muted)",
        }}
        onClick={() => update.mutate({ id: conn.id, patch: { enabled: !conn.enabled } })}
      >
        {conn.enabled ? "On" : "Off"}
      </button>

      {/* Sync now */}
      <button
        disabled={!conn.ics_url || isSyncing || !conn.enabled}
        className="shrink-0 text-xs font-medium disabled:opacity-40 transition-opacity"
        style={{ color: "var(--primary)" }}
        onClick={() =>
          conn.ics_url &&
          sync.mutate({ id: conn.id, url: conn.ics_url, provider: conn.provider, label: conn.label })
        }
      >
        {isSyncing ? "Syncing…" : "Sync"}
      </button>

      {/* Remove */}
      <button
        className="shrink-0 text-xs opacity-40 hover:opacity-80 transition-opacity"
        style={{ color: "var(--muted)" }}
        onClick={() => remove.mutate(conn.id)}
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
    // Trigger an immediate sync after adding.
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
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-all"
              style={{
                background: provider === p.id ? "var(--primary-soft)" : "var(--surface)",
                color: provider === p.id ? "var(--primary)" : "var(--foreground)",
                border: `1px solid ${provider === p.id ? "var(--mist)" : "var(--border)"}`,
              }}
            >
              <span>{p.icon}</span>
              <span className="truncate">{p.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* Instructions */}
        <div
          className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          {prov.instructions}
        </div>

        {/* Label */}
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          placeholder={`Label (e.g. "${prov.label}")`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        {/* ICS URL */}
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          placeholder="Paste .ics URL here"
          value={icsUrl}
          onChange={(e) => setIcsUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleAdd}
            disabled={!icsUrl.trim() || create.isPending}
          >
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
        <Button variant="soft" onClick={() => setAddOpen(true)}>
          + Add calendar
        </Button>
      </div>

      {connections.length === 0 ? (
        <div
          className="rounded-2xl p-5 text-center text-sm"
          style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
        >
          <p className="mb-1 text-base">📅</p>
          <p>Connect Google, Outlook, or Apple Calendar to block off your busy time automatically.</p>
        </div>
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
