"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabaseClient";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Tracks whether this browser currently holds a live push subscription —
// separate from Notification.permission, since permission can be "granted"
// while no subscription exists yet (e.g. user granted it, then we failed to
// subscribe, or they cleared site data). Returns a refresh() to re-check
// after enabling/disabling, since there's no browser event for this.
export function usePushSubscribed(): { subscribed: boolean | null; refresh: () => void } {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  // Every setSubscribed call below happens inside a .then()/.catch(), never
  // synchronously in the effect body — folding the "unsupported" case into
  // the same chain (rather than an early-return setState) keeps it that way.
  function checkSubscribed() {
    Promise.resolve()
      .then(() => {
        if (!pushSupported()) throw new Error("unsupported");
        return navigator.serviceWorker.ready;
      })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }

  useEffect(checkSubscribed, []);

  return { subscribed, refresh: checkSubscribed };
}

async function authHeader(): Promise<Record<string, string>> {
  const token = (await getSupabase()!.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useEnablePush() {
  return useMutation({
    mutationFn: async () => {
      if (!pushSupported()) throw new Error("Push notifications aren't supported in this browser");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission denied");

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications not configured");

      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const json = sub.toJSON();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, timezone }),
      });
      if (!res.ok) throw new Error("Could not save your subscription");
    },
  });
}

export function useDisablePush() {
  return useMutation({
    mutationFn: async () => {
      if (!pushSupported()) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ endpoint }),
      });
    },
  });
}
