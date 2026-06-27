// Rule-based calendar event → category matcher. No AI cost — pure keyword
// and token logic. Runs during sync (server) and ICS import (client).
//
// Three scoring signals, summed per category:
//  1. Category name appears in event title (strongest)
//  2. Category's life-domain keywords appear in event title (medium)
//  3. Existing task titles in that category share words with event (medium)
// Returns the best match above a 0.4 threshold, or null.

import type { Category, Task } from "@/lib/types";

// Domain keyword vocabularies — bridge gap between category name and event title.
// e.g. "Gym" category → domain "gym" → "Leg day" event hits "weights" keyword.
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  gym: [
    "gym", "workout", "weights", "lifting", "cardio", "hiit", "crossfit",
    "push", "pull", "legs", "chest", "back", "shoulders", "arms",
    "squat", "deadlift", "bench", "barbell", "dumbbell", "resistance",
    "strength", "conditioning", "circuit", "session", "rep", "set",
  ],
  tennis: [
    "tennis", "hit", "hitting", "match", "serve", "return", "volley",
    "forehand", "backhand", "court", "rally", "drill", "singles", "doubles",
    "groundstroke", "slice", "topspin",
  ],
  fitness: [
    "swim", "swimming", "run", "running", "jog", "jogging", "cycle", "cycling",
    "bike", "hike", "hiking", "walk", "walking", "yoga", "pilates", "spin",
    "dance", "sport", "athletics", "track", "bootcamp", "martial", "boxing",
    "rugby", "football", "soccer", "basketball", "netball", "cricket",
    "surf", "surfing", "rowing", "climb", "climbing", "pt", "training",
  ],
  education: [
    "lecture", "tutorial", "tute", "class", "seminar", "workshop", "lab",
    "prac", "study", "exam", "test", "quiz", "assignment", "submission",
    "revision", "reading", "research", "project", "essay", "report",
    "thesis", "presentation", "group", "unit", "deakin", "sit", "university",
    "college", "school", "course", "module",
  ],
  work: [
    "meeting", "standup", "stand-up", "sync", "review", "interview",
    "presentation", "client", "sprint", "planning", "retrospective",
    "1:1", "conference", "call", "workshop", "demo", "kickoff", "onboarding",
  ],
  job: [
    "application", "apply", "interview", "resume", "cv", "linkedin",
    "networking", "career", "recruiter", "job", "role", "position",
  ],
  finance: [
    "budget", "finance", "money", "savings", "investment", "tax", "bank",
    "payment", "invoice", "expenses", "accounting",
  ],
  social: [
    "dinner", "lunch", "brunch", "coffee", "drinks", "party", "birthday",
    "catchup", "catch", "hangout", "visit", "date", "family", "friends",
    "celebration", "wedding",
  ],
};

// Map a category name to the domain(s) its keywords belong to.
function categoryDomains(catName: string): string[] {
  const n = catName.toLowerCase();
  const domains: string[] = [];
  if (/gym|weight|lift|strength|bodybuilding/i.test(n)) domains.push("gym");
  if (/tennis/i.test(n)) domains.push("tennis");
  if (/swim|run|jog|cycl|bike|hike|yoga|sport|fitness|athlet|box|martial|rugby|football|soccer|basketball|netball|cricket|surf|row|climb/i.test(n)) domains.push("fitness");
  if (/uni|university|college|school|study|education|academic|course|degree/i.test(n)) domains.push("education");
  if (/job|career|employ|recruit/i.test(n)) domains.push("job");
  if (/work|meeting|office|business|professional/i.test(n)) domains.push("work");
  if (/financ|money|budget|saving|invest|tax/i.test(n)) domains.push("finance");
  if (/social|friend|family|personal/i.test(n)) domains.push("social");
  return domains;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:()[\]{}'"!?/\\]+/)
    .filter((w) => w.length >= 3);
}

export function matchEventToCategory(
  eventTitle: string,
  categories: Category[],
  tasks: Task[],
): { categoryId: string; confidence: number } | null {
  const title = eventTitle.toLowerCase().trim();
  const titleTokens = new Set(tokenize(title));

  let best: { categoryId: string; confidence: number } | null = null;

  for (const cat of categories) {
    if (!cat.active) continue;
    let score = 0;

    // Signal 1 — category name in title (strongest signal)
    const catLower = cat.name.toLowerCase();
    if (title.includes(catLower)) {
      score += 1.0;
    } else {
      for (const ct of tokenize(cat.name)) {
        if (titleTokens.has(ct)) score += 0.4;
      }
    }

    // Signal 2 — domain keyword hit
    const domains = categoryDomains(cat.name);
    for (const domain of domains) {
      const kws = DOMAIN_KEYWORDS[domain] ?? [];
      if (kws.some((kw) => title.includes(kw))) {
        score += 0.5;
        break; // one domain boost per category
      }
    }

    // Signal 3 — overlap with existing task titles for this category
    const catTasks = tasks.filter((t) => t.category_id === cat.id);
    const taskPool = new Set(
      catTasks
        .flatMap((t) => tokenize(t.title))
        .filter((w) => w.length >= 4),
    );
    const taskHits = [...titleTokens].filter((w) => taskPool.has(w)).length;
    if (taskHits > 0) score += Math.min(taskHits * 0.25, 0.5);

    if (score >= 0.4 && (!best || score > best.confidence)) {
      best = { categoryId: cat.id, confidence: Math.min(score, 1) };
    }
  }

  return best;
}

// Events that look like deadlines rather than sessions — show a "📌 task?"
// chip so the user can register them in the task system with one tap.
const DEADLINE_KEYWORDS = [
  "assignment", "due", "deadline", "submit", "submission",
  "exam", "test", "quiz", "project", "essay", "report",
  "presentation", "thesis", "proposal", "hand in", "handin",
  "midsem", "mid-sem", "final", "end-sem",
];

export function isDeadlineLike(eventTitle: string): boolean {
  const lower = eventTitle.toLowerCase();
  return DEADLINE_KEYWORDS.some((kw) => lower.includes(kw));
}
