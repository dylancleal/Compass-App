// Resolver: takes a session template from the library, applies matching variants
// for the given context, and returns a resolved SessionStructure + final type name.
// Replaces getScienceForSession / getGymSessionForExperience / getTennisSessionForUTR.

import type { SessionTemplate, SessionVariant } from "@/lib/types";
import type { SessionStructure } from "@/lib/science";
import { BUILTIN_LIBRARY } from "@/lib/science/library";

export interface ResolveContext {
  experience?: "beginner" | "intermediate" | "advanced";
  level?: number;       // UTR for tennis; generic numeric level otherwise
  deadlineDays?: number;
  lowWellbeing?: boolean;
}

const FALLBACK: SessionStructure = {
  durationMin: 45,
  plan: [
    "Set one clear outcome for this session before you start — what's 'done'?",
    "25 min focused block: close notifications, one thing only",
    "5 min break — stand up, step away from the screen",
    "Note one thing that worked and one thing to do differently next time",
  ],
  cite: "Newport (2016). Deep Work. Grand Central Publishing.",
  whyItWorks:
    "The biggest predictor of productive sessions isn't duration — it's clarity of intent. Defining the outcome before you start turns 45 minutes into focused progress instead of comfortable busyness.",
};

function evalCondition(when: SessionVariant["when"], ctx: ResolveContext): boolean {
  const ctxValue = ctx[when.field];
  if (ctxValue === undefined) return false;

  const { op, value } = when;
  if (op === "eq") return ctxValue === value;

  const num = typeof ctxValue === "number" ? ctxValue : NaN;
  if (isNaN(num)) return false;
  const threshold = typeof value === "number" ? value : NaN;
  if (isNaN(threshold)) return false;

  if (op === "lt") return num < threshold;
  if (op === "lte") return num <= threshold;
  if (op === "gt") return num > threshold;
  if (op === "gte") return num >= threshold;
  return false;
}

interface Resolved {
  sessionType: string;
  durationMin: number;
  plan: string[];
  why: string;
  cite: string;
}

function applyPatch(base: Resolved, patch: SessionVariant["patch"], library: SessionTemplate[], domain: string): Resolved {
  let { sessionType, durationMin, plan, why, cite } = base;

  if (patch.sessionTypeOverride) {
    sessionType = patch.sessionTypeOverride;
    // Pull cite from the override type's template if it exists (no chained re-resolve).
    const overrideTpl = library.find(
      (t) => t.domain === domain && t.session_type === patch.sessionTypeOverride,
    );
    if (overrideTpl) cite = overrideTpl.cite;
  }

  if (patch.durationDelta !== undefined) durationMin = durationMin + patch.durationDelta;
  if (patch.durationFactor !== undefined) durationMin = Math.round(durationMin * patch.durationFactor);

  if (patch.planReplace) {
    plan = patch.planReplace;
  } else {
    if (patch.planPrepend) plan = [...patch.planPrepend, ...plan];
    if (patch.planAppend) plan = [...plan, ...patch.planAppend];
  }

  if (patch.whyReplace) {
    why = patch.whyReplace;
  } else if (patch.whyAppend) {
    why = why + patch.whyAppend;
  }

  return { sessionType, durationMin, plan, why, cite };
}

export function resolveSession(
  library: SessionTemplate[],
  domain: string,
  sessionType: string,
  ctx: ResolveContext,
): { sessionType: string; science: SessionStructure } {
  const src = library.length > 0 ? library : BUILTIN_LIBRARY;

  const tpl =
    src.find((t) => t.domain === domain && t.session_type === sessionType) ??
    src.find((t) => t.domain === domain) ??
    null;

  if (!tpl) {
    return { sessionType, science: FALLBACK };
  }

  let resolved: Resolved = {
    sessionType: tpl.session_type,
    durationMin: tpl.duration_min,
    plan: tpl.plan,
    why: tpl.why,
    cite: tpl.cite,
  };

  for (const variant of tpl.variants ?? []) {
    if (evalCondition(variant.when, ctx)) {
      resolved = applyPatch(resolved, variant.patch, src, domain);
    }
  }

  resolved.durationMin = Math.max(20, Math.round(resolved.durationMin));

  return {
    sessionType: resolved.sessionType,
    science: {
      durationMin: resolved.durationMin,
      plan: resolved.plan,
      cite: resolved.cite,
      whyItWorks: resolved.why,
    },
  };
}
