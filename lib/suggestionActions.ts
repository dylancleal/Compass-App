"use client";

// Shared accept/unaccept side-effects for a suggestion — extracted from
// Plan.tsx's handleToggle so every screen that can confirm a suggestion
// (the list view, the Lodestone day-timeline, /calendar's "Add all") keeps
// weekly-goal counting (lib/planner.ts's weeklyCount(), which reads
// `sessions`) consistent, regardless of where the accept happened.

import {
  useCreateSession,
  useRemoveSession,
  useSessions,
  useUpdateSuggestion,
} from "@/lib/queries";
import { inferDurationFromBlocks } from "@/lib/sessionInfer";
import type { CalendarBlock, Session, Suggestion } from "@/lib/types";

// Payload discriminator convention:
//   { auto_logged: true, suggestion_id }  — accepting a suggestion (card, ghost, or bulk-confirm)
//   { auto_logged: true, block_id }       — marking a real calendar block done (app/page.tsx toggleBlockDone)
export function findLoggedSessionForSuggestion(
  sessions: Session[],
  suggestionId: string,
): Session | undefined {
  return sessions.find(
    (sess) =>
      (sess.payload as { suggestion_id?: string; auto_logged?: boolean })?.suggestion_id ===
        suggestionId &&
      (sess.payload as { auto_logged?: boolean })?.auto_logged === true,
  );
}

export function useAcceptSuggestion(date: string) {
  const { data: sessions = [] } = useSessions();
  const updateSuggestion = useUpdateSuggestion(date);
  const createSession = useCreateSession();
  const removeSession = useRemoveSession();

  function loggedSessionFor(suggestionId: string) {
    return findLoggedSessionForSuggestion(sessions, suggestionId);
  }

  // opts.durationMin lets a caller pass the actual scheduled length (e.g. a
  // confirmed timeline placement) instead of falling back to
  // inferDurationFromBlocks(...) ?? est_minutes.
  function setAccepted(
    s: Suggestion,
    accepted: boolean,
    opts: { calendarBlocks?: CalendarBlock[]; durationMin?: number } = {},
  ) {
    updateSuggestion.mutate({ id: s.id, patch: { status: accepted ? "accepted" : "pending" } });
    if (!s.category_id || (s.est_minutes ?? 0) === 0) return;

    if (accepted) {
      if (!loggedSessionFor(s.id)) {
        createSession.mutate({
          category_id: s.category_id,
          date: s.date,
          type: s.session_type ?? "Session",
          duration_minutes:
            opts.durationMin ??
            inferDurationFromBlocks(s.category_id, opts.calendarBlocks ?? []) ??
            s.est_minutes,
          payload: { auto_logged: true, suggestion_id: s.id },
        });
      }
    } else {
      const existing = loggedSessionFor(s.id);
      if (existing) removeSession.mutate(existing.id);
    }
  }

  return { setAccepted, loggedSessionFor };
}
