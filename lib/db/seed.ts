import type { Category, Metric, AppSettings } from "@/lib/types";
import { uid } from "@/lib/date";

// Default categories from SPEC §4. Metrics are data-driven and editable later.
export function defaultCategories(): Category[] {
  const base = [
    { name: "Uni work", color: "blue", icon: "📘" },
    { name: "Job searching", color: "violet", icon: "💼" },
    { name: "Tennis", color: "green", icon: "🎾" },
    { name: "Gym", color: "amber", icon: "🏋️" },
    { name: "Finances", color: "teal", icon: "💰" },
  ];
  return base.map((c, i) => ({
    id: uid(),
    name: c.name,
    color: c.color,
    icon: c.icon,
    order: i,
    active: true,
  }));
}

// Seed a sensible starter metric per category so trends have something to show.
export function defaultMetrics(categories: Category[]): Metric[] {
  const byName = (n: string) => categories.find((c) => c.name === n);
  const metrics: Omit<Metric, "id">[] = [];
  const uni = byName("Uni work");
  const job = byName("Job searching");
  const tennis = byName("Tennis");
  const gym = byName("Gym");
  const fin = byName("Finances");

  if (uni) metrics.push({ category_id: uni.id, name: "Study minutes", type: "numeric", unit: "min" });
  if (job) metrics.push({ category_id: job.id, name: "Applications sent", type: "numeric" });
  if (tennis) {
    metrics.push({ category_id: tennis.id, name: "UTR", type: "numeric" });
    metrics.push({ category_id: tennis.id, name: "Session feel", type: "scale" });
  }
  if (gym) {
    metrics.push({ category_id: gym.id, name: "Soreness", type: "scale" });
    metrics.push({ category_id: gym.id, name: "RPE", type: "scale" });
  }
  if (fin) metrics.push({ category_id: fin.id, name: "Savings", type: "numeric", unit: "$" });

  return metrics.map((m) => ({ id: uid(), ...m }));
}

export function defaultSettings(): AppSettings {
  return {
    greetingName: "",
    weeklySchedule: {
      gym: [1, 3, 5], // Mon/Wed/Fri
      tennis: [2, 6], // Tue/Sat
      study: [1, 2, 3, 4], // Mon-Thu
    },
    plannerWeights: {
      neglect: 1,
      readiness: 1,
      deadline: 1.5,
      balance: 1,
    },
  };
}
