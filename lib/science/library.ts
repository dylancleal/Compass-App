// Bundled science library — source of truth for all session templates.
// This is both the DB seed and the in-memory fallback if the DB store is empty.
// Encoded from lib/science.ts; variants encode experience/UTR branching that was
// previously scattered across getGymSessionForExperience / getTennisSessionForUTR.

import type { SessionTemplate } from "@/lib/types";

const BEGINNER_FULLBODY_PLAN = [
  "Squat: 3 × 10 — goblet squat or bodyweight (depth and braced core over load)",
  "Push: 3 × 10 — push-ups or light dumbbell press (full range, controlled descent)",
  "Pull: 3 × 10 — lat pulldown or assisted pull-up (initiate with shoulder blades, not arms)",
  "Hinge: 2 × 10 — Romanian deadlift with light dumbbells (hips back, flat back, slow)",
  "Rest 90 s between sets — form is the goal, adding weight comes later",
];

const BEGINNER_FULLBODY_WHY =
  "Full-body sessions 2–3× per week is optimal for beginners — you build the neuromuscular patterns that transfer to every lift, and each muscle group gets stimulated frequently while you're still recovering well. The compound movements here are the ones you'll use for years. Only add weight when you can complete every rep cleanly.";

const ADVANCED_PLAN_APPEND = [
  "Track total volume (sets × reps × load) and aim to beat it next session",
  "Every 4th week: drop to 60% load, 2 sets per movement — planned deload",
];

const ADVANCED_WHY_APPEND =
  " At advanced level, progressive overload tracking and planned deload weeks are what separate consistent gains from stalling — the body adapts quickly and needs structured variation.";

// Tennis low-UTR variants (< 3) replace the plan with a consistency-first approach
function lowUtrPlan(basePlan: string[]): string[] {
  return [
    "Warm up: 5 min mini-tennis, soft hands, keep every ball in play",
    ...basePlan.slice(0, 2),
    "Finish: rally cross-court until you hit 15 in a row without a miss",
  ];
}

const LOW_UTR_WHY =
  "At this stage, consistency beats technique. Every drill should end with a 'keep it in play' constraint — that feedback loop builds court sense faster than technical coaching alone. Shorter sessions with high contact rates outperform long sessions with lots of standing around.";

const HIGH_UTR_PLAN_APPEND = [
  "Add a pattern constraint: only DTL from the ad side, only CC from the deuce",
  "Last 10 min: competitive points with a specific tactical objective (e.g. force backhand, approach on short ball)",
];

const HIGH_UTR_WHY_APPEND =
  " At your level, tactical intentionality separates training from playing. Each session needs a specific objective beyond just hitting — constrained practice produces the biggest gains in competitive UTR.";

// Gym beginner variant — any Push/Pull/Legs → override to Full body
const GYM_BEGINNER_VARIANT = {
  when: { field: "experience" as const, op: "eq" as const, value: "beginner" },
  patch: {
    sessionTypeOverride: "Full body",
    planReplace: BEGINNER_FULLBODY_PLAN,
    whyReplace: BEGINNER_FULLBODY_WHY,
    durationDelta: -20, // 65 → 45 for Push/Pull; 75-30=45 for Legs
  },
};

// Gym advanced variant — same rotation + volume tracking
const GYM_ADVANCED_VARIANT = {
  when: { field: "experience" as const, op: "eq" as const, value: "advanced" },
  patch: {
    durationDelta: 10,
    planAppend: ADVANCED_PLAN_APPEND,
    whyAppend: ADVANCED_WHY_APPEND,
  },
};

