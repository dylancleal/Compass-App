"use client";

import Image from "next/image";
import { APP_VARIANT } from "@/lib/appVariant";

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

// Full-bleed, edge-to-edge sign-in for the wrapped native app — the web
// version (a floating card centred in empty space) reads as "a website" in
// a WebView with nothing else around it. Same state/handlers as AuthGate,
// just a different visual layer, and split into two full screens (email,
// then code) rather than one card whose contents swap.
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
  const iconSrc = APP_VARIANT.id === "study" ? "/icon-lodestone.png" : "/icon.svg";

  return (
    <div
      className="flex min-h-dvh flex-col justify-center bg-[var(--background)] px-8"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <Image src={iconSrc} alt="" aria-hidden width={64} height={64} className="mb-8 rounded-2xl" />

      <h1 className="text-3xl font-bold">{APP_VARIANT.name}</h1>
      {APP_VARIANT.heroLine && (
        <p className="mt-1 text-base font-medium" style={{ color: "var(--accent)" }}>
          {APP_VARIANT.heroLine}
        </p>
      )}

      {isDev && (
        <button
          onClick={devLogin}
          className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--border)", color: "var(--muted)" }}
        >
          ⚡ Dev login (preview only)
        </button>
      )}

      {sent ? (
        <div className="mt-8 space-y-4">
          <div>
            <p className="text-xl font-semibold">Check your email</p>
            <p className="mt-1.5 text-base text-[var(--muted)]">
              Enter the code we sent to <strong>{email}</strong>.
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            onKeyDown={(e) => e.key === "Enter" && verifyCode()}
            placeholder="Enter code"
            autoFocus
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center text-xl tracking-[0.3em] outline-none placeholder:tracking-normal focus:border-[var(--primary)]"
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            onClick={verifyCode}
            disabled={code.length < 4 || verifying}
            className="w-full rounded-2xl py-4 text-base font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {verifying ? "Verifying…" : "Verify code"}
          </button>
          <button
            className="w-full py-2 text-sm underline"
            style={{ color: "var(--muted)" }}
            onClick={onTryDifferentEmail}
          >
            Try a different email
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendLink()}
            placeholder="your@email.com"
            autoFocus
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-base outline-none focus:border-[var(--primary)]"
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            onClick={sendLink}
            disabled={!email.includes("@") || sending}
            className="w-full rounded-2xl py-4 text-base font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {sending ? "Sending…" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
