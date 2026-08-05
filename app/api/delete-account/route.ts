import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getStripe } from "@/lib/stripe";
import { getSettingsForUser } from "@/lib/serverSettings";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  // Deleting the Supabase user doesn't touch Stripe — an orphaned
  // subscription would keep billing a deleted account indefinitely.
  // (Play Store subscribers cancel via Play's own subscription
  // management; there's no equivalent server-side hook here.)
  if (process.env.STRIPE_SECRET_KEY) {
    const settings = await getSettingsForUser(supabase, userId);
    if (settings.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(settings.stripe_subscription_id);
      } catch {
        // Already cancelled or gone — fine, proceed with deletion.
      }
    }
  }

  // Every app table has user_id references auth.users(id) on delete
  // cascade (supabase/schema.sql + calendar.sql/push.sql/etc.), so this
  // single call removes categories, sessions, settings, calendar
  // connections/tokens, and push subscriptions with it — no manual
  // per-table cleanup needed.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
