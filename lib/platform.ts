"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

// null until resolved. Capacitor's own check is SSR-safe (falls back to
// "web" when there's no window), but resolving it eagerly at module scope
// would still mean the server always renders "web" while the real native
// WebView renders "native" post-hydration — a mismatch. Deferring to an
// effect keeps server and client HTML identical for the first paint; the
// screen swaps in right after mount instead.
export function useIsNativePlatform(): boolean | null {
  const [isNative, setIsNative] = useState<boolean | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => setIsNative(Capacitor.isNativePlatform()));
  }, []);
  return isNative;
}
