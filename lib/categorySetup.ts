// Domain detection and setup field config for the CategorySetupSheet.
// Reuses the same domain signals as categoryMatcher so the two stay in sync.

import type { CategoryMetadata } from "@/lib/types";

export type Domain =
  | "gym"
  | "tennis"
  | "uni"
  | "finance"
  | "job"
  | "running"
  | "swimming"
  | "social"
  | "generic";

export function detectDomain(categoryName: string): Domain {
  const n = categoryName.toLowerCase();
  if (/gym|weight|lift|strength|bodybuilding/i.test(n)) return "gym";
  if (/tennis/i.test(n)) return "tennis";
  if (/uni|university|college|school|study|education|academic|course|degree/i.test(n)) return "uni";
  if (/financ|money|budget|saving|invest|tax/i.test(n)) return "finance";
  if (/job|career|employ|recruit|application/i.test(n)) return "job";
  if (/run|jog|marathon|5k|10k/i.test(n)) return "running";
  if (/swim|pool|open water/i.test(n)) return "swimming";
  if (/social|friend|family/i.test(n)) return "social";
  return "generic";
}

export interface SetupField {
  key: keyof CategoryMetadata;
  label: string;
  type: "pills" | "number" | "text" | "textarea" | "tags";
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}

export function getSetupFields(domain: Domain, categoryName: string): SetupField[] {
  switch (domain) {
    case "gym":
      return [
        {
          key: "experience",
          label: "Your current level",
          type: "pills",
          options: [
            { value: "beginner", label: "Beginner — fewer than 6 months" },
            { value: "intermediate", label: "Intermediate — 6 months to 2 years" },
            { value: "advanced", label: "Advanced — 2+ years consistent training" },
          ],
        },
        {
          key: "weekly_goal",
          label: "Sessions per week goal",
          type: "pills",
          options: [
            { value: 2, label: "2×" },
            { value: 3, label: "3×" },
            { value: 4, label: "4×" },
            { value: 5, label: "5×" },
            { value: 6, label: "6×" },
          ],
        },
        {
          key: "gym_focus",
          label: "Primary focus",
          type: "pills",
          options: [
            { value: "strength", label: "Strength & muscle" },
            { value: "cardio", label: "Cardio & fitness" },
            { value: "both", label: "Mix of both" },
          ],
        },
      ];

    case "tennis":
      return [
        {
          key: "utr",
          label: "Your UTR rating",
          type: "pills",
          options: [
            { value: 2, label: "< 3 — social / beginner" },
            { value: 4, label: "3–5 — club player" },
            { value: 7, label: "6–8 — competitive club" },
            { value: 10, label: "9+ — advanced / graded" },
          ],
          hint: "Not sure? Pick closest — you can update this anytime",
        },
        {
          key: "tennis_weekly_goal",
          label: "Sessions per week goal",
          type: "pills",
          options: [
            { value: 1, label: "1×" },
            { value: 2, label: "2×" },
            { value: 3, label: "3×" },
            { value: 4, label: "4×" },
            { value: 5, label: "5×" },
            { value: 6, label: "6×" },
          ],
        },
        {
          key: "tennis_focus",
          label: "What do you want more of?",
          type: "pills",
          options: [
            { value: "drilling", label: "Drilling & technique" },
            { value: "match_play", label: "Match play" },
            { value: "both", label: "Mix of both" },
          ],
        },
      ];

    case "uni":
      return [
        {
          key: "enrolled_units",
          label: "Units you're enrolled in",
          type: "tags",
          placeholder: "e.g. SIT221, SIT232",
          hint: "Add each unit code — helps the planner prioritise by deadlines",
          optional: true,
        },
      ];

    case "finance":
      return [
        {
          key: "savings_target",
          label: "Monthly savings target ($)",
          type: "number",
          placeholder: "e.g. 500",
          hint: "Used to make savings suggestions specific to your goal",
          optional: true,
        },
        {
          key: "review_frequency",
          label: "How often do you want to review finances?",
          type: "pills",
          options: [
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ],
        },
      ];

    case "job":
      return [
        {
          key: "applications_per_week",
          label: "Target applications per week",
          type: "pills",
          options: [
            { value: 2, label: "1–2" },
            { value: 5, label: "3–5" },
            { value: 8, label: "6–10" },
            { value: 12, label: "10+" },
          ],
        },
        {
          key: "role_type",
          label: "What kind of roles?",
          type: "text",
          placeholder: "e.g. Software Engineer, Product Manager",
          optional: true,
        },
      ];

    case "running":
    case "swimming":
      return [
        {
          key: "experience",
          label: "Your current level",
          type: "pills",
          options: [
            { value: "beginner", label: "Beginner — building up" },
            { value: "intermediate", label: "Intermediate — consistent training" },
            { value: "advanced", label: "Advanced — racing / high volume" },
          ],
        },
        {
          key: "weekly_goal",
          label: "Sessions per week goal",
          type: "pills",
          options: [
            { value: 2, label: "2×" },
            { value: 3, label: "3×" },
            { value: 4, label: "4×" },
            { value: 5, label: "5+" },
          ],
        },
      ];

    default:
      return [
        {
          key: "success_description",
          label: `What does success look like for ${categoryName}?`,
          type: "textarea",
          placeholder: "e.g. Reading 3 books a month and actually finishing them",
          hint: "This helps the planner write suggestions that feel meaningful, not generic",
        },
        {
          key: "custom_weekly_goal",
          label: "How many times a week do you want to work on this?",
          type: "pills",
          options: [
            { value: 1, label: "1×" },
            { value: 2, label: "2–3×" },
            { value: 4, label: "4–5×" },
            { value: 7, label: "Daily" },
          ],
          optional: true,
        },
      ];
  }
}

export function isSetupComplete(metadata?: CategoryMetadata, domain?: Domain): boolean {
  if (!metadata) return false;
  if (!domain || domain === "generic") return !!metadata.success_description;
  if (domain === "gym") return !!metadata.experience && !!metadata.weekly_goal;
  if (domain === "tennis") return !!metadata.utr && !!metadata.tennis_weekly_goal;
  if (domain === "finance") return !!metadata.review_frequency;
  if (domain === "job") return !!metadata.applications_per_week;
  if (domain === "uni") return true; // enrolled_units is optional
  if (domain === "running" || domain === "swimming") return !!metadata.experience;
  return false;
}
