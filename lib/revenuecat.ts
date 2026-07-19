"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { RevenueCatUI, PAYWALL_RESULT } from "@revenuecat/purchases-capacitor-ui";

// Same key for both platforms for now — RevenueCat only has one "app"
// (Android) registered in the dashboard today. Once an iOS app exists there
// too, split this into NEXT_PUBLIC_REVENUECAT_IOS_API_KEY /
// NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY and pick by Capacitor.getPlatform().
const API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;

// Mount once, native-only, once the signed-in user's id is known. Configures
// the SDK with appUserID set to our own Supabase user id ("identified" mode
// from the start) so the webhook's app_user_id is directly usable to update
// that user's settings row — no separate RevenueCat-id-to-Supabase-id
// mapping table needed.
export function useConfigureRevenueCat(userId: string | undefined) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !API_KEY || !userId) return;
    Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => {});
    Purchases.configure({ apiKey: API_KEY, appUserID: userId }).catch(() => {});
  }, [userId]);
}

// Presents RevenueCat's own paywall UI (configured in their dashboard, not
// built here) and reports back whether it resulted in an active entitlement.
// Access itself doesn't flip from this call directly — the webhook updates
// Supabase, which is the single source of truth getAccessLevel() reads from
// (see lib/subscription.ts) — this just gives the webhook a moment to land
// before refetching, so the UI doesn't still show "free" right after a
// successful purchase.
export function usePresentPaywall() {
  const queryClient = useQueryClient();
  return async function presentPaywall(): Promise<boolean> {
    const { result } = await RevenueCatUI.presentPaywall();
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      return true;
    }
    return false;
  };
}

// A native/RevenueCat subscriber's billing relationship lives entirely
// inside Google Play, not Stripe — Stripe's billing portal (used by web
// subscribers) has no record of it at all. RevenueCat's Customer Center
// shows the real cancel/manage/restore options backed by the actual store.
export function usePresentCustomerCenter() {
  const queryClient = useQueryClient();
  return async function presentCustomerCenter(): Promise<void> {
    await RevenueCatUI.presentCustomerCenter();
    // The user may have cancelled/changed plans while in there — refresh
    // once they're back, same reasoning as after presentPaywall().
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };
}
