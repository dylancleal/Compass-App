import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getStripe } from "@/lib/stripe";
import { getSettingsForUser, saveSettingsForUser } from "@/lib/serverSettings";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const settings = await getSettingsForUser(supabase, userId);
  const origin = new URL(request.url).origin;

  let customerId = settings.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email ?? undefined,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
    await saveSettingsForUser(supabase, userId, { stripe_customer_id: customerId });
  }

  // No subscription_data.trial_period_days — the app's own trial_ends_at
  // (lib/subscription.ts) already covers the free period; a Stripe-side
  // trial too would double it.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { supabase_user_id: userId } },
    success_url: `${origin}/settings?checkout=success`,
    cancel_url: `${origin}/settings?checkout=cancelled`,
  });

  if (!session.url) return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
