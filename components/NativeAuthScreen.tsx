"use client";

import { APP_VARIANT } from "@/lib/appVariant";
import { NebulaBackdrop } from "@/components/Starfield";

interface NativeAuthScreenProps {
  email: string;
  setEmail: (v: string) => void;
  sendLink: () => void;
  sending: boolean;
  sent: boolean;
  code: string;
  setCode: (v: string) => void;
  verifyCode: () => void;
  verifying: boolean;
  err: string;
  onTryDifferentEmail: () => void;
  isDev: boolean;
  devLogin: () => void;
}

// Full-bleed, edge-to-edge sign-in for the wrapped native app. Deliberately
// doesn't reach for the site's light/dark theme tokens — like the
// day-complete celebration card (Plan.tsx), this is a fixed brand moment
// (the same deep-space nebula + starfield), not a themed surface, so every
// colour below is a literal value chosen for contrast against that backdrop
// rather than var(--surface)/var(--border), which would go invisible-on-dark
// whenever the site theme happens to be light.
export default function NativeAuthScreen({
  email,
  setEmail,
  sendLink,
  sending,
  sent,
  code,
  setCode,
  verifyCode,
  verifying,
  err,
  onTryDifferentEmail,
  isDev,
  devLogin,
}: NativeAuthScreenProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col justify-center overflow-hidden px-8"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <NebulaBackdrop />

      <div className="relative">
        <h1
          className="text-5xl font-extrabold tracking-tight"
          style={{
            color: "#fffef8",
            textShadow:
              "0 0 24px color-mix(in srgb, var(--primary-mid) 65%, transparent), 0 0 52px color-mix(in srgb, var(--accent) 38%, transparent)",
          }}
        >
          {APP_VARIANT.name}
        </h1>
        {APP_VARIANT.heroLine && (
          <p className="mt-2 text-base font-medium" style={{ color: "var(--accent)" }}>
            {APP_VARIANT.heroLine}
          </p>
        )}

        {isDev && (
          <button
            onClick={devLogin}
            className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
          >
            ⚡ Dev login (preview only)
          </button>
        )}

        {sent ? (
          <div className="mt-8 space-y-4">
            <div>
              <p className="text-xl font-semibold" style={{ color: "#fffef8" }}>
                Check your email
              </p>
              <p className="mt-1.5 text-base" style={{ color: "rgba(255,255,255,0.72)" }}>
                Enter the code we sent to <strong>{email}</strong>.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              placeholder="Enter code"
              autoFocus
              className="w-full rounded-2xl px-4 py-4 text-center text-xl tracking-[0.3em] outline-none placeholder:tracking-normal focus:ring-2 focus:ring-white/50"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fffef8",
              }}
            />
            {err && (
              <p className="text-sm" style={{ color: "#ff9b8f" }}>
                {err}
              </p>
            )}
            <button
              onClick={verifyCode}
              disabled={code.length < 4 || verifying}
              className="w-full rounded-2xl py-4 text-base font-semibold text-[var(--on-primary)] transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>
            <button
              className="w-full py-2 text-sm underline"
              style={{ color: "rgba(255,255,255,0.6)" }}
              onClick={onTryDifferentEmail}
            >
              Try a different email
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <input
              type="email"
              autoComplete="email"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="your@email.com"
              autoFocus
              className="w-full rounded-2xl px-4 py-4 text-base outline-none focus:ring-2 focus:ring-white/50"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fffef8",
              }}
            />
            {err && (
              <p className="text-sm" style={{ color: "#ff9b8f" }}>
                {err}
              </p>
            )}
            <button
              onClick={sendLink}
              disabled={!email.includes("@") || sending}
              className="w-full rounded-2xl py-4 text-base font-semibold text-[var(--on-primary)] transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {sending ? "Sending…" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
