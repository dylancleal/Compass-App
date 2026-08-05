"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { NebulaBackdrop } from "@/components/Starfield";
import { APP_VARIANT } from "@/lib/appVariant";

interface ShareRecapCardProps {
  dateRange: string;
  sessionCount: number;
  timeLabel: string;
  streak: number;
  byArea: { icon: string; name: string; count: number }[];
}

// Renders an on-brand, shareable image of the week — the app's own growth
// loop: this card is designed to look good posted to Instagram/TikTok as-is,
// with the wordmark/URL baked in as a watermark so it's traceable back to
// the app wherever it ends up. The card itself always renders (so it's easy
// to preview/tweak visually); only the "Share" button needs the capture +
// share-sheet logic below.
export default function ShareRecapCard({ dateRange, sessionCount, timeLabel, streak, byArea }: ShareRecapCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleShare() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setErr("");
    try {
      // pixelRatio bumps output resolution well past the on-screen card size
      // — sharp enough for a phone screen or an Instagram Story, not just a
      // thumbnail.
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });

      if (Capacitor.isNativePlatform()) {
        // Confirmed on-device: Capacitor's Android WebView does NOT
        // implement the Web Share API at all (navigator.share/canShare are
        // both undefined there, unlike Chrome-for-Android the browser app),
        // and the plain <a download> fallback silently no-ops too. This is
        // exactly the gap @capacitor/share + @capacitor/filesystem exist to
        // fill: write the PNG to the app's cache dir, then hand that file
        // URI to the native share sheet.
        const base64 = dataUrl.split(",")[1];
        const { uri } = await Filesystem.writeFile({
          path: "lodestone-week.png",
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `My ${APP_VARIANT.name} week`,
          files: [uri],
          dialogTitle: "Share your week",
        });
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "lodestone-week.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `My ${APP_VARIANT.name} week` });
        } else {
          // Fallback (older/desktop browsers without share targets): just
          // download the image so it can still be shared manually.
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = "lodestone-week.png";
          link.click();
        }
      }
    } catch (e) {
      // Cancelling the native share sheet isn't a real failure — both
      // Capacitor's Share plugin and the Web Share API reject the promise
      // in that case rather than resolving, so it has to be filtered out
      // here instead of treated as an error.
      const cancelled =
        e instanceof Error && (e.name === "AbortError" || /cancel/i.test(e.message));
      if (!cancelled) setErr("Couldn't create the image — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Share your week</h2>
      </div>

      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ boxShadow: "var(--shadow-3)" }}
      >
        <NebulaBackdrop />
        <div className="relative space-y-5">
          <div>
            <p
              className="text-2xl font-extrabold tracking-tight"
              style={{
                color: "#fffef8",
                textShadow:
                  "0 0 18px color-mix(in srgb, var(--primary-mid) 60%, transparent), 0 0 38px color-mix(in srgb, var(--accent) 32%, transparent)",
              }}
            >
              {APP_VARIANT.name}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              {dateRange}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xl font-bold" style={{ color: "#fffef8" }}>
                {sessionCount}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                sessions
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#fffef8" }}>
                {timeLabel}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                total time
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#fffef8" }}>
                {streak > 0 ? `${streak}d` : "—"}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                streak
              </p>
            </div>
          </div>

          {byArea.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {byArea.map((a) => (
                <span
                  key={a.name}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fffef8" }}
                >
                  {a.icon} {a.name} · {a.count}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            mylodestone.app
          </p>
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={busy}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-[var(--on-primary)] transition-all hover:brightness-105 disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {busy ? "…" : "Share"}
      </button>
      {err && <p className="text-xs text-center" style={{ color: "#c06b5a" }}>{err}</p>}
    </section>
  );
}
