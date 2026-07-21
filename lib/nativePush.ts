"use client";

// Native (Android/iOS) push notifications via Firebase Cloud Messaging,
// registered through @capacitor/push-notifications. Parallel to
// lib/pushNotifications.ts's web-push flow (same explicit "Turn on" UX,
// same reminder use case) but a separate delivery path server-side — see
// fcm_tokens in supabase/native-push.sql vs. push_subscriptions.

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getSupabase } from "@/lib/supabaseClient";

async function authHeader(): Promise<Record<string, string>> {
  const token = (await getSupabase()!.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useNativePushSubscribed(): { subscribed: boolean | null; refresh: () => void } {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  // Every setSubscribed call happens inside a .then()/.catch(), never
  // synchronously in the effect body — same reasoning as usePushSubscribed
  // in lib/pushNotifications.ts.
  function check() {
    Promise.resolve()
      .then(() => {
        if (!Capacitor.isNativePlatform()) throw new Error("not native");
        return PushNotifications.checkPermissions();
      })
      .then((p) => setSubscribed(p.receive === "granted"))
      .catch(() => setSubscribed(false));
  }

  useEffect(check, []);

  return { subscribed, refresh: check };
}

export function useEnableNativePush() {
  return useMutation({
    mutationFn: async () => {
      if (!Capacitor.isNativePlatform()) throw new Error("Not available");
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== "granted") throw new Error("Notification permission denied");

      const token = await new Promise<string>((resolve, reject) => {
        PushNotifications.addListener("registration", (t) => {
          PushNotifications.removeAllListeners();
          resolve(t.value);
        });
        PushNotifications.addListener("registrationError", (err) => {
          PushNotifications.removeAllListeners();
          reject(new Error(err.error || "Registration failed"));
        });
        PushNotifications.register();
      });

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/push/register-native", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ token, timezone }),
      });
      if (!res.ok) throw new Error("Could not save your device token");
    },
  });
}

export function useDisableNativePush() {
  return useMutation({
    mutationFn: async () => {
      if (!Capacitor.isNativePlatform()) return;
      await PushNotifications.unregister();
      await fetch("/api/push/unregister-native", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
      });
    },
  });
}
