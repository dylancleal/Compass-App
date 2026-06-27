import type {
  AppSettings,
  CalendarBlock,
  CalendarConnection,
  Category,
  Checkin,
  Metric,
  MetricLog,
  Session,
  SessionTemplate,
  Suggestion,
  Task,
} from "@/lib/types";
import { BUILTIN_LIBRARY } from "@/lib/science/library";
import type { CompassDB } from "./types";
import { uid } from "@/lib/date";
import { defaultCategories, defaultMetrics, defaultSettings } from "./seed";

// localStorage-backed implementation. Everything lives under the keys below as
// JSON. All methods are async to match the future Supabase implementation, so
// React Query hooks don't change when we swap.

const PREFIX = "compass:v1:";
const KEYS = {
  categories: PREFIX + "categories",
  tasks: PREFIX + "tasks",
  sessions: PREFIX + "sessions",
  metrics: PREFIX + "metrics",
  metricLogs: PREFIX + "metricLogs",
  checkins: PREFIX + "checkins",
  suggestions: PREFIX + "suggestions",
  settings: PREFIX + "settings",
  seeded: PREFIX + "seeded",
  calendarBlocks: PREFIX + "calendarBlocks",
  calendarConnections: PREFIX + "calendarConnections",
  sessionTemplates: PREFIX + "sessionTemplates",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export class LocalDB implements CompassDB {
  async ensureSeeded(): Promise<void> {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEYS.seeded)) return;
    const cats = defaultCategories();
    const metrics = defaultMetrics(cats);
    write(KEYS.categories, cats);
    write(KEYS.metrics, metrics);
    write(KEYS.settings, defaultSettings());
    write(KEYS.sessionTemplates, BUILTIN_LIBRARY);
    window.localStorage.setItem(KEYS.seeded, "1");
  }

  // session templates
  async listSessionTemplates(): Promise<SessionTemplate[]> {
    const stored = read<SessionTemplate[]>(KEYS.sessionTemplates, []);
    // Seed on first access even if ensureSeeded ran before this key existed.
    if (stored.length === 0) {
      write(KEYS.sessionTemplates, BUILTIN_LIBRARY);
      return BUILTIN_LIBRARY;
    }
    return stored;
  }
  async upsertSessionTemplate(input: SessionTemplate): Promise<SessionTemplate> {
    const all = read<SessionTemplate[]>(KEYS.sessionTemplates, []);
    const idx = all.findIndex((t) => t.id === input.id);
    const next = idx >= 0 ? all.map((t) => (t.id === input.id ? input : t)) : [...all, input];
    write(KEYS.sessionTemplates, next);
    return input;
  }
  async removeSessionTemplate(id: string): Promise<void> {
    write(
      KEYS.sessionTemplates,
      read<SessionTemplate[]>(KEYS.sessionTemplates, []).filter((t) => t.id !== id),
    );
  }

  // categories
  async listCategories(): Promise<Category[]> {
    return read<Category[]>(KEYS.categories, []).sort((a, b) => a.order - b.order);
  }
  async createCategory(input: Omit<Category, "id" | "order">): Promise<Category> {
    const all = read<Category[]>(KEYS.categories, []);
    const cat: Category = { ...input, id: uid(), order: all.length };
    write(KEYS.categories, [...all, cat]);
    return cat;
  }
  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    const all = read<Category[]>(KEYS.categories, []);
    const next = all.map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(KEYS.categories, next);
    return next.find((c) => c.id === id)!;
  }
  async removeCategory(id: string): Promise<void> {
    write(KEYS.categories, read<Category[]>(KEYS.categories, []).filter((c) => c.id !== id));
  }
  async reorderCategories(ids: string[]): Promise<void> {
    const all = read<Category[]>(KEYS.categories, []);
    const next = all.map((c) => ({ ...c, order: ids.indexOf(c.id) }));
    write(KEYS.categories, next);
  }

  // tasks
  async listTasks(): Promise<Task[]> {
    return read<Task[]>(KEYS.tasks, []);
  }
  async createTask(input: Parameters<CompassDB["createTask"]>[0]): Promise<Task> {
    const all = read<Task[]>(KEYS.tasks, []);
    const task: Task = {
      status: "not_started",
      ...input,
      id: uid(),
      created_at: new Date().toISOString(),
    } as Task;
    write(KEYS.tasks, [task, ...all]);
    return task;
  }
  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const all = read<Task[]>(KEYS.tasks, []);
    const next = all.map((t) => (t.id === id ? { ...t, ...patch } : t));
    write(KEYS.tasks, next);
    return next.find((t) => t.id === id)!;
  }
  async removeTask(id: string): Promise<void> {
    write(KEYS.tasks, read<Task[]>(KEYS.tasks, []).filter((t) => t.id !== id));
  }

  // sessions
  async listSessions(): Promise<Session[]> {
    return read<Session[]>(KEYS.sessions, []);
  }
  async createSession(input: Omit<Session, "id" | "created_at">): Promise<Session> {
    const all = read<Session[]>(KEYS.sessions, []);
    const s: Session = { ...input, id: uid(), created_at: new Date().toISOString() };
    write(KEYS.sessions, [s, ...all]);
    return s;
  }
  async updateSession(id: string, patch: Partial<Session>): Promise<Session> {
    const all = read<Session[]>(KEYS.sessions, []);
    const next = all.map((s) => (s.id === id ? { ...s, ...patch } : s));
    write(KEYS.sessions, next);
    return next.find((s) => s.id === id)!;
  }
  async removeSession(id: string): Promise<void> {
    write(KEYS.sessions, read<Session[]>(KEYS.sessions, []).filter((s) => s.id !== id));
  }

  // metrics
  async listMetrics(): Promise<Metric[]> {
    return read<Metric[]>(KEYS.metrics, []);
  }
  async createMetric(input: Omit<Metric, "id">): Promise<Metric> {
    const all = read<Metric[]>(KEYS.metrics, []);
    const m: Metric = { ...input, id: uid() };
    write(KEYS.metrics, [...all, m]);
    return m;
  }
  async removeMetric(id: string): Promise<void> {
    write(KEYS.metrics, read<Metric[]>(KEYS.metrics, []).filter((m) => m.id !== id));
    write(KEYS.metricLogs, read<MetricLog[]>(KEYS.metricLogs, []).filter((l) => l.metric_id !== id));
  }

  // metric logs
  async listMetricLogs(): Promise<MetricLog[]> {
    return read<MetricLog[]>(KEYS.metricLogs, []);
  }
  async createMetricLog(input: Omit<MetricLog, "id" | "created_at">): Promise<MetricLog> {
    const all = read<MetricLog[]>(KEYS.metricLogs, []);
    const log: MetricLog = { ...input, id: uid(), created_at: new Date().toISOString() };
    write(KEYS.metricLogs, [log, ...all]);
    return log;
  }
  async removeMetricLog(id: string): Promise<void> {
    write(KEYS.metricLogs, read<MetricLog[]>(KEYS.metricLogs, []).filter((l) => l.id !== id));
  }

  // checkins
  async listCheckins(): Promise<Checkin[]> {
    return read<Checkin[]>(KEYS.checkins, []);
  }
  async getCheckin(date: string): Promise<Checkin | undefined> {
    return read<Checkin[]>(KEYS.checkins, []).find((c) => c.date === date);
  }
  async upsertCheckin(input: Omit<Checkin, "id" | "created_at">): Promise<Checkin> {
    const all = read<Checkin[]>(KEYS.checkins, []);
    const existing = all.find((c) => c.date === input.date);
    if (existing) {
      const updated = { ...existing, ...input };
      write(KEYS.checkins, all.map((c) => (c.id === existing.id ? updated : c)));
      return updated;
    }
    const created: Checkin = { ...input, id: uid(), created_at: new Date().toISOString() };
    write(KEYS.checkins, [created, ...all]);
    return created;
  }

  // suggestions
  async listSuggestions(date: string): Promise<Suggestion[]> {
    return read<Suggestion[]>(KEYS.suggestions, []).filter((s) => s.date === date);
  }
  async saveSuggestions(
    date: string,
    items: Omit<Suggestion, "id" | "created_at">[],
  ): Promise<Suggestion[]> {
    const all = read<Suggestion[]>(KEYS.suggestions, []);
    // Preserve any accept/dismiss feedback the user already gave today.
    const keptFeedback = all.filter((s) => s.date === date && s.status !== "pending");
    const others = all.filter((s) => s.date !== date);
    const created: Suggestion[] = items.map((i) => ({
      ...i,
      id: uid(),
      created_at: new Date().toISOString(),
    }));
    write(KEYS.suggestions, [...others, ...keptFeedback, ...created]);
    return [...keptFeedback, ...created];
  }
  async updateSuggestion(id: string, patch: Partial<Suggestion>): Promise<Suggestion> {
    const all = read<Suggestion[]>(KEYS.suggestions, []);
    const next = all.map((s) => (s.id === id ? { ...s, ...patch } : s));
    write(KEYS.suggestions, next);
    return next.find((s) => s.id === id)!;
  }

  // calendar blocks
  async listCalendarBlocks(rangeStart: string, rangeEnd: string): Promise<CalendarBlock[]> {
    return read<CalendarBlock[]>(KEYS.calendarBlocks, []).filter(
      (b) => b.start_at >= rangeStart && b.start_at <= rangeEnd,
    );
  }
  async createCalendarBlock(input: Omit<CalendarBlock, "id" | "created_at">): Promise<CalendarBlock> {
    const all = read<CalendarBlock[]>(KEYS.calendarBlocks, []);
    const b: CalendarBlock = { ...input, id: uid(), created_at: new Date().toISOString() };
    write(KEYS.calendarBlocks, [...all, b]);
    return b;
  }
  async updateCalendarBlock(id: string, patch: Partial<CalendarBlock>): Promise<CalendarBlock> {
    const all = read<CalendarBlock[]>(KEYS.calendarBlocks, []);
    const next = all.map((b) => (b.id === id ? { ...b, ...patch } : b));
    write(KEYS.calendarBlocks, next);
    return next.find((b) => b.id === id)!;
  }
  async removeCalendarBlock(id: string): Promise<void> {
    write(KEYS.calendarBlocks, read<CalendarBlock[]>(KEYS.calendarBlocks, []).filter((b) => b.id !== id));
  }
  async syncCalendarBlocks(
    incoming: Omit<CalendarBlock, "id" | "created_at">[],
    connectionId: string,
  ): Promise<{ synced: number }> {
    const all = read<CalendarBlock[]>(KEYS.calendarBlocks, []);
    const existing = all.filter((b) => b.external_calendar_id === connectionId);
    const unchanged = all.filter((b) => b.external_calendar_id !== connectionId);
    const now = new Date().toISOString();
    const merged: CalendarBlock[] = incoming.map((b) => {
      const found = existing.find((e) => e.external_id === b.external_id);
      return found ? { ...found, ...b } : { ...b, id: uid(), created_at: now };
    });
    write(KEYS.calendarBlocks, [...unchanged, ...merged]);
    return { synced: merged.length };
  }

  // calendar connections
  async listCalendarConnections(): Promise<CalendarConnection[]> {
    return read<CalendarConnection[]>(KEYS.calendarConnections, []);
  }
  async createCalendarConnection(input: Omit<CalendarConnection, "id" | "created_at">): Promise<CalendarConnection> {
    const all = read<CalendarConnection[]>(KEYS.calendarConnections, []);
    const c: CalendarConnection = { ...input, id: uid(), created_at: new Date().toISOString() };
    write(KEYS.calendarConnections, [...all, c]);
    return c;
  }
  async updateCalendarConnection(id: string, patch: Partial<CalendarConnection>): Promise<CalendarConnection> {
    const all = read<CalendarConnection[]>(KEYS.calendarConnections, []);
    const next = all.map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(KEYS.calendarConnections, next);
    return next.find((c) => c.id === id)!;
  }
  async removeCalendarConnection(id: string): Promise<void> {
    write(KEYS.calendarConnections, read<CalendarConnection[]>(KEYS.calendarConnections, []).filter((c) => c.id !== id));
  }

  // settings
  async getSettings(): Promise<AppSettings> {
    return read<AppSettings>(KEYS.settings, defaultSettings());
  }
  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = read<AppSettings>(KEYS.settings, defaultSettings());
    const next = { ...current, ...patch };
    write(KEYS.settings, next);
    return next;
  }
}
