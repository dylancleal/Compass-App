"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// Capacitor's default hardware/gesture back-button behavior only steps
// through the WebView's own history if the *native* WebView considers there
// to be history to go back to — in practice this was inconsistent with the
// app's own client-side routing and just exited straight to the Android home
// screen from any page, including one level deep (Settings, Progress).
//
// Registering our own listener takes full responsibility for the back
// button: step back through browser history (populated correctly by next/link
// navigations) while there's somewhere to go, otherwise exit like a normal
// Android app does when back is pressed from its home screen.
//
// Uses the event's own `canGoBack` (computed natively from the real WebView
// back stack) rather than `window.history.length` — length only ever grows,
// it doesn't decrease when you go back, so a length-based check goes stuck
// "true" forever after the very first in-app navigation: back would work
// once (Settings -> Today) and then do nothing at all on every press after,
// since there was nothing left behind the pointer to go back to.
export default function AndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp().catch(() => {});
      }
    })
      .then((l) => {
        handle = l;
      })
      .catch(() => {
        // Shouldn't happen now that MainActivity.java registers the plugin
        // explicitly, but fail quiet rather than crash if it ever does.
      });
    return () => handle?.remove();
  }, []);

  return null;
}
