import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getWebPush } from "@/lib/webpush";
import { APP_VARIANT } from "@/lib/appVariant";
import type { WebPushError } from "web-push";

// The service worker is shared between Compass and Lodestone (one static
// public/sw.js, no per-variant build step for it), so the icon has to be
// chosen server-side, where APP_VARIANT is actually known, and passed
// through the payload rather than hardcoded in the worker.
const NOTIFICATION_ICON = APP_VARIANT.id === "study" ? "/icon-lodestone.png" : "/icon.svg";

export const runtime = "nodejs";

// How far ahead to look for events to remind about. The cron runs every 5
// minutes (vercel.json), so this window guarantees every block gets seen
// (and reminded exactly once, via reminder_sent_at) before its start time.
const LEAD_MINUTES = 15;

function isGone(err: unknown): boolean {
  const status = (err as WebPushError | undefined)?.statusCode;
  return status === 404 || status === 410;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }

  const supabase = getServiceSupabase();
  const webpush = getWebPush();

  const now = new Date();
  const windowEnd = new Date(now.getTime() + LEAD_MINUTES * 60_000);

  const { data: blocks } = await supabase
    .from("calendar_blocks")
    .select("id, user_id, title, start_at")
    .is("reminder_sent_at", null)
    .eq("all_day", false)
    .eq("status", "planned")
    .gte("start_at", now.toISOString())
    .lte("start_at", windowEnd.toISOString());

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const block of blocks ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, timezone")
      .eq("user_id", block.user_id);

    const minutesUntil = Math.max(1, Math.round((new Date(block.start_at).getTime() - now.getTime()) / 60_000));
    const relative = `in ${minutesUntil} minute${minutesUntil === 1 ? "" : "s"}`;

    for (const sub of subs ?? []) {
      // Formatted per-subscription, not once per block — the cron has no
      // browser context of its own, so the clock time is only as correct as
      // the timezone each subscription captured at "Turn on" time (older
      // subscriptions predating that field fall back to relative-only).
      const body = sub.timezone
        ? `Starts at ${new Date(block.start_at).toLocaleTimeString("en-US", {
            timeZone: sub.timezone,
            hour: "numeric",
            minute: "2-digit",
          })} (${relative})`
        : `Starts ${relative}`;
      const payload = JSON.stringify({ title: block.title, body, url: "/today", icon: NOTIFICATION_ICON });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const status = (err as WebPushError | undefined)?.statusCode;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[send-reminders] push failed (status ${status ?? "?"}) for sub ${sub.id}: ${msg}`);
        errors.push(`${sub.id}: ${status ?? "?"} ${msg}`);
        if (isGone(err)) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        // Otherwise leave it — a transient failure shouldn't drop the subscription.
      }
    }

    await supabase.from("calendar_blocks").update({ reminder_sent_at: now.toISOString() }).eq("id", block.id);
  }

  return NextResponse.json({ blocks: blocks?.length ?? 0, sent, failed, errors });
}
