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
export default function AndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return null;
}
