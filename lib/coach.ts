"use client";

// AI coach (Lodestone paid tier). Mirrors the shape of lib/subscription.ts's
// useStartCheckout: a client hook that hits a server route with the user's
// own Supabase access token, never touching the Anthropic API key client-side.

import { useMutation } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabaseClient";
import { useSaveSettings, useSettings } from "@/lib/queries";
import { startOfWeek, todayKey } from "@/lib/date";

export function useAskCoach() {
  return useMutation({
    mutationFn: async (question?: string): Promise<string> => {
      const token = (await getSupabase()!.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not reach your coach");
      }
      const { reply } = (await res.json()) as { reply: string };
      return reply;
    },
  });
}

// A proactive insight, generated once per ISO week and cached in settings so
// repeat page views don't re-spend a model call against the same week's data.
export function useWeeklyInsight() {
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();
  const askCoach = useAskCoach();
  const thisWeek = startOfWeek(todayKey());
  const cached = settings?.coach_weekly_insight_week === thisWeek ? settings?.coach_weekly_insight : undefined;

  async function generate() {
    const reply = await askCoach.mutateAsync(undefined);
    saveSettings.mutate({ coach_weekly_insight: reply, coach_weekly_insight_week: thisWeek });
    return reply;
  }

  return { cached, generate, isPending: askCoach.isPending, isStale: settings !== undefined && cached === undefined };
}
