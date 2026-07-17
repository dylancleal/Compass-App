// Server-only — do not import in client components. Reads/writes a specific
// user's settings row by explicit user_id via the service-role client,
// bypassing RLS. Needed for the Stripe webhook, which has no Supabase
// session to scope an RLS query to (unlike every other server route, which
// verifies a bearer token and can rely on RLS for everything except this).
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultSettings } from "@/lib/db/seed";
import type { AppSettings } from "@/lib/types";

export async function getSettingsForUser(sb: SupabaseClient, userId: string): Promise<AppSettings> {
  const { data } = await sb.from("settings").select("data").eq("user_id", userId).maybeSingle();
  return { ...defaultSettings(), ...(data?.data ?? {}) } as AppSettings;
}

export async function saveSettingsForUser(
  sb: SupabaseClient,
  userId: string,
  patch: Partial<AppSettings>,
): Promise<void> {
  const current = await getSettingsForUser(sb, userId);
  const next = { ...current, ...patch };
  await sb.from("settings").upsert({ user_id: userId, data: next });
}
