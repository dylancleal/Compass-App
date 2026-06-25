import type {
  AppSettings,
  CalendarBlock,
  CalendarConnection,
  Category,
  Checkin,
  Metric,
  MetricLog,
  Session,
  Suggestion,
  Task,
} from "@/lib/types";
import type { CompassDB } from "./types";
import { getSupabase } from "@/lib/supabaseClient";
import { defaultCategories, defaultMetrics, defaultSettings } from "./seed";

// Supabase implementation of the same contract as LocalDB. RLS + column
// defaults (compass_uid()) mean we never send user_id from the client.
//
// This is wired and ready; it activates only when NEXT_PUBLIC_DATA_BACKEND
// is "supabase" AND the URL/anon key are present (see ./index.ts). Until then
// LocalDB is used, so the app needs no credentials to run.

function sb() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_* env vars.");
  return c;
}

// Module-level deduplicator: React Strict Mode double-invokes effects in dev,
// so two concurrent ensureSeeded calls could both see count=0 and double-insert.
// One pending promise shared across all callers prevents that.
let seedingPromise: Promise<void> | null = null;

export class SupabaseDB implements CompassDB {
  async ensureSeeded(): Promise<void> {
    if (seedingPromise) return seedingPromise;
    seedingPromise = this._seed().finally(() => { seedingPromise = null; });
    return seedingPromise;
  }

  private async _seed(): Promise<void> {
    const { count } = await sb().from("categories").select("id", { count: "exact", head: true });
    if (count && count > 0) return;
    const cats = defaultCategories().map(({ id: _id, order, ...rest }) => ({ ...rest, order }));
    const { data: inserted } = await sb().from("categories").insert(cats).select();
    if (inserted) {
      const metrics = defaultMetrics(inserted as Category[]).map(({ id: _id, ...m }) => m);
      await sb().from("metrics").insert(metrics);
    }
    await sb().from("settings").upsert({ data: defaultSettings() });
  }

