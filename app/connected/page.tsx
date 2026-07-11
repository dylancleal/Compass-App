"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { APP_VARIANT } from "@/lib/appVariant";

// Landing page after a successful Google Calendar OAuth connect. Deliberately
// simple and self-contained: it confirms success without depending on the
// original deep link surviving (iOS PWAs can cold-restart mid-flow) and never
// routes the user back through onboarding.
export default function ConnectedPage() {
  const qc = useQueryClient();
  useEffect(() => {
    // The connection + first synced blocks were written server-side during the
    // callback; refresh so they show up when the user returns to the app.
    qc.invalidateQueries();
  }, [qc]);

  return (
    <div className="mx-auto max-w-md space-y-5 py-10 text-center">
      <div
        className="card animate-celebrate space-y-3 p-8"
        style={{ background: "var(--primary-soft)", borderColor: "var(--mist)" }}
      >
        <div className="text-5xl">🗓️</div>
        <h1 className="text-xl font-bold" style={{ color: "var(--primary)" }}>
          Calendar connected
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Your Google Calendar is linked. {APP_VARIANT.name} will now plan around your real
          schedule and surface deadlines automatically.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/"
          className="btn-life w-full rounded-xl py-3 text-sm font-semibold"
          style={{ background: "var(--primary)", color: "#fffdf9" }}
        >
          Continue to {APP_VARIANT.name} →
        </Link>
        <Link
          href="/settings"
          className="text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)]"
        >
          Manage calendars
        </Link>
      </div>
    </div>
  );
}
