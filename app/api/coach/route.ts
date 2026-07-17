import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceSupabase } from "@/lib/supabaseService";
import { buildCoachContext } from "@/lib/coachContext";

// Bounds worst-case spend from a runaway client or scripted abuse — nowhere
// near what a real user hits (one weekly insight + a handful of asks/day).
const MAX_CALLS_PER_DAY = 20;

const SYSTEM_PROMPT =
  "You are Lodestone's habit coach — calm, warm, and specific. Lodestone tracks two life areas: " +
  "Study and Gym. You're given the user's own aggregated stats (streaks, session counts, best " +
  "weeks/months) and should reference concrete numbers from them, not vague encouragement. Keep " +
  "replies under 80 words, plain text, no markdown headers. Never invent a number that isn't in " +
  "the stats you were given. Don't give medical, injury, or academic-integrity advice — for " +
  "anything specific beyond general encouragement, suggest they consult a professional.";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  let question: string | undefined;
  try {
    const body = (await request.json()) as { question?: string };
    question = body.question?.trim().slice(0, 500) || undefined;
  } catch {
    // No body is fine — the proactive weekly insight sends none.
  }

  const [{ data: categories }, { data: sessions }, { data: settingsRow }] = await Promise.all([
    supabase.from("categories").select("id, name, active").eq("user_id", userId),
    supabase.from("sessions").select("category_id, date, duration_minutes").eq("user_id", userId),
    supabase.from("settings").select("data").eq("user_id", userId).maybeSingle(),
  ]);

  // Daily rate limit, enforced server-side (a client-side cap is trivially
  // bypassed). Read-modify-write here is fine even under a race — worst case
  // a couple of concurrent requests both land under the cap, which is a
  // non-issue for a rate limit (unlike settings.saveSettings, nothing here
  // needs the stricter serialized-write guarantee).
  const today = new Date().toISOString().slice(0, 10);
  const settingsData = settingsRow?.data ?? {};
  const callsToday = settingsData.coach_calls_date === today ? (settingsData.coach_calls_count ?? 0) : 0;
  if (callsToday >= MAX_CALLS_PER_DAY) {
    return NextResponse.json({ error: "Daily coach limit reached — try again tomorrow." }, { status: 429 });
  }
  await supabase
    .from("settings")
    .update({ data: { ...settingsData, coach_calls_date: today, coach_calls_count: callsToday + 1 } })
    .eq("user_id", userId);

  const context = buildCoachContext(categories ?? [], sessions ?? [], settingsRow?.data);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Coach not configured" }, { status: 503 });

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: question
          ? `My stats:\n${context}\n\nMy question: ${question}`
          : `My stats:\n${context}\n\nGive me a short, specific insight about how I'm doing — one or two sentences, referencing an actual number from my stats.`,
      },
    ],
  });

  const reply = response.content.find((b) => b.type === "text")?.text ?? "";
  return NextResponse.json({ reply });
}
