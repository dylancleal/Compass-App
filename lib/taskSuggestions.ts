// Quick-add task suggestions: personalize from the user's own recurring task
// titles once there's a real repeat signal, and otherwise draw from the same
// built-in session-type content the planner already uses (lib/science/library.ts
// — "Push", "Pull", "Legs", "Reading", "Problem set", etc.) so a suggested
// task is never a made-up label disconnected from the rest of the app. Only
// a handful of domains (finance/job/social) have no library content — those
// keep a small hand-written fallback.

import { detectDomain, type Domain } from "@/lib/categorySetup";
import { BUILTIN_LIBRARY } from "@/lib/science/library";

const FALLBACK_SUGGESTIONS: Partial<Record<Domain, string[]>> = {
  finance: ["Review this month's spending", "Update the budget", "Check savings progress"],
  job: ["Update resume", "Apply to a role", "Prep for an interview"],
  social: ["Message a friend to catch up", "Plan a get-together", "Call family"],
  generic: ["Plan next step", "Review progress", "Do something small today"],
};

function librarySessionTypes(domain: Domain): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of BUILTIN_LIBRARY) {
    if (t.domain !== domain || seen.has(t.session_type)) continue;
    seen.add(t.session_type);
    out.push(t.session_type);
  }
  return out;
}

function domainSuggestions(domain: Domain): string[] {
  const fromLibrary = librarySessionTypes(domain);
  if (fromLibrary.length > 0) return fromLibrary;
  return FALLBACK_SUGGESTIONS[domain] ?? FALLBACK_SUGGESTIONS.generic!;
}

const normalize = (s: string) => s.trim().toLowerCase();

// pastTasks should include completed tasks too — a title someone's added
// (and finished) more than once is the strongest signal of a real recurring
// task, stronger than an open task sitting untouched.
export function suggestTasks(
  categoryName: string,
  pastTasks: { title: string }[],
  excludeTitles: string[] = [],
): string[] {
  const exclude = new Set(excludeTitles.map(normalize));

  const freq = new Map<string, { count: number; display: string }>();
  for (const t of pastTasks) {
    const key = normalize(t.title);
    if (!key || exclude.has(key)) continue;
    const existing = freq.get(key);
    if (existing) existing.count++;
    else freq.set(key, { count: 1, display: t.title.trim() });
  }

  // Only surfaced once something's been added at least twice — a single
  // one-off task isn't a pattern worth suggesting back.
  const recurring = [...freq.values()]
    .filter((v) => v.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((v) => v.display);

  const domain = detectDomain(categoryName);
  const seen = new Set(recurring.map(normalize));
  const defaults = domainSuggestions(domain).filter((d) => {
    const key = normalize(d);
    if (exclude.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...recurring, ...defaults];
}
