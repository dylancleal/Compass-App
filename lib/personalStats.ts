import type { Session } from "@/lib/types";
import { daysBetween, todayKey } from "./date";

export interface PersonalSessionStats {
  count: number;             // number of recent sessions used
  avgDurationMin: number;    // weighted average duration
  preferredType: string | undefined;
  hasEnoughData: boolean;    // true once >= 5 sessions recorded
}

// Duration-feel feedback weights: "too_much" pulls the average shorter,
// "too_short" pushes it longer, so future blends converge toward "just_right".
const FEEL_WEIGHT: Record<string, number> = {
  too_short: 1.3,
  just_right: 1.0,
  too_much: 0.7,
};

export function getPersonalStats(sessions: Session[], categoryId: string): PersonalSessionStats {
  const today = todayKey();
  const relevant = sessions
    .filter((s) => s.category_id === categoryId && s.duration_minutes)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
    .slice(0, 20);

  if (relevant.length === 0) {
    return { count: 0, avgDurationMin: 0, preferredType: undefined, hasEnoughData: false };
  }

  let totalWeight = 0;
  let weightedDuration = 0;
  const typeCounts: Record<string, number> = {};

  for (const s of relevant) {
    const daysAgo = daysBetween(s.date, today);
    // Exponential recency decay with 14-day half-life.
    const recencyWeight = Math.exp((-daysAgo * Math.LN2) / 14);
    const feel = (s.payload?.feedback as { duration_feel?: string } | undefined)?.duration_feel;
    const feelWeight = feel ? (FEEL_WEIGHT[feel] ?? 1.0) : 0.85;

    const w = recencyWeight * feelWeight;
    weightedDuration += (s.duration_minutes ?? 0) * w;
    totalWeight += w;
    typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
  }

  const avgDurationMin = totalWeight > 0 ? Math.round(weightedDuration / totalWeight) : 0;
  const preferredType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    count: relevant.length,
    avgDurationMin,
    preferredType,
    hasEnoughData: relevant.length >= 5,
  };
}

// Blend science baseline with personal average.
// Below 5 sessions: pure science. Above 5: 40% science, 60% personal.
// Then scale by readiness (mental score 1–5: 0.7× to 1.0×).
export function blendedDuration(
  scienceMin: number,
  personal: PersonalSessionStats,
  mental: number,
): number {
  const base = personal.hasEnoughData
    ? Math.round(0.4 * scienceMin + 0.6 * personal.avgDurationMin)
    : scienceMin;

  // mental 1 → 0.70×, mental 5 → 1.00×
  const modifier = 0.7 + (0.3 * (mental - 1)) / 4;
  return Math.round(base * modifier);
}
