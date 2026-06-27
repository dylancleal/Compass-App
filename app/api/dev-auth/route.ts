import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Dev-only endpoint — generates a magic link without sending an email.
// Used by the preview tool to authenticate without inbox access.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (server-side only).
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const email =
    process.env.NEXT_PUBLIC_DEV_EMAIL ?? "dylancleal@gmail.com";

  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set in .env.local" },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // email_otp is the raw OTP that verifyOtp() expects.
  // The `token` param in action_link is a hashed version that only works via redirect.
  return NextResponse.json({ token: data.properties.email_otp, email });
}
