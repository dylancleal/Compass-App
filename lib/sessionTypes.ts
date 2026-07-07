// Curated session-type options per category, used by the log sheet and the
// inline session editor so "what kind of session was it?" stays consistent.
export const SESSION_TYPES: Record<string, string[]> = {
  Gym: ["Push", "Pull", "Legs", "Full body", "Cardio", "Mobility", "Recovery"],
  Tennis: ["Serve", "Forehand", "Backhand", "Volleys", "Match", "Fitness"],
  "Uni work": ["Study", "Reading", "Problem set", "Revision", "Past paper", "Group work"],
  "Job searching": ["Applications", "Follow-ups", "Interview", "Networking"],
  Finances: ["Review", "Budgeting"],
};

export function sessionTypesFor(categoryName: string): string[] {
  return SESSION_TYPES[categoryName] ?? ["Session"];
}
