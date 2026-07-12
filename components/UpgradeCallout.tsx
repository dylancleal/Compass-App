"use client";

import { useStartCheckout } from "@/lib/subscription";

export default function UpgradeCallout({ feature }: { feature: string }) {
  const startCheckout = useStartCheckout();

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl p-3.5 text-sm"
      style={{ background: "var(--accent-soft)", border: "1px solid var(--mist)" }}
    >
      <div>
        <p className="font-medium" style={{ color: "var(--accent)" }}>
          {feature} is a paid feature
        </p>
        <p className="text-xs text-[var(--muted)]">Upgrade to unlock it, or start a new free trial.</p>
      </div>
      <button
        onClick={() => startCheckout.mutate()}
        disabled={startCheckout.isPending}
        className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-[#fffdf9] transition-all hover:brightness-105 disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {startCheckout.isPending ? "…" : "Upgrade"}
      </button>
    </div>
  );
}
