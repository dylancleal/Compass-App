import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getWebPush } from "@/lib/webpush";
import type { WebPushError } from "web-push";

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
  for (const block of blocks ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", block.user_id);

    const minutesUntil = Math.max(1, Math.round((new Date(block.start_at).getTime() - now.getTime()) / 60_000));
    const payload = JSON.stringify({
      title: block.title,
      body: `Starts in ${minutesUntil} minute${minutesUntil === 1 ? "" : "s"}`,
      url: "/today",
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        if (isGone(err)) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        // Otherwise leave it — a transient failure shouldn't drop the subscription.
      }
    }

    await supabase.from("calendar_blocks").update({ reminder_sent_at: now.toISOString() }).eq("id", block.id);
  }

  return NextResponse.json({ blocks: blocks?.length ?? 0, sent });
}