export const BUILTIN_LIBRARY: SessionTemplate[] = [
  // ─── GYM ────────────────────────────────────────────────────────────────────
  {
    id: "gym-push",
    domain: "gym",
    session_type: "Push",
    duration_min: 65,
    plan: [
      "Chest: 4–5 sets · bench press or incline DB press (6–12 reps)",
      "Shoulders: 3–4 sets · overhead press + lateral raises",
      "Triceps: 2–3 sets · pushdowns or close-grip bench",
      "Rest 2–3 min between heavy sets, 60–90 s on isolation",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    why: "10–20 working sets per muscle per week across 2 sessions is the evidence-based hypertrophy sweet spot (Schoenfeld 2017). Push/pull/legs hits each group at the optimal 48–72 h recovery interval, maximising frequency without overtraining.",
    is_builtin: true,
    weekly_default: 3,
    variants: [GYM_BEGINNER_VARIANT, GYM_ADVANCED_VARIANT],
  },
  {
    id: "gym-pull",
    domain: "gym",
    session_type: "Pull",
    duration_min: 65,
    plan: [
      "Back (width): 3–4 sets · pull-ups or lat pulldown",
      "Back (thickness): 3–4 sets · barbell, cable or DB row",
      "Biceps: 2–3 sets · curls (any variation)",
      "Rear delts: 2 sets · face pulls or band pull-aparts (protect your shoulders)",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    why: "Rear delt and external rotator work is the most commonly skipped but is essential for shoulder longevity — especially for students who sit at a desk for hours. Pulling movements also directly improve tennis racket-head speed and serve power.",
    is_builtin: true,
    weekly_default: 3,
    variants: [GYM_BEGINNER_VARIANT, GYM_ADVANCED_VARIANT],
  },
  {
    id: "gym-legs",
    domain: "gym",
    session_type: "Legs",
    duration_min: 75,
    plan: [
      "Quads: 4–5 sets · squat or leg press (6–12 reps)",
      "Hamstrings/glutes: 3–4 sets · Romanian deadlift or leg curl",
      "Calves: 2–3 sets",
      "Budget an extra 10 min — legs need it and are worth it",
    ],
    cite: "Schoenfeld et al. (2017). J Strength Cond Res.",
    why: "Lower body muscles are the largest in the body and respond well to higher volume. Strong legs directly support tennis footwork, court coverage and first-step quickness — this session is doing double duty.",
    is_builtin: true,
    weekly_default: 3,
    variants: [GYM_BEGINNER_VARIANT, GYM_ADVANCED_VARIANT],
  },
  {
    id: "gym-fullbody",
    domain: "gym",
    session_type: "Full body",
    duration_min: 65,
    plan: [
      "Squat pattern: 3 sets (squat or leg press)",
      "Push pattern: 3 sets (bench or OHP)",
      "Pull pattern: 3 sets (row or pull-up)",
      "Hinge: 2–3 sets (deadlift or RDL)",
      "Lighter load · 8–15 reps · maintenance mode, not max effort",
    ],
    cite: "Ralston et al. (2017). Sports Med.",
    why: "Full-body sessions are ideal when weekly frequency drops (exam blocks, travel). Lower per-session volume is offset by hitting each muscle more often, keeping strength and muscle well-maintained.",
    is_builtin: true,
    weekly_default: 3,
  },
  {
    id: "gym-cardio",
    domain: "gym",
    session_type: "Cardio",
    duration_min: 35,
    plan: [
      "5 min easy warm-up",
      "25 min Zone 2 — moderate intensity, you can hold a full conversation",
      "5 min cool-down and stretch",
    ],
    cite: "Garber et al. (2011). Med Sci Sports Exerc. (ACSM guidelines)",
    why: "Zone 2 (60–70% max HR) builds aerobic base and mitochondrial density without meaningfully interfering with strength gains when kept under 30 min. Also directly supports tennis endurance.",
    is_builtin: true,
  },
  {
    id: "gym-mobility",
    domain: "gym",
    session_type: "Mobility",
    duration_min: 30,
    plan: [
      "Hip flexors + quads: 2 min each side (couch stretch or lunge)",
      "Thoracic spine rotation: 10 reps each side",
      "Shoulder openers: wall slides + band pull-aparts, 3 × 15",
      "5 min breathing — diaphragmatic, parasympathetic reset",
    ],
    cite: "Behm & Chaouachi (2011). Eur J Appl Physiol.",
    why: "Regular mobility work improves movement quality and reduces injury risk — particularly hip flexors, which shorten significantly with prolonged sitting. Thoracic mobility is the #1 limiter for both overhead pressing and the tennis serve.",
    is_builtin: true,
  },
  {
    id: "gym-recovery",
    domain: "gym",
    session_type: "Recovery",
    duration_min: 30,
    plan: [
      "10 min light walk, easy bike or swim",
      "Full-body foam roll: 10 min (quads, lats, upper back, calves)",
      "Gentle stretch: 10 min",
      "This should feel almost too easy — that's exactly correct",
    ],
    cite: "Dupuy et al. (2018). Front Physiol.",
    why: "Active recovery increases blood flow to fatigued tissue and clears metabolic waste more effectively than passive rest. It consistently outperforms rest days alone for next-session performance and soreness reduction.",
    is_builtin: true,
  },

  // ─── TENNIS ─────────────────────────────────────────────────────────────────
  {
    id: "tennis-serve",
    domain: "tennis",
    session_type: "Serve",
    duration_min: 40,
    plan: [
      "10 min shadow swings — trophy → contact → pronate (go slow, film if you can)",
      "15 min first serve to zones: T, body, wide — track your make rate",
      "10 min second serve: kick or slice spin only",
      "5 min pressure mode — serve at match score, treat every one as a match point",
    ],
    cite: "Schmidt & Lee (2011). Motor Control and Learning.",
    why: "The serve is the only shot fully under your control. Blocked practice (mechanics first, then targets, then pressure) accelerates motor learning faster than serving in full points. Small make-rate improvements compound dramatically over a season.",
    is_builtin: true,
    weekly_default: 2,
    variants: [
      {
        when: { field: "level", op: "lt", value: 3 },
        patch: {
          durationDelta: -10,
          planReplace: lowUtrPlan([
            "10 min shadow swings — trophy → contact → pronate (go slow, film if you can)",
            "15 min first serve to zones: T, body, wide — track your make rate",
          ]),
          whyReplace: LOW_UTR_WHY,
        },
      },
      {
        when: { field: "level", op: "gte", value: 9 },
        patch: {
          durationDelta: 15,
          planAppend: HIGH_UTR_PLAN_APPEND,
          whyAppend: HIGH_UTR_WHY_APPEND,
        },
      },
    ],
  },
  {
    id: "tennis-forehand",
    domain: "tennis",
    session_type: "Forehand",
    duration_min: 45,
    plan: [
      "10 min cross-court consistency — rally until you hit 20 in a row",
      "15 min directional control: cross → DTL → cross (3-ball pattern, no mistakes allowed)",
      "10 min approach shots — land inside the service box, finish at net",
      "10 min point play starting from mid-court",
    ],
    cite: "Williams & Hodges (2005). Skill Acquisition in Sport.",
    why: "The forehand is hit most in matches — a small technique improvement here has the highest return. Variability practice (changing direction shot to shot) transfers better to matches than pure cross-court consistency drilling.",
    is_builtin: true,
    weekly_default: 2,
    variants: [
      {
        when: { field: "level", op: "lt", value: 3 },
        patch: {
          durationDelta: -10,
          planReplace: lowUtrPlan([
            "10 min cross-court consistency — rally until you hit 20 in a row",
            "15 min directional control: cross → DTL → cross (3-ball pattern, no mistakes allowed)",
          ]),
          whyReplace: LOW_UTR_WHY,
        },
      },
      {
        when: { field: "level", op: "gte", value: 9 },
        patch: {
          durationDelta: 15,
          planAppend: HIGH_UTR_PLAN_APPEND,
          whyAppend: HIGH_UTR_WHY_APPEND,
        },
      },
    ],
  },
  {
    id: "tennis-backhand",
    domain: "tennis",
    session_type: "Backhand",
    duration_min: 45,
    plan: [
      "10 min cross-court backhand — consistency and depth",
      "15 min topspin depth: aim to land near the baseline, not the service line",
      "10 min slice backhand: low, skidding, stays low",
      "10 min backhand return of serve (feed or partner serves at pace)",
    ],
    cite: "Williams & Hodges (2005). Skill Acquisition in Sport.",
    why: "The slice and topspin backhand are different shots and need separate attention. The return of serve is the second most important shot in tennis (after the serve) and is almost never practised in isolation — give it time here.",
    is_builtin: true,
    weekly_default: 2,
    variants: [
      {
        when: { field: "level", op: "lt", value: 3 },
        patch: {
          durationDelta: -10,
          planReplace: lowUtrPlan([
            "10 min cross-court backhand — consistency and depth",
            "15 min topspin depth: aim to land near the baseline, not the service line",
          ]),
          whyReplace: LOW_UTR_WHY,
        },
      },
      {
        when: { field: "level", op: "gte", value: 9 },
        patch: {
          durationDelta: 15,
          planAppend: HIGH_UTR_PLAN_APPEND,
          whyAppend: HIGH_UTR_WHY_APPEND,
        },
      },
    ],
  },
  {
    id: "tennis-volleys",
    domain: "tennis",
    session_type: "Volleys",
    duration_min: 35,
    plan: [
      "5 min mini-tennis at the service line — soft hands, punch the ball",
      "10 min feed volleys: forehand + backhand alternate (keep wrist firm, don't swing)",
      "10 min approach → 2 volleys → overhead pattern (coach or partner feeds)",
      "10 min poaching and angle volleys from the deuce/ad side",
    ],
    cite: "Kovacs (2006). Br J Sports Med.",
    why: "The net game is the most underpractised area for club players. Winning net points in matches creates psychological pressure on your opponent and shortens rallies — both highly favourable for UTR.",
    is_builtin: true,
    weekly_default: 2,
    variants: [
      {
        when: { field: "level", op: "lt", value: 3 },
        patch: {
          durationDelta: -5,
          planReplace: lowUtrPlan([
            "5 min mini-tennis at the service line — soft hands, punch the ball",
            "10 min feed volleys: forehand + backhand alternate (keep wrist firm, don't swing)",
          ]),
          whyReplace: LOW_UTR_WHY,
        },
      },
      {
        when: { field: "level", op: "gte", value: 9 },
        patch: {
          durationDelta: 15,
          planAppend: HIGH_UTR_PLAN_APPEND,
          whyAppend: HIGH_UTR_WHY_APPEND,
        },
      },
    ],
  },
  {
    id: "tennis-match",
    domain: "tennis",
    session_type: "Match",
    duration_min: 90,
    plan: [
      "10 min warm-up: mini-tennis → baseline rallies → first serves",
      "Play competitive sets — best of 3, keep score properly",
      "After: write down 1–2 specific things to drill next session",
    ],
    cite: "Kovacs (2006). Br J Sports Med.",
    why: "Match play is the most direct driver of UTR change. No drill replicates the decision-making and pressure of real points. Competitive play should make up at least 40% of your total tennis time.",
    is_builtin: true,
  },
  {
    id: "tennis-fitness",
    domain: "tennis",
    session_type: "Fitness",
    duration_min: 35,
    plan: [
      "10 min court sprints: T-drill, side shuffle, split-step timing",
      "15 min on-court footwork with ball — feed wide, recover, feed again",
      "10 min agility: direction change on signal or cone patterns",
    ],
    cite: "Kovacs (2007). J Strength Cond Res.",
    why: "First-step quickness and recovery speed after wide balls are the most impactful physical attributes in club tennis. On-court fitness work transfers better than off-court gym cardio for tennis-specific movement.",
    is_builtin: true,
  },

  // ─── UNI / STUDY ────────────────────────────────────────────────────────────
  {
    id: "uni-study",
    domain: "uni",
    session_type: "Study",
    duration_min: 50,
    plan: [
      "Block 1 (25 min): learn with full attention — annotate, question, close distractions",
      "Break (5 min): stand, walk, water — no scrolling, let it process",
      "Block 2 (25 min): close your source and write a summary from memory only",
      "Last 3 min: what's the single idea you'd explain to someone else? Write it down",
    ],
    cite: "Cepeda et al. (2006). Psychol Sci; Roediger & Karpicke (2006). Psychol Sci.",
    why: "Writing a recall summary at the end — not highlighting, not re-reading — is what actually consolidates the session. The break isn't optional: it's when the hippocampus replays and encodes what you just processed. Re-reading the same content is consistently the least effective study strategy in meta-analyses.",
    is_builtin: true,
    weekly_default: 5,
  },
  {
    id: "uni-reading",
    domain: "uni",
    session_type: "Reading",
    duration_min: 45,
    plan: [
      "Skim first (2 min): headings, bold text, diagrams — build the skeleton before the flesh",
      "Active read: for every paragraph, write one question it answers (not a highlight)",
      "Every 15 min: close the page and write what you just covered — no looking back",
      "End: explain the core idea out loud in plain language (Feynman technique)",
    ],
    cite: "Dunlosky et al. (2013). Psychol Sci Public Interest; Chi et al. (1989). Cogn Sci.",
    why: "Passive highlighting is rated the lowest utility strategy in Dunlosky et al.'s large-scale review — it feels productive and accomplishes almost nothing. Elaborative interrogation ('why does this work?') and self-explanation are high-utility and require no extra time, just a different mindset while reading.",
    is_builtin: true,
  },
  {
    id: "uni-problemset",
    domain: "uni",
    session_type: "Problem set",
    duration_min: 60,
    plan: [
      "Attempt every problem for 5+ min before looking anything up — the struggle is literally the learning",
      "Work in mixed order — don't do all of type A before type B (interleaving)",
      "After each problem: write the single key insight that unlocked it",
      "End: which problem type caused the most errors? Note it — that's your next Revision priority",
    ],
    cite: "Kornell & Bjork (2008). J Exp Psychol; Rohrer & Taylor (2007). Eur J Cogn Psychol.",
    why: "The generation effect: attempting to solve something before seeing the answer produces dramatically better memory than reading a worked example. Interleaving feels harder than blocked practice but produces 40–60% better retention and transfer on tests. The difficulty is the signal, not a problem.",
    is_builtin: true,
  },
  {
    id: "uni-revision",
    domain: "uni",
    session_type: "Revision",
    duration_min: 50,
    plan: [
      "Brain-dump (5 min): write everything you know on the topic — no notes, no checking",
      "Check your notes only for gaps — skip anything you already wrote, study only what's missing",
      "10 retrieval questions: past paper, flashcard deck, or self-quiz — no open-book",
      "Mark every question you got wrong or guessed — those are the priority for next session",
    ],
    cite: "Roediger & Karpicke (2006). Psychol Sci; Kornell et al. (2009). J Exp Psychol; Cepeda et al. (2006). Psychol Sci.",
    why: "The testing effect is one of the most replicated findings in cognitive psychology: answering questions about material is dramatically more effective than re-reading it, even if you get the answers wrong. The brain consolidates memories during retrieval, not during review. Error analysis — reviewing what you got wrong — is the highest-yield part of the session.",
    is_builtin: true,
  },
  {
    id: "uni-groupwork",
    domain: "uni",
    session_type: "Group work",
    duration_min: 60,
    plan: [
      "Roles before you start: facilitator, note-taker, timekeeper — assign these, don't assume",
      "Each person explains their understanding first — laptops and notes closed",
      "Map the group's collective gaps: what does nobody know confidently yet?",
      "Each person writes 5 retrieval questions to take home and answer solo after the session",
    ],
    cite: "Johnson & Johnson (2009). Educ Psychol Rev; Chi et al. (2001). J Learn Sci.",
    why: "Explaining a concept to someone else (the protégé effect) forces you to find the holes in your own understanding faster than any solo study method. Unstructured group sessions where people just discuss have near-zero learning benefit — the structure above is what produces the effect.",
    is_builtin: true,
  },
  {
    id: "uni-pastpaper",
    domain: "uni",
    session_type: "Past paper",
    duration_min: 60,
    plan: [
      "Set a timer for exam duration — attempt under real conditions, no notes, no phone",
      "After: grade yourself honestly, annotate each wrong answer with the correct approach",
      "Don't check your notes until you've attempted every question — the mistakes are the data",
      "Note which question types were hardest — those are the priority for your next session",
    ],
    cite: "Roediger & Karpicke (2006). Psychol Sci; Larsen et al. (2009). Med Educ.",
    why: "Timed past papers are the highest-fidelity exam preparation available. Retrieval under time pressure is harder than open-book revision — and harder is more effective. The mistakes you make tell you exactly what to study next, a gap analysis that re-reading notes never provides.",
    is_builtin: true,
  },

  // ─── RUNNING (new domain) ────────────────────────────────────────────────────
  {
    id: "running-easy",
    domain: "running",
    session_type: "Easy run",
    duration_min: 40,
    plan: [
      "5 min brisk walk warm-up — don't skip it, especially for morning runs",
      "30 min easy Zone 2 pace — conversational, nasal breathing if possible",
      "5 min walk cool-down, then 3 min calf and hip flexor stretch",
    ],
    cite: "Seiler & Tønnessen (2009). Int J Sports Physiol Perform; Garber et al. (2011). ACSM.",
    why: "80% of elite runners' volume is easy — Zone 2 builds the aerobic base that makes hard sessions possible. Going too hard on easy days is the most common amateur mistake; it raises fatigue without lifting fitness. Conversational pace is the floor, not the ceiling.",
    is_builtin: true,
    weekly_default: 3,
    variants: [
      {
        when: { field: "experience", op: "eq", value: "beginner" },
        patch: {
          sessionTypeOverride: "Easy run",
          planReplace: [
            "Run 1 min, walk 1 min — repeat 15× (total ~30 min)",
            "Focus on breathing rhythm, not speed — you should be able to speak in sentences",
            "5 min walk cool-down; note how your legs feel after",
            "Add 30 s to each run interval next session if this felt manageable",
          ],
          whyReplace:
            "Run/walk intervals are the evidence-based entry point for new runners — they build aerobic capacity while managing impact load on joints that aren't yet conditioned for continuous running. Injury risk drops dramatically with this approach vs. jumping straight to continuous running.",
        },
      },
    ],
  },
  {
    id: "running-intervals",
    domain: "running",
    session_type: "Intervals",
    duration_min: 45,
    plan: [
      "10 min easy warm-up jog",
      "6–8 × 400 m at 5 km race pace — rest 90 s between each",
      "Feel controlled, not all-out — you should finish each rep feeling like you had one more in you",
      "10 min easy cool-down jog + stretch",
    ],
    cite: "Billat (2001). Sports Med; Seiler & Tønnessen (2009). Int J Sports Physiol Perform.",
    why: "VO₂max intervals are the most time-efficient way to raise aerobic ceiling. 400 m reps at 5 km pace hit the right intensity without the recovery cost of longer reps. The 90 s rest keeps lactate elevated — that's the stimulus, not a rest from it.",
    is_builtin: true,
  },
  {
    id: "running-longrun",
    domain: "running",
    session_type: "Long run",
    duration_min: 75,
    plan: [
      "Start slower than you think you should — the first 15 min should feel trivial",
      "Maintain easy conversational pace throughout — this is not a tempo run",
      "Fuel every 45 min if over 60 min total (gel, banana, or sports drink)",
      "Walk the last 5 min; note any tightness in calves, ITB, or hips immediately after",
    ],
    cite: "Tanaka & Seals (2008). J Physiol; Billat (2001). Sports Med.",
    why: "The long run builds mitochondrial density, fat oxidation, and mental resilience more than any other single session. Pace is irrelevant — duration is the stimulus. Running too hard turns it into a medium effort that generates fatigue without the long-run adaptation.",
    is_builtin: true,
  },
  {
    id: "running-tempo",
    domain: "running",
    session_type: "Tempo",
    duration_min: 45,
    plan: [
      "10 min easy warm-up",
      "20–25 min at comfortably hard pace (roughly 10 km race effort — 'controlled discomfort')",
      "You should be able to say 3–4 words but not hold a conversation",
      "10 min easy cool-down + 5 min stretch",
    ],
    cite: "Daniels (2005). Daniels' Running Formula; Billat (2001). Sports Med.",
    why: "Tempo running raises lactate threshold — the pace you can sustain without accumulating lactate. That threshold is the single strongest predictor of distance race performance. 20–25 min continuous tempo beats broken intervals for threshold adaptation.",
    is_builtin: true,
  },
  {
    id: "running-recovery",
    domain: "running",
    session_type: "Recovery run",
    duration_min: 25,
    plan: [
      "Truly easy — slower than you think (zone 1, heart rate under 130 bpm)",
      "20 min max; this is active recovery, not training",
      "5 min walk + light stretching after",
    ],
    cite: "Dupuy et al. (2018). Front Physiol.",
    why: "A genuine recovery run increases blood flow to repair micro-tears without adding fatigue. The key is staying below 130 bpm — once you exceed that, it stops being recovery and becomes a stimulus that competes with the next hard session.",
    is_builtin: true,
  },

  // ─── SWIMMING (new domain) ───────────────────────────────────────────────────
  {
    id: "swimming-technique",
    domain: "swimming",
    session_type: "Technique",
    duration_min: 40,
    plan: [
      "200 m easy warm-up, any stroke",
      "Drills: 4 × 50 m catch-up drill (freestyle) focusing on full extension before pull",
      "4 × 50 m with a pull buoy — arms only, feel the catch and high elbow",
      "4 × 50 m full stroke applying the drill cues — rest 30 s between each",
      "200 m easy cool-down",
    ],
    cite: "Maglischo (2003). Swimming Fastest; Toussaint & Beek (1992). Med Sci Sports Exerc.",
    why: "In swimming, technique is everything — poor mechanics waste effort that should propel you forward. The catch (high elbow, fingertips down) is the single highest-return technical focus for improving efficiency. Drills isolate it before full-stroke practice transfers it.",
    is_builtin: true,
    weekly_default: 2,
  },
  {
    id: "swimming-endurance",
    domain: "swimming",
    session_type: "Endurance",
    duration_min: 45,
    plan: [
      "300 m easy warm-up",
      "Main set: 3 × 300 m at steady aerobic pace — 30 s rest between",
      "Focus on maintaining stroke rate, not slowing in the last 50 m",
      "200 m easy cool-down with backstroke or choice",
    ],
    cite: "Maglischo (2003). Swimming Fastest.",
    why: "Sustained aerobic sets build the base all other swimming improvements rest on. Holding stroke mechanics when tired is the practical skill — it's why the last 50 m of each rep matters more than the first.",
    is_builtin: true,
  },
  {
    id: "swimming-sprints",
    domain: "swimming",
    session_type: "Sprints",
    duration_min: 35,
    plan: [
      "300 m easy warm-up",
      "8 × 25 m sprint at max effort — full rest between each (60 s)",
      "Don't sacrifice technique for speed — inefficient sprinting builds bad habits",
      "200 m easy cool-down",
    ],
    cite: "Maglischo (2003). Swimming Fastest; Toussaint & Beek (1992). Med Sci Sports Exerc.",
    why: "Short sprint sets develop neuromuscular power and stroke rate. Full rest between reps is essential — these aren't intervals, they're true sprints. Fatigue changes the motor pattern you're trying to groove.",
    is_builtin: true,
  },
  {
    id: "swimming-recovery",
    domain: "swimming",
    session_type: "Recovery swim",
    duration_min: 25,
    plan: [
      "600–800 m easy, choice of stroke",
      "Breathing focus only — long exhale underwater, relaxed stroke",
      "No sets, no timings — this is movement, not training",
    ],
    cite: "Dupuy et al. (2018). Front Physiol.",
    why: "Water's hydrostatic pressure and horizontal position actively promote blood flow and reduce delayed-onset soreness — a recovery swim is physiologically more effective than a rest day for most people.",
    is_builtin: true,
  },

  // ─── GENERIC (any custom category) ──────────────────────────────────────────
  {
    id: "generic-session",
    domain: "generic",
    session_type: "Session",
    duration_min: 45,
    plan: [
      "Set one clear outcome for this session before you start — what's 'done'?",
      "25 min focused block: close notifications, one thing only",
      "5 min break — stand up, step away from the screen",
      "Note one thing that worked and one thing to do differently next time",
    ],
    cite: "Newport (2016). Deep Work. Grand Central Publishing.",
    why: "The biggest predictor of productive sessions isn't duration — it's clarity of intent. Defining the outcome before you start turns 45 minutes into focused progress instead of comfortable busyness.",
    is_builtin: true,
  },
];
