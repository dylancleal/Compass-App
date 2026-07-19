import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getServiceSupabase } from "@/lib/supabaseService";
import { saveSettingsForUser } from "@/lib/serverSettings";

export const runtime = "nodejs";

// Must match the entitlement identifier configured in the RevenueCat
// dashboard (Entitlements → identifier), not a product/offering name.
const PAID_ENTITLEMENT = "Lodestone Pro";

// Constant-time comparison — a plain `===` on the raw header leaks timing
// info about how many leading characters matched, same class of bug that
// Stripe's SDK-provided signature check (lib/stripe.ts's webhook route)
// avoids for free. crypto.timingSafeEqual throws on mismatched lengths, so
// that's checked first (safe to leak length — it doesn't help a real attacker).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number;
}

export async function POST(request: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }
  // RevenueCat's dashboard field just says "set an authorization header that
  // will be sent with each request" — whatever string is pasted there is
  // sent verbatim, no implied "Bearer " prefix — so this compares raw
  // against raw. Paste the exact same value into both places.
  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const event = body?.event as RevenueCatEvent | undefined;
  // app_user_id is always the Supabase user id — Purchases.configure() is
  // called with appUserID set to it (see lib/revenuecat.ts), so there's no
  // separate identity-mapping step needed here.
  if (!event?.app_user_id) return NextResponse.json({ received: true });

  const supabase = getServiceSupabase();

  if (event.type === "REFUND") {
    // Revoke immediately regardless of whatever expiration_at_ms says —
    // the money went back, access shouldn't outlive that.
    await saveSettingsForUser(supabase, event.app_user_id, {
      revenuecat_expires_at: new Date(0).toISOString(),
    });
  } else if (event.entitlement_ids?.includes(PAID_ENTITLEMENT) && event.expiration_at_ms) {
    // Covers INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE,
    // SUBSCRIPTION_EXTENDED, TRANSFER, TEMPORARY_ENTITLEMENT_GRANT — and
    // CANCELLATION, which only turns off auto-renew and does NOT end
    // access early (expiration_at_ms is still the real end of the current
    // paid period). EXPIRATION events naturally resolve to "not paid" once
    // that date passes, via the same > now check every other date field
    // here already uses — no separate "active" flag to keep in sync.
    await saveSettingsForUser(supabase, event.app_user_id, {
      revenuecat_expires_at: new Date(event.expiration_at_ms).toISOString(),
    });
  }

  return NextResponse.json({ received: true });
}
