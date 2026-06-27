import type { CalendarBlock, Session } from "@/lib/types";
import { daysBetween } from "@/lib/date";

// Returns the real duration (minutes) of a calendar block matching the given
// category on today's date. Preferred over the science estimate because it's
// the actual time spent. Returns undefined if no matching block exists.
export function inferDurationFromBlocks(
  categoryId: string | undefined,
  blocks: CalendarBlock[],
): number | undefined {
  if (!categoryId) return undefined;
  const match = blocks.find(
    (b) => b.category_id === categoryId && !b.all_day && b.busy,
  );
  if (!match) return undefined;
  const mins = Math.round(
    (new Date(match.end_at).getTime() - new Date(match.start_at).getTime()) / 60_000,
  );
  return mins > 0 ? mins : undefined;
}

// Returns true when the LogSheet should surface the skill-confidence question.
// Prompt only if:
//  • No skill_confidence has been logged for this skill in the last 7 days, OR
//  • It's the 3rd+ session of that skill since the last rating.
// This prevents the question appearing every single tennis session.
export function shouldPromptSkillConfidence(
  sessions: Session[],
  categoryId: string,
  skill: string,
  today: string,
): boolean {
  const skillSessions = sessions
    .filter((s) => s.category_id === categoryId && s.type === skill)
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (skillSessions.length === 0) return true;

  const lastRatedIndex = skillSessions.findIndex(
    (s) =>
      (s.payload?.feedback as { skill_confidence?: number } | undefined)
        ?.skill_confidence !== undefined,
  );

  if (lastRatedIndex === -1) return true; // never rated

  const daysSinceRating = daysBetween(skillSessions[lastRatedIndex].date, today);
  if (daysSinceRating >= 7) return true;

  // 3rd+ session of this skill since the last rating
  return lastRatedIndex >= 3;
}
