// Single knob that lets this one codebase run as either the full personal
// "Compass" build or a narrowed, commercial "Lodestone" build (study + gym
// only) — switched by an env var at deploy time. No fork, no second repo:
// a bug fix or planner improvement lands in both products at once.
//
// Unset (or anything other than "study") resolves to "personal", so the
// existing Compass deployment needs zero configuration changes to keep
// working exactly as it does today.
//
// NEXT_PUBLIC_ vars are inlined at build time by Next.js, so this module is
// safe to import from both server and client components.

export type AppVariantId = "personal" | "study";

export interface AppVariant {
  id: AppVariantId;
  name: string;
  shortName: string;
  tagline: string;
  welcomeTitle: string;
  themeColor: string;
  backgroundColor: string;
  /** Category names the onboarding tile-picker offers. null = show everything. */
  onboardingTiles: string[] | null;
}

const VARIANTS: Record<AppVariantId, AppVariant> = {
  personal: {
    id: "personal",
    name: "Compass",
    shortName: "Compass",
    tagline: "An affirming to-do list and life tracker.",
    welcomeTitle: "Welcome to Compass",
    themeColor: "#3e6b54",
    backgroundColor: "#f4f1ea",
    onboardingTiles: null,
  },
  study: {
    id: "study",
    name: "Lodestone",
    shortName: "Lodestone",
    tagline: "A calm daily companion for study and training.",
    welcomeTitle: "Welcome to Lodestone",
    themeColor: "#3e6b54",
    backgroundColor: "#f4f1ea",
    onboardingTiles: ["Uni work", "Gym"],
  },
};

function resolveVariantId(): AppVariantId {
  return process.env.NEXT_PUBLIC_APP_VARIANT === "study" ? "study" : "personal";
}

export const APP_VARIANT: AppVariant = VARIANTS[resolveVariantId()];
