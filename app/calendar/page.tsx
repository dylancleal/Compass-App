"use client";

import { Suspense, useEffect, useState } from "react";
import {
  useCalendarBlocks,
  useCalendarConnections,
  useCategories,
  useTasks,
  useCreateCalendarBlock,
  useRemoveCalendarBlock,
  useSuggestions,
  useSyncCalendarConnection,
} from "@/lib/queries";
import { addDays, startOfWeek, todayKey } from "@/lib/date";
import type { CalendarBlock, Task } from "@/lib/types";
import WeekGrid from "@/components/calendar/WeekGrid";
import AgendaView from "@/components/calendar/AgendaView";
import DeadlineRail from "@/components/calendar/DeadlineRail";
import QuickAddSheet from "@/components/calendar/QuickAddSheet";
import ProposedBlocks from "@/components/calendar/ProposedBlocks";
import ConnectionsPanel from "@/components/calendar/ConnectionsPanel";
import { Button } from "@/components/ui";

// Auto-sync if a connection hasn't synced in the last 30 minutes.
const STALE_MS = 30 * 60 * 1000;

type View = "week" | "agenda";

function CalendarInner() {
  const today = todayKey();
  const [view, setView] = useState<View>("agenda");
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [addOpen, setAddOpen] = useState(false);
  const [prefillTask, setPrefillTask] = useState<Task | undefined>();
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);

  // Range: show 2 weeks ahead in agenda, 1 week in week view
  const rangeStart = view === "week" ? weekStart : today;
  const rangeEnd = view === "week" ? addDays(weekStart, 6) : addDays(today, 13);

  const { data: blocks = [] } = useCalendarBlocks(
    `${rangeStart}T00:00:00.000Z`,
    `${rangeEnd}T23:59:59.999Z`,
  );
  const { data: categories = [] } = useCategories();
  const { data: tasks = [] } = useTasks();
  const { data: suggestions = [] } = useSuggestions(today);
  const { data: connections = [] } = useCalendarConnections();
  const createBlock = useCreateCalendarBlock();
  const removeBlock = useRemoveCalendarBlock();
  const syncConnection = useSyncCalendarConnection();

  // Auto-sync stale connections on page load.
  useEffect(() => {
    connections.forEach((conn) => {
      if (!conn.enabled || !conn.ics_url) return;
      const stale =
        !conn.last_synced_at ||
        Date.now() - new Date(conn.last_synced_at).getTime() > STALE_MS;
      if (stale) {
        syncConnection.mutate({
          id: conn.id,
          url: conn.ics_url,
          provider: conn.provider,
          label: conn.label,
        });
      }
    });
    // Only run when connections list first loads, not on every sync status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.map((c) => c.id).join(",")]);

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  function handleSaveBlock(input: Omit<CalendarBlock, "id" | "created_at">) {
    createBlock.mutate(input);
  }

  function handleConfirmAll(proposed: Omit<CalendarBlock, "id" | "created_at">[]) {
    proposed.forEach((b) => createBlock.mutate(b));
  }

  function handleClickSlot(dayKey: string, hour: number) {
    setPrefillDate(dayKey);
    setPrefillTask(undefined);
    setAddOpen(true);
  }

  function handleScheduleTask(task: Task) {
    setPrefillTask(task);
    setPrefillDate(today);
    setAddOpen(true);
  }

  function handleClickBlock(block: CalendarBlock) {
    setSelectedBlock(block);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div
            className="flex overflow-hidden rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          >
            {(["agenda", "week"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="cursor-pointer px-3 py-1.5 text-xs font-medium capitalize transition-all duration-150 hover:brightness-95 active:scale-95"
                style={{
                  background: view === v ? "var(--primary)" : "var(--surface)",
                  color: view === v ? "#fffdf9" : "var(--muted)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => { setPrefillTask(undefined); setPrefillDate(today); setAddOpen(true); }}>
            + Add
          </Button>
        </div>
      </div>

      {/* Week navigation (week view only) */}
      {view === "week" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:scale-105 hover:bg-[var(--primary-soft)] active:scale-95"
            style={{ color: "var(--muted)" }}
          >
            ←
          </button>
          <span className="flex-1 text-center text-sm font-medium">
            {new Date(weekStart + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:scale-105 hover:bg-[var(--primary-soft)] active:scale-95"
            style={{ color: "var(--muted)" }}
          >
            →
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(today))}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-95"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            Today
          </button>
        </div>
      )}

      {/* Deadline rail */}
      <DeadlineRail
        tasks={tasks}
        categories={categories}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onSchedule={handleScheduleTask}
      />

      {/* Planner proposals */}
      {pendingSuggestions.length > 0 && view === "agenda" && (
        <ProposedBlocks
          suggestions={pendingSuggestions}
          tasks={tasks}
          categories={categories}
          existingBlocks={blocks}
          dayKey={today}
          onConfirmAll={handleConfirmAll}
        />
      )}

      {/* Main view */}
      {view === "week" ? (
        <div
          className="card rounded-2xl p-3"
          style={{ overflowX: "auto" }}
        >
          <WeekGrid
            weekStart={weekStart}
            blocks={blocks}
            categories={categories}
            onClickBlock={handleClickBlock}
            onClickSlot={handleClickSlot}
          />
        </div>
      ) : (
        <AgendaView
          blocks={blocks}
          tasks={tasks}
          categories={categories}
          rangeStart={rangeStart}
          onClickBlock={handleClickBlock}
        />
      )}

      {/* Selected block detail */}
      {selectedBlock && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setSelectedBlock(null)}
        >
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div
            className="card relative z-10 w-full max-w-md rounded-b-none rounded-t-3xl p-5 sm:rounded-3xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{selectedBlock.title}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {new Date(selectedBlock.start_at).toLocaleString([], {
                weekday: "short", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
              {" — "}
              {new Date(selectedBlock.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {selectedBlock.notes && (
              <p className="text-sm">{selectedBlock.notes}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                className="rounded-xl px-3 py-2 text-sm font-medium hover:scale-[1.03] hover:brightness-95 hover:opacity-100"
                style={{ background: "#f8ece8", color: "#c06b5a" }}
                onClick={() => {
                  removeBlock.mutate(selectedBlock.id);
                  setSelectedBlock(null);
                }}
              >
                Delete
              </button>
              <button
                className="ml-auto rounded-xl px-3 py-2 text-sm font-medium hover:text-[var(--foreground)] hover:opacity-100"
                style={{ color: "var(--muted)" }}
                onClick={() => setSelectedBlock(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick add sheet */}
      <QuickAddSheet
        open={addOpen}
        onClose={() => { setAddOpen(false); setPrefillTask(undefined); setPrefillDate(undefined); }}
        categories={categories}
        tasks={tasks}
        existingBlocks={blocks}
        prefillTask={prefillTask}
        prefillDate={prefillDate}
        onSave={handleSaveBlock}
      />

      {/* Calendar connections */}
      <div
        className="card rounded-2xl p-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <ConnectionsPanel />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarInner />
    </Suspense>
  );
}
