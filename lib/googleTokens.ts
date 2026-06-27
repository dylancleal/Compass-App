// Server-only — do not import in client components.
import { encrypt, decrypt } from "./tokenCrypto";
import { getServiceSupabase } from "./supabaseService";

export async function getFreshGoogleToken(connectionId: string): Promise<string> {
  const sb = getServiceSupabase();

  const { data: row } = await sb
    .from("calendar_oauth_tokens")
    .select("*")
    .eq("connection_id", connectionId)
    .single();

  if (!row) throw new Error("No OAuth token found for connection");

  // Return cached token if still valid (with 60s buffer).
  if (new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return decrypt(row.access_token as string);
  }

  // Refresh the access token.
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decrypt(row.refresh_token as string),
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    if (body.error === "invalid_grant") {
      // User revoked access — mark both tables and surface reconnect button.
      await Promise.all([
        sb.from("calendar_oauth_tokens").update({ needs_reauth: true }).eq("connection_id", connectionId),
        sb.from("calendar_connections").update({ enabled: false, needs_reauth: true }).eq("id", connectionId),
      ]);
      throw new Error("NEEDS_REAUTH");
    }
    throw new Error(`Token refresh failed: ${(body.error as string) ?? resp.status}`);
  }

  const tokens = await resp.json();
  const update: Record<string, string> = {
    access_token: encrypt(tokens.access_token as string),
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in as number) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  // Google sometimes rotates the refresh token — always persist when present.
  if (tokens.refresh_token) update.refresh_token = encrypt(tokens.refresh_token as string);

  await sb.from("calendar_oauth_tokens").update(update).eq("connection_id", connectionId);
  return tokens.access_token as string;
}
