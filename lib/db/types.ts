import type {
  AppSettings,
  Category,
  Checkin,
  Metric,
  MetricLog,
  Session,
  Suggestion,
  Task,
  TaskStatus,
} from "@/lib/types";

// The single data-access contract. LocalDB implements it today; SupabaseDB
// will implement the same shape so swapping is just an env flag.
export interface CompassDB {
  // categories
  listCategories(): Promise<Category[]>;
  createCategory(input: Omit<Category, "id" | "order">): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<Category>;
  removeCategory(id: string): Promise<void>;
  reorderCategories(ids: string[]): Promise<void>;

  // tasks
  listTasks(): Promise<Task[]>;
  createTask(input: Omit<Task, "id" | "created_at" | "status"> & { status?: TaskStatus }): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  removeTask(id: string): Promise<void>;

  // sessions
  listSessions(): Promise<Session[]>;
  createSession(input: Omit<Session, "id" | "created_at">): Promise<Session>;
  updateSession(id: string, patch: Partial<Session>): Promise<Session>;
  removeSession(id: string): Promise<void>;

  // metrics
  listMetrics(): Promise<Metric[]>;
  createMetric(input: Omit<Metric, "id">): Promise<Metric>;
  removeMetric(id: string): Promise<void>;

  // metric logs
  listMetricLogs(): Promise<MetricLog[]>;
  createMetricLog(input: Omit<MetricLog, "id" | "created_at">): Promise<MetricLog>;
  removeMetricLog(id: string): Promise<void>;

  // checkins
  listCheckins(): Promise<Checkin[]>;
  getCheckin(date: string): Promise<Checkin | undefined>;
  upsertCheckin(input: Omit<Checkin, "id" | "created_at">): Promise<Checkin>;

  // suggestions (persisted planner output + accept/dismiss feedback)
  listSuggestions(date: string): Promise<Suggestion[]>;
  saveSuggestions(date: string, items: Omit<Suggestion, "id" | "created_at">[]): Promise<Suggestion[]>;
  updateSuggestion(id: string, patch: Partial<Suggestion>): Promise<Suggestion>;

  // settings
  getSettings(): Promise<AppSettings>;
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  // maintenance
  ensureSeeded(): Promise<void>;
}
