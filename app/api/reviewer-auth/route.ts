import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Fixed-code sign-in for the Play Store reviewer account declared in Play
// Console's "Sign in details". Lodestone's real sign-in is email OTP only,
// which reviewers can't receive — this gives the one declared reviewer
// email a permanent, non-expiring code instead (Google's own suggested
// pattern for apps with OTP/2-step sign-in). Gated on PLAY_REVIEWER_CODE,
// a secret unrelated to any real user's credentials.
export async function POST(req: Request) {
  const reviewerEmail = process.env.PLAY_REVIEWER_EMAIL;
  const reviewerCode = process.env.PLAY_REVIEWER_CODE;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!reviewerEmail || !reviewerCode || !serviceKey) {
    return NextResponse.json({ error: "not configured" }, { status: 404 });
  }

  const { code } = await req.json();
  if (code !== reviewerCode) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const admin = createClient(supabaseUrl!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewerEmail,
    options: { redirectTo: "https://mylodestone.app" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token: data.properties.email_otp, email: reviewerEmail });
}
