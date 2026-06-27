// Science helpers retained by the planner (rotation logic, skill weights, skill list).
// Session structures and variants have moved to lib/science/library.ts (Phase 4).
// The resolver (lib/science/resolve.ts) replaces getScienceForSession,
// getGymSessionForExperience, and getTennisSessionForUTR.

export interface SessionStructure {
  durationMin: number;
  plan: string[];
  cite: string;
  whyItWorks: string;
}

// ─── GYM ────────────────────────────────────────────────────────────────────

export const GYM_ROTATION: Record<string, string> = {
  Push: "Pull",
  Pull: "Legs",
  Legs: "Push",
  "Full body": "Push",
  Cardio: "Push",
  Mobility: "Push",
  Recovery: "Push",
};

// ─── TENNIS ─────────────────────────────────────────────────────────────────

export const TENNIS_SKILLS = ["Serve", "Forehand", "Backhand", "Volleys"] as const;
export type TennisSkill = (typeof TENNIS_SKILLS)[number];

export function getNextGymType(lastType: string): string {
  return GYM_ROTATION[lastType] ?? "Push";
}

// ─── Skill priority by UTR ────────────────────────────────────────────────────

export function getUTRSkillWeights(utr: number | undefined): Record<string, number> {
  if (!utr || utr < 3) {
    return { Forehand: 1.4, Backhand: 1.4, Serve: 0.8, Volleys: 0.4, Match: 0.2, Fitness: 0.8 };
  }
  if (utr >= 9) {
    return { Forehand: 1.0, Backhand: 1.0, Serve: 1.4, Volleys: 1.3, Match: 1.5, Fitness: 1.1 };
  }
  return { Forehand: 1.0, Backhand: 1.0, Serve: 1.0, Volleys: 1.0, Match: 1.0, Fitness: 1.0 };
}