  async listCategories(): Promise<Category[]> {
    const { data } = await sb().from("categories").select("*").order("order");
    return (data ?? []) as Category[];
  }
  async createCategory(input: Omit<Category, "id" | "order">): Promise<Category> {
    const { count } = await sb().from("categories").select("id", { count: "exact", head: true });
    const { data } = await sb().from("categories").insert({ ...input, order: count ?? 0 }).select().single();
    return data as Category;
  }
  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    const { data } = await sb().from("categories").update(patch).eq("id", id).select().single();
    return data as Category;
  }
  async removeCategory(id: string): Promise<void> {
    await sb().from("categories").delete().eq("id", id);
  }
  async reorderCategories(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id, order) => sb().from("categories").update({ order }).eq("id", id)));
  }

  async listTasks(): Promise<Task[]> {
    const { data } = await sb().from("tasks").select("*").order("created_at", { ascending: false });
    return (data ?? []) as Task[];
  }
  async createTask(input: Parameters<CompassDB["createTask"]>[0]): Promise<Task> {
    const { data } = await sb().from("tasks").insert(input).select().single();
    return data as Task;
  }
  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const { data } = await sb().from("tasks").update(patch).eq("id", id).select().single();
    return data as Task;
  }
  async removeTask(id: string): Promise<void> {
    await sb().from("tasks").delete().eq("id", id);
  }

  async listSessions(): Promise<Session[]> {
    const { data } = await sb().from("sessions").select("*").order("date", { ascending: false });
    return (data ?? []) as Session[];
  }
  async createSession(input: Omit<Session, "id" | "created_at">): Promise<Session> {
    const { data } = await sb().from("sessions").insert(input).select().single();
    return data as Session;
  }
  async updateSession(id: string, patch: Partial<Session>): Promise<Session> {
    const { data } = await sb().from("sessions").update(patch).eq("id", id).select().single();
    return data as Session;
  }
  async removeSession(id: string): Promise<void> {
    await sb().from("sessions").delete().eq("id", id);
  }

  async listMetrics(): Promise<Metric[]> {
    const { data } = await sb().from("metrics").select("*");
    return (data ?? []) as Metric[];
  }
  async createMetric(input: Omit<Metric, "id">): Promise<Metric> {
    const { data } = await sb().from("metrics").insert(input).select().single();
    return data as Metric;
  }
  async removeMetric(id: string): Promise<void> {
    await sb().from("metrics").delete().eq("id", id);
  }

  async listMetricLogs(): Promise<MetricLog[]> {
    const { data } = await sb().from("metric_logs").select("*").order("date", { ascending: false });
    return (data ?? []) as MetricLog[];
  }
  async createMetricLog(input: Omit<MetricLog, "id" | "created_at">): Promise<MetricLog> {
    const { data } = await sb().from("metric_logs").insert(input).select().single();
    return data as MetricLog;
  }
  async removeMetricLog(id: string): Promise<void> {
    await sb().from("metric_logs").delete().eq("id", id);
  }

  async listCheckins(): Promise<Checkin[]> {
    const { data } = await sb().from("checkins").select("*").order("date", { ascending: false });
    return (data ?? []) as Checkin[];
  }
  async getCheckin(date: string): Promise<Checkin | undefined> {
    const { data } = await sb().from("checkins").select("*").eq("date", date).maybeSingle();
    return (data ?? undefined) as Checkin | undefined;
  }
  async upsertCheckin(input: Omit<Checkin, "id" | "created_at">): Promise<Checkin> {
    const { data } = await sb()
      .from("checkins")
      .upsert(input, { onConflict: "user_id,date" })
      .select()
      .single();
    return data as Checkin;
  }

  async listSuggestions(date: string): Promise<Suggestion[]> {
    const { data } = await sb().from("suggestions").select("*").eq("date", date);
    return (data ?? []) as Suggestion[];
  }
  async saveSuggestions(
    date: string,
    items: Omit<Suggestion, "id" | "created_at">[],
  ): Promise<Suggestion[]> {
    await sb().from("suggestions").delete().eq("date", date).eq("status", "pending");
    const { data } = await sb().from("suggestions").insert(items).select();
    const { data: kept } = await sb()
      .from("suggestions")
      .select("*")
      .eq("date", date)
      .neq("status", "pending");
    return [...((kept ?? []) as Suggestion[]), ...((data ?? []) as Suggestion[])];
  }
  async updateSuggestion(id: string, patch: Partial<Suggestion>): Promise<Suggestion> {
    const { data } = await sb().from("suggestions").update(patch).eq("id", id).select().single();
    return data as Suggestion;
  }

  async getSettings(): Promise<AppSettings> {
    const { data } = await sb().from("settings").select("data").maybeSingle();
    return { ...defaultSettings(), ...(data?.data ?? {}) } as AppSettings;
  }
  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next = { ...current, ...patch };
    await sb().from("settings").upsert({ data: next });
    return next;
  }

  async listCalendarBlocks(rangeStart: string, rangeEnd: string): Promise<CalendarBlock[]> {
    const { data } = await sb()
      .from("calendar_blocks")
      .select("*")
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd)
      .order("start_at");
    return (data ?? []) as CalendarBlock[];
  }
  async createCalendarBlock(input: Omit<CalendarBlock, "id" | "created_at">): Promise<CalendarBlock> {
    const { data } = await sb().from("calendar_blocks").insert(input).select().single();
    return data as CalendarBlock;
  }
  async updateCalendarBlock(id: string, patch: Partial<CalendarBlock>): Promise<CalendarBlock> {
    const { data } = await sb().from("calendar_blocks").update(patch).eq("id", id).select().single();
    return data as CalendarBlock;
  }
  async removeCalendarBlock(id: string): Promise<void> {
    await sb().from("calendar_blocks").delete().eq("id", id);
  }

  async listCalendarConnections(): Promise<CalendarConnection[]> {
    const { data } = await sb().from("calendar_connections").select("*").order("created_at");
    return (data ?? []) as CalendarConnection[];
  }
  async createCalendarConnection(input: Omit<CalendarConnection, "id" | "created_at">): Promise<CalendarConnection> {
    const { data } = await sb().from("calendar_connections").insert(input).select().single();
    return data as CalendarConnection;
  }
  async updateCalendarConnection(id: string, patch: Partial<CalendarConnection>): Promise<CalendarConnection> {
    const { data } = await sb().from("calendar_connections").update(patch).eq("id", id).select().single();
    return data as CalendarConnection;
  }
  async removeCalendarConnection(id: string): Promise<void> {
    await sb().from("calendar_connections").delete().eq("id", id);
  }
}
