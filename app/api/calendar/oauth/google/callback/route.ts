import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/tokenCrypto";
import { getServiceSupabase } from "@/lib/supabaseService";
import { runGoogleSync } from "@/lib/googleSync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const base = process.env.OAUTH_REDIRECT_BASE_URL!;

  if (oauthError) return NextResponse.redirect(`${base}/settings?oauth_error=denied`);
  if (!code || !state) return NextResponse.redirect(`${base}/settings?oauth_error=missing`);

  // Validate PKCE state cookie.
  const cookieStore = await cookies();
  const raw = cookieStore.get("google_oauth_pending")?.value;
  if (!raw) return NextResponse.redirect(`${base}/settings?oauth_error=expired`);

  let pending: { state: string; codeVerifier: string; userId: string };
  try {
    pending = JSON.parse(raw) as typeof pending;
  } catch {
    return NextResponse.redirect(`${base}/settings?oauth_error=invalid`);
  }

  if (pending.state !== state) return NextResponse.redirect(`${base}/settings?oauth_error=csrf`);
  cookieStore.delete("google_oauth_pending");

  // Exchange auth code for tokens.
  const redirectUri = `${base}/api/calendar/oauth/google/callback`;
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: pending.codeVerifier,
    }),
  });

  if (!tokenResp.ok) return NextResponse.redirect(`${base}/settings?oauth_error=token`);
  const tokens = await tokenResp.json();

  // Decode the id_token JWT payload to get the account email.
  let accountEmail = "";
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from((tokens.id_token as string).split(".")[1], "base64url").toString()
      ) as { email?: string };
      accountEmail = payload.email ?? "";
    } catch {}
  }

  const sb = getServiceSupabase();

  // Create a calendar_connections row.
  const { data: conn, error: connErr } = await sb
    .from("calendar_connections")
    .insert({
      user_id: pending.userId,
      provider: "google",
      label: accountEmail ? `Google (${accountEmail})` : "Google Calendar",
      enabled: true,
      account_email: accountEmail,
    })
    .select()
    .single();

  if (connErr || !conn) return NextResponse.redirect(`${base}/settings?oauth_error=db`);

  // Persist encrypted tokens.
  await sb.from("calendar_oauth_tokens").insert({
    connection_id: (conn as { id: string }).id,
    user_id: pending.userId,
    provider: "google",
    access_token: encrypt(tokens.access_token as string),
    refresh_token: encrypt(tokens.refresh_token as string),
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in as number) * 1000).toISOString(),
    scope: tokens.scope,
    account_email: accountEmail,
  });

  // Kick off initial sync (best-effort — don't block the redirect on failure).
  try {
    await runGoogleSync((conn as { id: string }).id);
  } catch {}

  return NextResponse.redirect(`${base}/settings?oauth_connected=google`);
}
