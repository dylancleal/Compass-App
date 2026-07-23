"use client";

// Shared accept/unaccept side-effects for a suggestion — extracted from
// Plan.tsx's handleToggle so every screen that can confirm a suggestion
// (the list view, the Lodestone day-timeline, /calendar's "Add all") keeps
// weekly-goal counting (lib/planner.ts's weeklyCount(), which reads
// `sessions`) consistent, regardless of where the accept happened.

import {
  useCreateCalendarBlock,
  useCreateSession,
  useRemoveSession,
  useSessions,
  useUpdateSuggestion,
} from "@/lib/queries";
import { inferDurationFromBlocks } from "@/lib/sessionInfer";
import type { PlacedIntention } from "@/lib/schedule";
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
  //
  // Returns a Promise and awaits each mutation via mutateAsync (rather than
  // fire-and-forget .mutate()) so a caller confirming several suggestions in
  // a loop (DayTimeline's "Add all", /calendar's bulk confirm) can await
  // each one fully before starting the next — concurrent .mutate() calls
  // sharing the same mutation hook instance can silently drop a later call's
  // per-call onSuccess, which was leaving some suggestions stuck "pending"
  // forever even though their calendar block had already been created.
  async function setAccepted(
    s: Suggestion,
    accepted: boolean,
    opts: { calendarBlocks?: CalendarBlock[]; durationMin?: number } = {},
  ) {
    await updateSuggestion.mutateAsync({ id: s.id, patch: { status: accepted ? "accepted" : "pending" } });
    if (!s.category_id || (s.est_minutes ?? 0) === 0) return;

    if (accepted) {
      if (!loggedSessionFor(s.id)) {
        await createSession.mutateAsync({
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
      if (existing) await removeSession.mutateAsync(existing.id);
    }
  }

  return { setAccepted, loggedSessionFor };
}

// A suggestion's text packs a header (and maybe a "Task:" line) followed by
// "· " bullet steps — extracted from Plan.tsx's SuggestionCard so any other
// view showing a suggestion (DayTimeline's ghost detail view) renders the
// same headline/steps split instead of a second copy of this parsing.
export function parseSuggestionText(text: string): { headerLines: string[]; steps: string[] } {
  const lines = text.split("\n");
  const headerLines = lines.filter((l) => !l.trimStart().startsWith("·"));
  const steps = lines
    .filter((l) => l.trimStart().startsWith("·"))
    .map((l) => l.replace(/^\s*·\s*/, ""));
  return { headerLines, steps };
}

// Turns a scheduled ghost placement into a real calendar block, then accepts
// its source suggestion — shared by DayTimeline, /calendar's bulk confirm,
// and TaskList's inline suggestion rows, so there's exactly one place doing
// the awaited create-then-accept sequence (see setAccepted's comment above
// for why this has to be awaited, not fire-and-forget, when confirming more
// than one placement in a row).
export function useConfirmPlacement(date: string) {
  const acceptSuggestion = useAcceptSuggestion(date);
  const createBlock = useCreateCalendarBlock();

  return async function confirmPlacement(p: PlacedIntention, suggestions: Suggestion[]) {
    await createBlock.mutateAsync({
      title: p.title,
      category_id: p.category_id,
      task_id: p.task_id,
      start_at: p.start_at,
      end_at: p.end_at,
      source: "compass",
      busy: true,
      status: "planned",
    });
    const s = suggestions.find((sugg) => sugg.id === p.id);
    if (s) await acceptSuggestion.setAccepted(s, true, { durationMin: p.durationMin });
  };
}
