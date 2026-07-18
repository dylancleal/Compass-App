"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { APP_VARIANT } from "@/lib/appVariant";
import { useApplyFreeDowngrade, useReactivateOnUpgrade } from "@/lib/subscription";
import { useIsNativePlatform } from "@/lib/platform";
import NativeAuthScreen from "@/components/NativeAuthScreen";

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
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const queryClient = useQueryClient();
  const isNative = useIsNativePlatform();

  // Runs on every load regardless of which page the user lands on. Both are
  // no-ops for Compass (getAccessLevel always resolves "paid" there) and
  // no-ops before settings have loaded (permissive default), so it's safe
  // to mount unconditionally ahead of the auth-gate's early returns below.
  useApplyFreeDowngrade();
  useReactivateOnUpgrade();

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

  // Loading state while we check for an existing session (and, since it
  // resolves in an effect to avoid a hydration mismatch, which sign-in
  // screen to show).
  if (session === "loading" || isNative === null) {
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

  // A clicked magic link opens in the phone's system browser, not back
  // inside the app's own WebView — separate storage contexts, so the app
  // itself stays signed out even though the browser tab authenticates fine.
  // Typing the code in the same email keeps the user in the app the whole
  // time, so it's the reliable path (works everywhere, not just wrapped
  // native apps) rather than a mobile-only special case.
  async function verifyCode() {
    if (verifying || code.length < 4) return;
    setVerifying(true);
    setErr("");
    const { error } = await getSupabase()!.auth.verifyOtp({ email, token: code, type: "email" });
    setVerifying(false);
    if (error) setErr(error.message);
  }

  const isDev = process.env.NODE_ENV === "development";

  async function devLogin() {
    try {
      const res = await fetch("/api/dev-auth");
      const { token, email, error } = await res.json();
      if (error) { setErr(error); return; }
      const { error: verifyErr } = await getSupabase()!.auth.verifyOtp({
        email,
        token,
        type: "magiclink",
      });
      if (verifyErr) setErr(verifyErr.message);
    } catch (e) {
      setErr(String(e));
    }
  }

  if (isNative) {
    return (
      <NativeAuthScreen
        email={email}
        setEmail={setEmail}
        sendLink={sendLink}
        sending={sending}
        sent={sent}
        code={code}
        setCode={setCode}
        verifyCode={verifyCode}
        verifying={verifying}
        err={err}
        onTryDifferentEmail={() => { setSent(false); setEmail(""); setCode(""); setErr(""); }}
        isDev={isDev}
        devLogin={devLogin}
      />
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--background)] p-4">
      <div className="card w-full max-w-sm space-y-5 p-6">
        <div className="space-y-1">
          {APP_VARIANT.logoStyle === "classic" && (
            <span
              className="mb-1 grid h-11 w-11 place-items-center rounded-2xl text-2xl"
              style={{ background: "var(--primary-soft)" }}
              aria-hidden
            >
              🧭
            </span>
          )}
          <h1
            className="text-xl font-bold"
            style={
              APP_VARIANT.logoStyle === "glow"
                ? {
                    textShadow:
                      "0 0 14px color-mix(in srgb, var(--primary-mid) 55%, transparent), 0 0 28px color-mix(in srgb, var(--accent) 28%, transparent)",
                  }
                : undefined
            }
          >
            {APP_VARIANT.welcomeTitle}
          </h1>
          {APP_VARIANT.heroLine && (
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              {APP_VARIANT.heroLine}
            </p>
          )}
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
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl p-4 text-sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              <p className="font-semibold">Check your email ✉️</p>
              <p>
                We sent a code to <strong>{email}</strong>. Enter it below — or, if
                you&apos;re checking email on this same device, tapping the link in it
                works too.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              // Not hardcoded to a specific digit count — Supabase's OTP
              // length is a project-level setting (this one's currently 8,
              // not the more common 6), so a fixed cap here would silently
              // truncate a valid code the moment that setting differs or
              // changes. 10 is just a generous sanity ceiling.
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              placeholder="Enter code"
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none placeholder:tracking-normal focus:border-[var(--primary)]"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              onClick={verifyCode}
              disabled={code.length < 4 || verifying}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>
            <button
              className="w-full text-xs underline hover:text-[var(--primary)] hover:opacity-100"
              style={{ color: "var(--muted)" }}
              onClick={() => { setSent(false); setEmail(""); setCode(""); setErr(""); }}
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
