"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { db } from "@/lib/db";
import { APP_VARIANT } from "@/lib/appVariant";
import { useApplyFreeDowngrade, useReactivateOnUpgrade } from "@/lib/subscription";
import { useConfigureRevenueCat } from "@/lib/revenuecat";
import { useIsNativePlatform } from "@/lib/platform";
import NativeAuthScreen from "@/components/NativeAuthScreen";
import Nav from "@/components/Nav";
import Fireflies from "@/components/Fireflies";
import AndroidBackButton from "@/components/AndroidBackButton";
import IntroTour from "@/components/IntroTour";

// Auth is only required when we're running against Supabase. Local mode
// (no env vars / NEXT_PUBLIC_DATA_BACKEND != "supabase") bypasses this entirely.
const needsAuth =
  process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" && isSupabaseConfigured();

// Legal/info pages that must render without signing in — required for
// Google's OAuth verification (and basic decency: a privacy policy you can't
// read without an account is no privacy policy at all). These render bare,
// with none of the authenticated app shell (Nav, Fireflies, IntroTour).
const PUBLIC_PATHS = new Set(["/privacy", "/terms"]);

// Calls ensureSeeded only from the authenticated shell below, so it never
// mounts on the login screen, the loading state, or a public legal page.
function SeedOnMount() {
  useEffect(() => {
    db.ensureSeeded();
  }, []);
  return null;
}

// Not a secret — just identifies which account gets the fixed-code bypass
// below. The actual gate is the code itself, checked server-side.
const REVIEWER_EMAIL = process.env.NEXT_PUBLIC_PLAY_REVIEWER_EMAIL;

// A raw Error's own enumerable properties are empty (message/stack live on
// the prototype), so JSON.stringify(someError) — which an API route this
// calls into may do on an unhandled exception — produces the literal string
// "{}". That string then flows straight into setErr and renders verbatim,
// which is the "{}" users see on a failed sign-in. This never trusts an
// error value at face value: only a genuinely non-empty message gets shown.
function friendlyAuthError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e && e !== "{}" && e !== "[object Object]") return e;
  return "Something went wrong on our end — please try again.";
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  // No-ops on web/Compass (useConfigureRevenueCat itself checks
  // Capacitor.isNativePlatform()) and before a session exists.
  useConfigureRevenueCat(session !== "loading" ? session?.user.id : undefined);

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

  // Bare, no shell, no session check — a legal page has to be readable by
  // anyone (including an unauthenticated review bot) without waiting on
  // Supabase to resolve a session first.
  if (PUBLIC_PATHS.has(pathname ?? "")) return <>{children}</>;

  // Authenticated (or local mode) — show the app, wrapped in its shell. Only
  // renders once the session check has actually resolved to a real session.
  // This used to live in app/layout.tsx wrapping AuthGate from the outside;
  // it moved in here so the shell (and SeedOnMount) only ever mounts once a
  // session actually exists, leaving room for the public/unauthenticated
  // branches below to render without it.
  const isAuthenticated = session !== "loading" && session !== null;
  if (!needsAuth || isAuthenticated) {
    return (
      <>
        <AndroidBackButton />
        <Fireflies />
        <Nav />
        <main
          className="mx-auto w-full max-w-2xl px-4 pb-10"
          style={{ paddingTop: "calc(5rem + env(safe-area-inset-top))" }}
        >
          <SeedOnMount />
          {children}
        </main>
        <IntroTour />
      </>
    );
  }

  // Not authenticated in Supabase mode (or the session/platform checks are
  // still resolving) — show magic-link login. Deliberately doesn't gate this
  // behind a blocking "Loading…" spinner while session/isNative resolve: the
  // raw server-rendered HTML needs real, crawlable content immediately for
  // search engines and for Google's OAuth verification, which reads the page
  // before any client JS runs — a bare loading screen here is exactly what
  // got this flagged as "does not explain the purpose of your app". A
  // returning signed-in user may see a brief flash of this screen before it
  // swaps to the authenticated shell once the session check resolves.
  async function sendLink() {
    if (sending) return;
    setSending(true);
    setErr("");
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setErr(friendlyAuthError(error));
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

    // Play Store reviewers can't receive real emails, so the account
    // declared in Play Console's "Sign in details" uses a fixed,
    // non-expiring code (per Google's own guidance for OTP-based apps)
    // verified via /api/reviewer-auth instead of a real emailed OTP.
    if (
      REVIEWER_EMAIL &&
      email.trim().toLowerCase() === REVIEWER_EMAIL.toLowerCase()
    ) {
      const res = await fetch("/api/reviewer-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setVerifying(false);
      if (data.error) { setErr(friendlyAuthError(data.error)); return; }
      const { error } = await getSupabase()!.auth.verifyOtp({
        email: data.email,
        token: data.token,
        type: "magiclink",
      });
      if (error) setErr(friendlyAuthError(error));
      return;
    }

    const { error } = await getSupabase()!.auth.verifyOtp({ email, token: code, type: "email" });
    setVerifying(false);
    if (error) setErr(friendlyAuthError(error));
  }

  const isDev = process.env.NODE_ENV === "development";

  async function devLogin() {
    try {
      const res = await fetch("/api/dev-auth");
      const { token, email, error } = await res.json();
      if (error) { setErr(friendlyAuthError(error)); return; }
      const { error: verifyErr } = await getSupabase()!.auth.verifyOtp({
        email,
        token,
        type: "magiclink",
      });
      if (verifyErr) setErr(friendlyAuthError(verifyErr));
    } catch (e) {
      setErr(friendlyAuthError(e));
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
      <div className="w-full max-w-sm space-y-6 py-8">
        {/* Purpose explanation — visible to every signed-out visitor,
            including an unauthenticated review pass, without needing to log
            in first. This is the whole reason a signed-out visit to "/"
            shows more than a bare login form. */}
        <div className="space-y-3 text-center">
          {APP_VARIANT.logoStyle === "classic" && (
            <span
              className="mx-auto mb-1 grid h-11 w-11 place-items-center rounded-2xl text-2xl"
              style={{ background: "var(--primary-soft)" }}
              aria-hidden
            >
              🧭
            </span>
          )}
          <h1
            className="text-2xl font-bold"
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
          <ul className="space-y-1.5 pt-1 text-left text-sm" style={{ color: "var(--muted)" }}>
            {APP_VARIANT.pitch.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden style={{ color: "var(--primary)" }}>·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-5 p-6">
        <p className="text-sm text-[var(--muted)]">
          Sign in with a one-time code — no password needed.
        </p>

        {isDev && (
          <button
            onClick={devLogin}
            className="w-full rounded-xl px-4 py-3 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--border)", color: "var(--foreground)" }}
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
              autoComplete="one-time-code"
              aria-label="Verification code"
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
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center text-lg tracking-[0.3em] outline-none placeholder:tracking-normal focus:border-[var(--primary)]"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              onClick={verifyCode}
              disabled={code.length < 4 || verifying}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-[var(--on-primary)] transition-opacity disabled:opacity-50"
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
              autoComplete="email"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="your@email.com"
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[var(--primary)]"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              onClick={sendLink}
              disabled={!email.includes("@") || sending}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-[var(--on-primary)] transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {sending ? "Sending…" : "Continue"}
            </button>
          </div>
        )}
        </div>

        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
