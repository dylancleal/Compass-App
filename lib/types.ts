// Core domain types for Compass. Kept storage-agnostic so the same shapes work
// against the local (localStorage) data layer today and Supabase later.

export type ID = string;

export type MetricType = "numeric" | "boolean" | "scale" | "text";

// Mirrors OnTrack/Doubtfire task states so Phase 3 sync maps cleanly.
export type TaskStatus =
  | "not_started"
  | "working"
  | "ready_for_feedback"
  | "complete"
  | "fix_resubmit";

export type TaskSource = "manual" | "ontrack" | "calendar";

export type Capacity = "light" | "medium" | "big";

export type SuggestionStatus = "pending" | "accepted" | "dismissed" | "snoozed";

export interface Category {
  id: ID;
  name: string;
  color: string; // key into PALETTE
  icon: string; // emoji
  order: number;
  active: boolean;
}

export interface Task {
  id: ID;
  category_id: ID;
  title: string;
  notes?: string;
  due_date?: string; // ISO date (yyyy-mm-dd)
  estimate_minutes?: number;
  status: TaskStatus;
  source: TaskSource;
  external_id?: string;
  first_step?: string;
  created_at: string; // ISO datetime
  completed_at?: string; // ISO datetime
}

export interface Session {
  id: ID;
  category_id: ID;
  date: string; // ISO date
  type: string;
  duration_minutes?: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Metric {
  id: ID;
  category_id: ID;
  name: string;
  type: MetricType;
  unit?: string;
}

export type MetricValue = number | boolean | string;

export interface MetricLog {
  id: ID;
  metric_id: ID;
  date: string; // ISO date
  value: MetricValue;
  created_at: string;
}

export interface Checkin {
  id: ID;
  date: string; // ISO date — one per day
  mental: number; // 1-5
  uni_readiness: number; // 1-5
  capacity: Capacity;
  note?: string;
  extra: Record<string, unknown>; // category-specific answers
  created_at: string;
}

export interface Suggestion {
  id: ID;
  date: string; // ISO date
  category_id?: ID;
  text: string;
  reason: string;
  est_minutes?: number;
  status: SuggestionStatus;
  created_at: string;
}

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun..Sat

export interface WeeklySchedule {
  gym: DayIndex[];
  tennis: DayIndex[];
  study: DayIndex[];
}

export interface PlannerWeights {
  neglect: number;
  readiness: number;
  deadline: number;
  balance: number;
}

export interface AppSettings {
  greetingName: string;
  weeklySchedule: WeeklySchedule;
  plannerWeights: PlannerWeights;
}
