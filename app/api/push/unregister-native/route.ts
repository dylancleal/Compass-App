import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("fcm_tokens").delete().eq("user_id", userData.user.id);
  return NextResponse.json({ ok: true });
}
