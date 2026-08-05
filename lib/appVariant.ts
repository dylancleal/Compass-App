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
  /** "classic" = the small compass-emoji + text lockup Compass has always used.
   *  "glow" = a bigger, icon-free wordmark with a soft glow — used where the
   *  brand isn't literally a compass, so the emoji no longer fits. */
  logoStyle: "classic" | "glow";
  /** Short evocative line shown under the welcome title on the sign-in screen.
   *  Undefined = no subheader (Compass's welcome screen is unchanged). */
  heroLine?: string;
  /** Whether to offer "Sign in with Google" for calendar sync. The Google
   *  Cloud project is still in unverified "Testing" mode (capped at 100
   *  manually-added test-user emails), so it only works for known accounts —
   *  showing it to real Lodestone customers would just dead-end them in a
   *  Google warning screen. Compass's own account is already a test user, so
   *  it keeps working there. Flip this back on once verification is done. */
  googleOAuth: boolean;
  /** Contact address shown on the privacy policy and support surfaces.
   *  Kept per-variant so a commercial product's real customers never see the
   *  developer's personal inbox. */
  supportEmail: string;
  /** Short bullet points explaining what the app does, shown on the public
   *  signed-out landing view. Exists so the home page has real content
   *  describing the app's purpose for a visitor who hasn't signed in yet —
   *  including Google's OAuth verification reviewer. */
  pitch: string[];
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
    logoStyle: "classic",
    googleOAuth: true,
    supportEmail: "dylancleal@gmail.com",
    pitch: [
      "A quick daily check-in shapes a personalised plan across everything you track — study, fitness, finances, and more.",
      "Optionally connects to Google Calendar (read-only) so your plan never clashes with what's already on your schedule.",
      "Tracks streaks and progress over time, one check-in at a time.",
    ],
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
    logoStyle: "glow",
    heroLine: "Study, training, and the pull that keeps you on course.",
    googleOAuth: false,
    supportEmail: "mylodestonesupport@gmail.com",
    pitch: [
      "A 30-second daily check-in shapes a personalised plan for uni work and training.",
      "Connects to Google Calendar (read-only) so today's plan never clashes with what's already booked.",
      "Tracks streaks, session history, and progress — with a deeper Trends view on Lodestone Plus.",
    ],
  },
};

function resolveVariantId(): AppVariantId {
  return process.env.NEXT_PUBLIC_APP_VARIANT === "study" ? "study" : "personal";
}

export const APP_VARIANT: AppVariant = VARIANTS[resolveVariantId()];
