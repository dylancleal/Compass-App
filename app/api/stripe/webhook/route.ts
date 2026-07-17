import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getStripe } from "@/lib/stripe";
import { saveSettingsForUser } from "@/lib/serverSettings";
import type { StripeSubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";

// current_period_end now lives per subscription item, not on the
// subscription itself (Stripe API moved it during 2025) — read it off the
// first item rather than the (removed) top-level field.
function periodEnd(subscription: Stripe.Subscription): string | undefined {
  const seconds = subscription.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId) {
        await saveSettingsForUser(supabase, userId, {
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : (session.customer?.id ?? undefined),
          stripe_subscription_id:
            typeof session.subscription === "string"
              ? session.subscription
              : (session.subscription?.id ?? undefined),
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.supabase_user_id;
      if (userId) {
        await saveSettingsForUser(supabase, userId, {
          stripe_subscription_id: subscription.id,
          stripe_subscription_status: subscription.status as StripeSubscriptionStatus,
          stripe_current_period_end: periodEnd(subscription),
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
