"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

// Auth is only required when we're running against Supabase. Local mode
// (no env vars / NEXT_PUBLIC_DATA_BACKEND != "supabase") bypasses this entirely.
const needsAuth =
  process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" && isSupabaseConfigured();

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | "loading">(
    needsAuth ? "loading" : null,
  );
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!needsAuth) return;
    const sb = getSupabase()!;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, s) => {
      queryClient.clear();
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Loading state while we check for an existing session.
  if (session === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  // Authenticated (or local mode) — show the app.
  if (!needsAuth || session) return <>{children}</>;

  // Not authenticated in Supabase mode — show magic-link login.
  async function sendLink() {
    if (sending) return;
    setSending(true);
    setErr("");
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  const isDev = process.env.NODE_ENV === "development";

  async function devLogin() {
    try {
      const res = await fetch("/api/dev-auth");
      const { link, error } = await res.json();
      if (error) { setErr(error); return; }
      window.location.href = link;
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--background)] p-4">
      <div className="card w-full max-w-sm space-y-5 p-6">
        <div className="space-y-1">
          <span
            className="mb-1 grid h-11 w-11 place-items-center rounded-2xl text-2xl"
            style={{ background: "var(--primary-soft)" }}
            aria-hidden
          >
            🧭
          </span>
          <h1 className="text-xl font-bold">Welcome to Compass</h1>
          <p className="text-sm text-[var(--muted)]">
            Sign in with a magic link — no password needed.
          </p>
        </div>

        {isDev && (
          <button
            onClick={devLogin}
            className="w-full rounded-xl py-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--border)", color: "var(--muted)" }}
          >
            ⚡ Dev login (preview only)
          </button>
        )}

        {sent ? (
          <div className="space-y-1.5 rounded-xl p-4 text-sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <p className="font-semibold">Check your email ✉️</p>
            <p>
              A sign-in link is on its way to <strong>{email}</strong>. Click it and
              you&apos;re in.
            </p>
            <button
              className="mt-1 text-xs underline hover:text-[var(--primary)] hover:opacity-100"
              onClick={() => { setSent(false); setEmail(""); }}
            >
              Try a different email
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="your@email.com"
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              onClick={sendLink}
              disabled={!email.includes("@") || sending}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
