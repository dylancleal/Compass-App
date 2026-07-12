"use client";

// Generates and persists the day's suggestions once a check-in exists —
// extracted from Plan.tsx so both the list view and the Lodestone day-
// timeline (which don't share a parent component) trigger generation the
// same way. Each caller fetches its own copies of these via React Query,
// same pattern Plan.tsx and app/page.tsx already use elsewhere — the cache
// dedupes the actual network requests.

import { useEffect, useRef } from "react";
import {
  useCalendarBlocks,
  useCategories,
  useCheckin,
  useSaveSuggestions,
  useSessions,
  useSessionTemplates,
  useSettings,
  useSuggestions,
  useTasks,
} from "@/lib/queries";
import { buildPlan } from "@/lib/planner";
import { BUILTIN_LIBRARY } from "@/lib/science/library";

export function useGeneratePlan(today: string) {
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useSessions();
  const { data: settings } = useSettings();
  const { data: checkin } = useCheckin(today);
  const { data: templates } = useSessionTemplates();
  const library = templates ?? BUILTIN_LIBRARY;
  const { data: suggestions = [], isLoading } = useSuggestions(today);
  const { data: calendarBlocks = [] } = useCalendarBlocks(
    `${today}T00:00:00.000Z`,
    `${today}T23:59:59.999Z`,
  );
  const save = useSaveSuggestions();
  const generatedRef = useRef(false);

  useEffect(() => {
    if (!settings || !checkin || isLoading) return;
    if (generatedRef.current) return;
    if (suggestions.length > 0) return;
    generatedRef.current = true;
    const draft = buildPlan({ date: today, checkin, categories, tasks, sessions, settings, calendarBlocks, library });
    save.mutate({ date: today, items: draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, checkin, isLoading, suggestions.length]);
}
