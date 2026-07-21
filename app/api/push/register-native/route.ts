import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  let body: { token?: string; timezone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { error } = await supabase
    .from("fcm_tokens")
    .upsert(
      { user_id: userId, token: body.token, timezone: body.timezone ?? null },
      { onConflict: "token" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
