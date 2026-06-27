import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";

// Lightweight DB ping — keeps Supabase free tier from pausing due to inactivity.
// Point UptimeRobot (or any uptime monitor) at this endpoint every 5 minutes.
export async function GET() {
  try {
    const sb = getServiceSupabase();
    await sb.from("categories").select("id", { count: "exact", head: true });
    return NextResponse.json({ ok: true, t: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
