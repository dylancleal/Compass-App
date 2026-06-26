"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
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

const keys = {
  categories: ["categories"],
  tasks: ["tasks"],
  sessions: ["sessions"],
  metrics: ["metrics"],
  metricLogs: ["metricLogs"],
  checkins: ["checkins"],
  settings: ["settings"],
  suggestions: (date: string) => ["suggestions", date],
  calendarBlocks: ["calendarBlocks"],
  calendarConnections: ["calendarConnections"],
};

// ---- reads ----
export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => db.listCategories() });
export const useTasks = () => useQuery({ queryKey: keys.tasks, queryFn: () => db.listTasks() });
export const useSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => db.listSessions() });
export const useMetrics = () => useQuery({ queryKey: keys.metrics, queryFn: () => db.listMetrics() });
export const useMetricLogs = () =>
  useQuery({ queryKey: keys.metricLogs, queryFn: () => db.listMetricLogs() });
export const useCheckins = () =>
  useQuery({ queryKey: keys.checkins, queryFn: () => db.listCheckins() });
export const useCheckin = (date: string) =>
  useQuery({
    queryKey: [...keys.checkins, date],
    queryFn: async () => (await db.getCheckin(date)) ?? null,
  });
export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => db.getSettings() });
export const useSuggestions = (date: string) =>
  useQuery({ queryKey: keys.suggestions(date), queryFn: () => db.listSuggestions(date) });

// ---- helper to wire a mutation that invalidates one or more keys ----
function useInvalidatingMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  invalidate: unknown[][],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

// ---- categories ----
export const useCreateCategory = () =>
  useInvalidatingMutation((i: Omit<Category, "id" | "order">) => db.createCategory(i), [keys.categories]);
export const useUpdateCategory = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<Category> }) => db.updateCategory(a.id, a.patch),
    [keys.categories],
  );
export const useRemoveCategory = () =>
  useInvalidatingMutation((id: string) => db.removeCategory(id), [keys.categories]);
export const useReorderCategories = () =>
  useInvalidatingMutation((ids: string[]) => db.reorderCategories(ids), [keys.categories]);

// ---- tasks ----
export const useCreateTask = () =>
  useInvalidatingMutation(
    (i: Parameters<typeof db.createTask>[0]) => db.createTask(i),
    [keys.tasks],
  );
export const useUpdateTask = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<Task> }) => db.updateTask(a.id, a.patch),
    [keys.tasks],
  );
export const useRemoveTask = () =>
  useInvalidatingMutation((id: string) => db.removeTask(id), [keys.tasks]);

// ---- sessions ----
export const useCreateSession = () =>
  useInvalidatingMutation((i: Omit<Session, "id" | "created_at">) => db.createSession(i), [
    keys.sessions,
  ]);
export const useUpdateSession = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<Session> }) => db.updateSession(a.id, a.patch),
    [keys.sessions],
  );
export const useRemoveSession = () =>
  useInvalidatingMutation((id: string) => db.removeSession(id), [keys.sessions]);

// ---- metrics + logs ----
export const useCreateMetric = () =>
  useInvalidatingMutation((i: Omit<Metric, "id">) => db.createMetric(i), [keys.metrics]);
export const useRemoveMetric = () =>
  useInvalidatingMutation((id: string) => db.removeMetric(id), [keys.metrics, keys.metricLogs]);
export const useCreateMetricLog = () =>
  useInvalidatingMutation((i: Omit<MetricLog, "id" | "created_at">) => db.createMetricLog(i), [
    keys.metricLogs,
  ]);

// ---- checkins ----
export const useUpsertCheckin = () =>
  useInvalidatingMutation((i: Omit<Checkin, "id" | "created_at">) => db.upsertCheckin(i), [
    keys.checkins,
  ]);

// ---- suggestions ----
export const useSaveSuggestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { date: string; items: Omit<Suggestion, "id" | "created_at">[] }) =>
      db.saveSuggestions(a.date, a.items),
    onSuccess: (_d, a) => qc.invalidateQueries({ queryKey: keys.suggestions(a.date) }),
  });
};
export const useUpdateSuggestion = (date: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: string; patch: Partial<Suggestion> }) =>
      db.updateSuggestion(a.id, a.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.suggestions(date) }),
  });
};

// ---- settings ----
export const useSaveSettings = () =>
  useInvalidatingMutation((patch: Partial<AppSettings>) => db.saveSettings(patch), [keys.settings]);

// ---- calendar blocks ----
export const useCalendarBlocks = (rangeStart: string, rangeEnd: string) =>
  useQuery({
    queryKey: [...keys.calendarBlocks, rangeStart, rangeEnd],
    queryFn: () => db.listCalendarBlocks(rangeStart, rangeEnd),
    enabled: !!rangeStart && !!rangeEnd,
  });
export const useCreateCalendarBlock = () =>
  useInvalidatingMutation(
    (i: Omit<CalendarBlock, "id" | "created_at">) => db.createCalendarBlock(i),
    [keys.calendarBlocks],
  );
export const useUpdateCalendarBlock = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<CalendarBlock> }) => db.updateCalendarBlock(a.id, a.patch),
    [keys.calendarBlocks],
  );
export const useRemoveCalendarBlock = () =>
  useInvalidatingMutation((id: string) => db.removeCalendarBlock(id), [keys.calendarBlocks]);

export const useSyncCalendarConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conn: { id: string; url: string; provider: string; label: string }) => {
      const res = await fetch("/api/ics-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: conn.url, provider: conn.provider, connectionId: conn.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      const { events, connectionId } = await res.json();
      const blocks: Omit<import("@/lib/types").CalendarBlock, "id" | "created_at">[] = events.map(
        (e: { externalId: string; title: string; start_at: string; end_at: string; all_day: boolean }) => ({
          title: e.title,
          start_at: e.start_at,
          end_at: e.end_at,
          all_day: e.all_day,
          source: conn.provider as import("@/lib/types").CalendarSource,
          external_id: e.externalId,
          external_calendar_id: connectionId,
          busy: true,
          status: "planned" as const,
        }),
      );
      const result = await db.syncCalendarBlocks(blocks, connectionId);
      await db.updateCalendarConnection(connectionId, { last_synced_at: new Date().toISOString() });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.calendarBlocks });
      qc.invalidateQueries({ queryKey: keys.calendarConnections });
    },
  });
};

// ---- calendar connections ----
export const useCalendarConnections = () =>
  useQuery({ queryKey: keys.calendarConnections, queryFn: () => db.listCalendarConnections() });
export const useCreateCalendarConnection = () =>
  useInvalidatingMutation(
    (i: Omit<CalendarConnection, "id" | "created_at">) => db.createCalendarConnection(i),
    [keys.calendarConnections],
  );
export const useUpdateCalendarConnection = () =>
  useInvalidatingMutation(
    (a: { id: string; patch: Partial<CalendarConnection> }) => db.updateCalendarConnection(a.id, a.patch),
    [keys.calendarConnections],
  );
export const useRemoveCalendarConnection = () =>
  useInvalidatingMutation((id: string) => db.removeCalendarConnection(id), [keys.calendarConnections]);

export { keys as queryKeys };
