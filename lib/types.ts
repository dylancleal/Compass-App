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

export interface CategoryMetadata {
  // Gym
  experience?: "beginner" | "intermediate" | "advanced";
  weekly_goal?: number;
  gym_focus?: "strength" | "cardio" | "both";
  // Tennis
  utr?: number; // 1–16 UTR scale
  tennis_weekly_goal?: number;
  tennis_focus?: "match_play" | "drilling" | "both";
  // Finance
  savings_target?: number;
  review_frequency?: "weekly" | "monthly";
  // Job searching
  applications_per_week?: number;
  role_type?: string;
  // Uni / Study
  enrolled_units?: string[];
  // Generic / Custom
  success_description?: string;
  custom_weekly_goal?: number;
}

export interface Category {
  id: ID;
  name: string;
  color: string; // key into PALETTE
  icon: string; // emoji
  order: number;
  active: boolean;
  metadata?: CategoryMetadata;
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
  session_type?: string; // carried from planner for auto-logging (C1)
  personal_insight?: string; // personalisation note shown distinctly in the card
  status: SuggestionStatus;
  created_at: string;
}

// ── Calendar (Phase 1) ────────────────────────────────────────────────────
// A planned span of time. Distinct from Task (a to-do with a deadline) and
// Session (a logged, completed activity). See docs/calendar-phase1-spec.md.
export type CalendarSource = "manual" | "compass" | "google" | "microsoft" | "apple";
export type BlockStatus = "planned" | "done" | "skipped";

export interface CalendarBlock {
  id: ID;
  category_id?: ID; // null for external imports
  task_id?: ID; // block advances this task
  title: string;
  start_at: string; // ISO datetime (UTC instant), rendered in local time
  end_at: string; // ISO datetime
  all_day?: boolean;
  source: CalendarSource;
  external_id?: string; // provider event id (dedupe key, Phase 2)
  external_calendar_id?: string;
  busy: boolean; // true = counts against free time
  status: BlockStatus;
  notes?: string;
  created_at: string;
}

export interface CalendarConnection {
  id: ID;
  provider: "google" | "microsoft" | "apple" | "ics";
  label: string;
  ics_url?: string;
  color?: string;
  enabled: boolean;
  last_synced_at?: string;
  account_email?: string;  // OAuth connections only
  needs_reauth?: boolean;  // true when refresh token was revoked
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

// ── Science library (Phase 4) ─────────────────────────────────────────────────

export interface SessionVariant {
  when: {
    field: "experience" | "level" | "deadlineDays" | "lowWellbeing";
    op: "eq" | "lt" | "lte" | "gt" | "gte";
    value: string | number | boolean;
  };
  patch: {
    sessionTypeOverride?: string;
    durationDelta?: number;
    durationFactor?: number;
    planPrepend?: string[];
    planAppend?: string[];
    planReplace?: string[];
    whyAppend?: string;
    whyReplace?: string;
  };
}

export interface SessionTemplate {
  id: ID;
  domain: string;
  session_type: string;
  duration_min: number;
  plan: string[];
  cite: string;
  why: string;
  variants?: SessionVariant[];
  is_builtin: boolean;
  weekly_default?: number;
}

export interface AppSettings {
  greetingName: string;
  weeklySchedule: WeeklySchedule;
  plannerWeights: PlannerWeights;
  weeklyTargets?: Record<string, number>; // category_id → sessions/week goal
  onboarding_completed_at?: string; // ISO datetime — null means new user
}
