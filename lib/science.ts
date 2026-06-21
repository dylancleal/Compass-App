// Science-backed session structures for Gym, Tennis and Uni work.
// All recommendations cite peer-reviewed sources so the app can surface
// "why this works" tooltips (SPEC §7). These are the baselines; the planner
// blends them with the user's own trend data before suggesting.

export interface SessionStructure {
  durationMin: number;    // science-recommended baseline
  plan: string[];         // ordered steps shown in the suggestion card
  cite: string;           // short reference string
  whyItWorks: string;     // tooltip / reason body
}

// ─── GYM ────────────────────────────────────────────────────────────────────

// Push → Pull → Legs → repeat. Defaults to Push when no history.
export const GYM_ROTATION: Record<string, string> = {
  Push: "Pull",
  Pull: "Legs",
  Legs: "Push",
  "Full body": "Push",
  Cardio: "Push",
  Mobility: "Push",
  Recovery: "Push",
};

export const GYM_SCIENCE: Record<string, SessionStructure> = {
  Push: {
    durationMin: 65,
    plan: [
      "Chest: 4–5 sets · bench press or incline DB press (6–12 reps)",
      "Shoulders: 3–4 sets · overhead press + lateral raises",
      "Triceps: 2–3 sets · pushdowns or close-grip bench",
      "Rest 2–3 min between heavy sets, 60–90 s on isolation",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    whyItWorks:
      "10–20 working sets per muscle per week across 2 sessions is the evidence-based hypertrophy sweet spot (Schoenfeld 2017). Push/pull/legs hits each group at the optimal 48–72 h recovery interval, maximising frequency without overtraining.",
  },
  Pull: {
    durationMin: 65,
    plan: [
      "Back (width): 3–4 sets · pull-ups or lat pulldown",
      "Back (thickness): 3–4 sets · barbell, cable or DB row",
      "Biceps: 2–3 sets · curls (any variation)",
      "Rear delts: 2 sets · face pulls or band pull-aparts (protect your shoulders)",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    whyItWorks:
      "Rear delt and external rotator work is the most commonly skipped but is essential for shoulder longevity — especially for students who sit at a desk for hours. Pulling movements also directly improve tennis racket-head speed and serve power.",
  },
  Legs: {
    durationMin: 75,
    plan: [
      "Quads: 4–5 sets · squat or leg press (6–12 reps)",
      "Hamstrings/glutes: 3–4 sets · Romanian deadlift or leg curl",
      "Calves: 2–3 sets",
      "Budget an extra 10 min — legs need it and are worth it",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    whyItWorks:
      "Lower body muscles are the largest in the body and respond well to higher volume. Strong legs directly support tennis footwork, court coverage and first-step quickness — this session is doing double duty.",
  },
  "Full body": {
    durationMin: 65,
    plan: [
      "Squat pattern: 3 sets (squat or leg press)",
      "Push pattern: 3 sets (bench or OHP)",
      "Pull pattern: 3 sets (row or pull-up)",
      "Hinge: 2–3 sets (deadlift or RDL)",
      "Lighter load · 8–15 reps · maintenance mode, not max effort",
    ],
    cite: "Ralston et al. (2017). Sports Med.",
    whyItWorks:
      "Full-body sessions are ideal when weekly frequency drops (exam blocks, travel). Lower per-session volume is offset by hitting each muscle more often, keeping strength and muscle well-maintained.",
  },
  Cardio: {
    durationMin: 35,
    plan: [
      "5 min easy warm-up",
      "25 min Zone 2 — moderate intensity, you can hold a full conversation",
      "5 min cool-down and stretch",
    ],
    cite: "Garber et al. (2011). Med Sci Sports Exerc. (ACSM guidelines)",
    whyItWorks:
      "Zone 2 (60–70% max HR) builds aerobic base and mitochondrial density without meaningfully interfering with strength gains when kept under 30 min. Also directly supports tennis endurance.",
  },
  Mobility: {
    durationMin: 30,
    plan: [
      "Hip flexors + quads: 2 min each side (couch stretch or lunge)",
      "Thoracic spine rotation: 10 reps each side",
      "Shoulder openers: wall slides + band pull-aparts, 3 × 15",
      "5 min breathing — diaphragmatic, parasympathetic reset",
    ],
    cite: "Behm & Chaouachi (2011). Eur J Appl Physiol.",
    whyItWorks:
      "Regular mobility work improves movement quality and reduces injury risk — particularly hip flexors, which shorten significantly with prolonged sitting. Thoracic mobility is the #1 limiter for both overhead pressing and the tennis serve.",
  },
  Recovery: {
    durationMin: 30,
    plan: [
      "10 min light walk, easy bike or swim",
      "Full-body foam roll: 10 min (quads, lats, upper back, calves)",
      "Gentle stretch: 10 min",
      "This should feel almost too easy — that's exactly correct",
    ],
    cite: "Dupuy et al. (2018). Front Physiol.",
    whyItWorks:
      "Active recovery increases blood flow to fatigued tissue and clears metabolic waste more effectively than passive rest. It consistently outperforms rest days alone for next-session performance and soreness reduction.",
  },
};

// ─── TENNIS ─────────────────────────────────────────────────────────────────
// Skill-focused session types. Each session centres on one technical area so
// the feedback ("how did it feel?") maps cleanly to a skill and informs future
// suggestions on which skill needs the most attention.

// The rotation logic in the planner scores each skill by how long ago it was
// last practised and how confident the user felt after it — low confidence +
// high neglect = top priority.

export const TENNIS_SKILLS = ["Serve", "Forehand", "Backhand", "Volleys"] as const;
export type TennisSkill = (typeof TENNIS_SKILLS)[number];

export const TENNIS_SCIENCE: Record<string, SessionStructure> = {
  Serve: {
    durationMin: 40,
    plan: [
      "10 min shadow swings — trophy → contact → pronate (go slow, film if you can)",
      "15 min first serve to zones: T, body, wide — track your make rate",
      "10 min second serve: kick or slice spin only",
      "5 min pressure mode — serve at match score, treat every one as a match point",
    ],
    cite: "Schmidt & Lee (2011). Motor Control and Learning.",
    whyItWorks:
      "The serve is the only shot fully under your control. Blocked practice (mechanics first, then targets, then pressure) accelerates motor learning faster than serving in full points. Small make-rate improvements compound dramatically over a season.",
  },
  Forehand: {
    durationMin: 45,
    plan: [
      "10 min cross-court consistency — rally until you hit 20 in a row",
      "15 min directional control: cross → DTL → cross (3-ball pattern, no mistakes allowed)",
      "10 min approach shots — land inside the service box, finish at net",
      "10 min point play starting from mid-court",
    ],
    cite: "Williams & Hodges (2005). Skill Acquisition in Sport.",
    whyItWorks:
      "The forehand is hit most in matches — a small technique improvement here has the highest return. Variability practice (changing direction shot to shot) transfers better to matches than pure cross-court consistency drilling.",
  },
  Backhand: {
    durationMin: 45,
    plan: [
      "10 min cross-court backhand — consistency and depth",
      "15 min topspin depth: aim to land near the baseline, not the service line",
      "10 min slice backhand: low, skidding, stays low",
      "10 min backhand return of serve (feed or partner serves at pace)",
    ],
    cite: "Williams & Hodges (2005). Skill Acquisition in Sport.",
    whyItWorks:
      "The slice and topspin backhand are different shots and need separate attention. The return of serve is the second most important shot in tennis (after the serve) and is almost never practised in isolation — give it time here.",
  },
  Volleys: {
    durationMin: 35,
    plan: [
      "5 min mini-tennis at the service line — soft hands, punch the ball",
      "10 min feed volleys: forehand + backhand alternate (keep wrist firm, don't swing)",
      "10 min approach → 2 volleys → overhead pattern (coach or partner feeds)",
      "10 min poaching and angle volleys from the deuce/ad side",
    ],
    cite: "Kovacs (2006). Br J Sports Med.",
    whyItWorks:
      "The net game is the most underpractised area for club players. Winning net points in matches creates psychological pressure on your opponent and shortens rallies — both highly favourable for UTR.",
  },
  Match: {
    durationMin: 90,
    plan: [
      "10 min warm-up: mini-tennis → baseline rallies → first serves",
      "Play competitive sets — best of 3, keep score properly",
      "After: write down 1–2 specific things to drill next session",
    ],
    cite: "Kovacs (2006). Br J Sports Med.",
    whyItWorks:
      "Match play is the most direct driver of UTR change. No drill replicates the decision-making and pressure of real points. Competitive play should make up at least 40% of your total tennis time.",
  },
  Fitness: {
    durationMin: 35,
    plan: [
      "10 min court sprints: T-drill, side shuffle, split-step timing",
      "15 min on-court footwork with ball — feed wide, recover, feed again",
      "10 min agility: direction change on signal or cone patterns",
    ],
    cite: "Kovacs (2007). J Strength Cond Res.",
    whyItWorks:
      "First-step quickness and recovery speed after wide balls are the most impactful physical attributes in club tennis. On-court fitness work transfers better than off-court gym cardio for tennis-specific movement.",
  },
};

// ─── UNI / STUDY ────────────────────────────────────────────────────────────

// Study session types map to distinct phases of the learning cycle:
//   Reading / Study  →  Building understanding (new material)
//   Problem set      →  Applying knowledge (testing yourself)
//   Revision         →  Consolidating (retrieval practice, pre-assessment)
//   Group work       →  Explaining and teaching (highest-order processing)
//
// The planner chooses the right phase based on deadline proximity,
// mental energy, recency, and session variety.

export const STUDY_SCIENCE: Record<string, SessionStructure> = {
  Study: {
    durationMin: 50,
    plan: [
      "Block 1 (25 min): learn with full attention — annotate, question, close distractions",
      "Break (5 min): stand, walk, water — no scrolling, let it process",
      "Block 2 (25 min): close your source and write a summary from memory only",
      "Last 3 min: what's the single idea you'd explain to someone else? Write it down",
    ],
    cite: "Cepeda et al. (2006). Psychol Sci; Roediger & Karpicke (2006). Psychol Sci.",
    whyItWorks:
      "Writing a recall summary at the end — not highlighting, not re-reading — is what actually consolidates the session. The break isn't optional: it's when the hippocampus replays and encodes what you just processed. Re-reading the same content is consistently the least effective study strategy in meta-analyses.",
  },
  Reading: {
    durationMin: 45,
    plan: [
      "Skim first (2 min): headings, bold text, diagrams — build the skeleton before the flesh",
      "Active read: for every paragraph, write one question it answers (not a highlight)",
      "Every 15 min: close the page and write what you just covered — no looking back",
      "End: explain the core idea out loud in plain language (Feynman technique)",
    ],
    cite: "Dunlosky et al. (2013). Psychol Sci Public Interest; Chi et al. (1989). Cogn Sci.",
    whyItWorks:
      "Passive highlighting is rated the lowest utility strategy in Dunlosky et al.'s large-scale review — it feels productive and accomplishes almost nothing. Elaborative interrogation ('why does this work?') and self-explanation are high-utility and require no extra time, just a different mindset while reading.",
  },
  "Problem set": {
    durationMin: 60,
    plan: [
      "Attempt every problem for 5+ min before looking anything up — the struggle is literally the learning",
      "Work in mixed order — don't do all of type A before type B (interleaving)",
      "After each problem: write the single key insight that unlocked it",
      "End: which problem type caused the most errors? Note it — that's your next Revision priority",
    ],
    cite: "Kornell & Bjork (2008). J Exp Psychol; Rohrer & Taylor (2007). Eur J Cogn Psychol.",
    whyItWorks:
      "The generation effect: attempting to solve something before seeing the answer produces dramatically better memory than reading a worked example. Interleaving feels harder than blocked practice but produces 40–60% better retention and transfer on tests. The difficulty is the signal, not a problem.",
  },
  Revision: {
    durationMin: 50,
    plan: [
      "Brain-dump (5 min): write everything you know on the topic — no notes, no checking",
      "Check your notes only for gaps — skip anything you already wrote, study only what's missing",
      "10 retrieval questions: past paper, flashcard deck, or self-quiz — no open-book",
      "Mark every question you got wrong or guessed — those are the priority for next session",
    ],
    cite: "Roediger & Karpicke (2006). Psychol Sci; Kornell et al. (2009). J Exp Psychol; Cepeda et al. (2006). Psychol Sci.",
    whyItWorks:
      "The testing effect is one of the most replicated findings in cognitive psychology: answering questions about material is dramatically more effective than re-reading it, even if you get the answers wrong. The brain consolidates memories during retrieval, not during review. Error analysis — reviewing what you got wrong — is the highest-yield part of the session.",
  },
  "Group work": {
    durationMin: 60,
    plan: [
      "Roles before you start: facilitator, note-taker, timekeeper — assign these, don't assume",
      "Each person explains their understanding first — laptops and notes closed",
      "Map the group's collective gaps: what does nobody know confidently yet?",
      "Each person writes 5 retrieval questions to take home and answer solo after the session",
    ],
    cite: "Johnson & Johnson (2009). Educ Psychol Rev; Chi et al. (2001). J Learn Sci.",
    whyItWorks:
      "Explaining a concept to someone else (the protégé effect) forces you to find the holes in your own understanding faster than any solo study method. Unstructured group sessions where people just discuss have near-zero learning benefit — the structure above is what produces the effect.",
  },
  "Past paper": {
    durationMin: 60,
    plan: [
      "Set a timer for exam duration — attempt under real conditions, no notes, no phone",
      "After: grade yourself honestly, annotate each wrong answer with the correct approach",
      "Don't check your notes until you've attempted every question — the mistakes are the data",
      "Note which question types were hardest — those are the priority for your next session",
    ],
    cite: "Roediger & Karpicke (2006). Psychol Sci; Larsen et al. (2009). Med Educ.",
    whyItWorks:
      "Timed past papers are the highest-fidelity exam preparation available. Retrieval under time pressure is harder than open-book revision — and harder is more effective. The mistakes you make tell you exactly what to study next, a gap analysis that re-reading notes never provides.",
  },
};

// ─── Lookup helpers ──────────────────────────────────────────────────────────

const FALLBACK: SessionStructure = {
  durationMin: 45,
  plan: ["Log what you do and how it feels — patterns emerge over time."],
  cite: "",
  whyItWorks: "",
};

export function getScienceForSession(
  categoryName: string,
  sessionType: string,
): SessionStructure {
  if (categoryName === "Gym") return GYM_SCIENCE[sessionType] ?? FALLBACK;
  if (categoryName === "Tennis") return TENNIS_SCIENCE[sessionType] ?? FALLBACK;
  if (categoryName === "Uni work") return STUDY_SCIENCE[sessionType] ?? FALLBACK;
  return FALLBACK;
}

export function getNextGymType(lastType: string): string {
  return GYM_ROTATION[lastType] ?? "Push";
}
