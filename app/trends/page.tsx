"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useCategories,
  useCheckins,
  useMetricLogs,
  useMetrics,
  useSessions,
  useTasks,
} from "@/lib/queries";
import { accentOf } from "@/lib/palette";
import {
  activityHeatmap,
  currentStreak,
  energyByDay,
  metricSeries,
  momentumForecast,
  skillConfidenceBySkill,
  weeklySessionCounts,
} from "@/lib/stats";
import { daysBetween, startOfWeek, todayKey } from "@/lib/date";
import { BarTrend, LineTrend } from "@/components/charts";
import { GoalCard, GoalsOverview } from "@/components/GoalCard";
import type { Category, Metric, MetricLog, Session } from "@/lib/types";

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="grid h-24 place-items-center rounded-xl bg-[var(--surface)] text-center text-xs text-[var(--muted)]">
      {text}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-medium text-[var(--muted)]">{children}</p>;
}

// ── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ stats }: { stats: { value: string | number; label: string; color?: string }[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-2xl font-medium leading-none" style={{ color: s.color ?? "var(--foreground)" }}>
            {s.value}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Activity heatmap ─────────────────────────────────────────────────────────

function HeatmapChart({
  sessions,
  categories,
}: {
  sessions: Session[];
  categories: Category[];
}) {
  const rows = activityHeatmap(sessions, categories);
  if (rows.length === 0) return <Empty text="Log sessions to see your activity pattern." />;

  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
      <div className="flex flex-col gap-1.5" style={{ minWidth: "fit-content" }}>
        {rows.map((row) => {
          const cat = categories.find((c) => c.id === row.categoryId);
          const { accent } = cat ? accentOf(cat.color) : { accent: "#94a3b8" };
          return (
            <div key={row.categoryId} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-right text-[10px] text-[var(--muted)]">
                {cat?.icon} {row.categoryName.split(" ")[0]}
              </span>
              <div className="flex gap-1">
                {row.cells.map((cell) => {
                  const opacity = cell.count === 0 ? 0.08 : cell.count === 1 ? 0.45 : 1;
                  return (
                    <div
                      key={cell.date}
                      title={`${cell.date}: ${cell.count} session${cell.count !== 1 ? "s" : ""}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        background: accent,
                        opacity,
                        flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-[var(--muted)]">last 28 days · darker = more sessions</p>
    </div>
  );
}

// ── Energy after sessions ─────────────────────────────────────────────────────

function EnergyChart({
  sessions,
  categories,
  categoryId,
}: {
  sessions: Session[];
  categories: Category[];
  categoryId?: string;
}) {
  const data = energyByDay(sessions, 14, categoryId);
  const hasData = data.some((d) => d.energy > 0);
  if (!hasData) return <Empty text="Rate your energy after sessions and it'll show here." />;

  const maxE = 5;
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 64 }}>
        {data.map((d) => {
          const cat = categories.find((c) => c.id === d.categoryId);
          const { accent } = cat ? accentOf(cat.color) : { accent: "#94a3b8" };
          const heightPct = d.energy > 0 ? (d.energy / maxE) * 100 : 0;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
              <div
                title={d.energy > 0 ? `${d.energy}/5` : "no data"}
                style={{
                  width: "100%",
                  height: `${heightPct}%`,
                  minHeight: d.energy > 0 ? 4 : 0,
                  background: d.energy > 0 ? accent : "var(--border)",
                  borderRadius: "3px 3px 0 0",
                  alignSelf: "flex-end",
                  opacity: d.energy > 0 ? 1 : 0.3,
                }}
              />
              <span style={{ fontSize: 9, color: "var(--muted)" }}>{d.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-[var(--muted)]">
        avg energy rating after sessions · colour = area
      </p>
    </div>
  );
}

// ── Tennis skill confidence bars ──────────────────────────────────────────────

function SkillBars({ sessions, accent }: { sessions: Session[]; accent: string }) {
  const data = skillConfidenceBySkill(sessions);
  const hasData = data.some((d) => d.avgConfidence > 0);

  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = d.avgConfidence > 0 ? (d.avgConfidence / 5) * 100 : 0;
        const color = d.avgConfidence >= 3.5 ? "#1d9e75" : d.avgConfidence >= 2.5 ? "#ef9f27" : d.avgConfidence > 0 ? "#d85a30" : "#cbd5e1";
        return (
          <div key={d.skill} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-[var(--muted)]">{d.skill}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface)]" style={{ height: 7 }}>
              <div
                style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s ease" }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium" style={{ color }}>
              {d.avgConfidence > 0 ? `${d.avgConfidence}` : "—"}
            </span>
          </div>
        );
      })}
      {!hasData && <p className="text-xs text-[var(--muted)]">Rate your skill after each session to see confidence trends.</p>}
      <p className="text-[10px] text-[var(--muted)]">avg confidence rating 1–5 across all logged sessions</p>
    </div>
  );
}

// ── Study session type breakdown ──────────────────────────────────────────────

function StudyBreakdown({ sessions, accent }: { sessions: Session[]; accent: string }) {
  const TYPES = ["Study", "Reading", "Problem set", "Revision", "Past paper", "Group work"];
  const counts = TYPES.map((t) => ({ type: t, count: sessions.filter((s) => s.type === t).length }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  const hasData = counts.some((c) => c.count > 0);
  if (!hasData) return <Empty text="Log study sessions to see your session type breakdown." />;

  return (
    <div className="space-y-2">
      {counts.filter((c) => c.count > 0).map((c) => (
        <div key={c.type} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-[var(--muted)]">{c.type}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface)]" style={{ height: 7 }}>
            <div
              style={{
                width: `${(c.count / max) * 100}%`,
                height: "100%",
                background: accent,
                borderRadius: 99,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span className="w-5 text-right text-xs text-[var(--muted)]">{c.count}</span>
        </div>
      ))}
      <p className="text-[10px] text-[var(--muted)]">session counts all time</p>
    </div>
  );
}

// ── 3-day momentum forecast ───────────────────────────────────────────────────

function ForecastCard({
  sessions,
  checkins,
}: {
  sessions: Session[];
  checkins: { date: string; mental: number }[];
}) {
  const today = todayKey();
  const days = momentumForecast(checkins, sessions, today);
  const todayCheckin = checkins.find((c) => c.date === today);
  const lastScore = todayCheckin?.mental ?? checkins.sort((a, b) => (b.date > a.date ? 1 : -1))[0]?.mental;

  if (!lastScore || checkins.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <SectionLabel>3-day momentum forecast</SectionLabel>
        <p className="text-xs text-[var(--muted)]">Check in for a few days and your forecast will appear here.</p>
      </div>
    );
  }

  const uplift = days.length > 0 ? (days[days.length - 1].withSessions - days[days.length - 1].baseline).toFixed(1) : "0";

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#9fe1cb", background: "var(--surface)" }}>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>3-day momentum forecast</SectionLabel>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "#e1f5ee", color: "#0f6e56" }}
        >
          based on your patterns
        </span>
      </div>

      <div className="mb-4 flex items-end gap-2">
        {/* Today */}
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] text-[var(--muted)]">Today</span>
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" />
          <span className="text-sm font-medium">{lastScore}</span>
        </div>

        {days.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-[var(--muted)]">{d.label}</span>
            {/* baseline */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "#cbd5e1" }} />
              <span className="text-xs text-[var(--muted)]">{d.baseline}</span>
            </div>
            <div className="h-px w-full bg-[var(--border)]" />
            {/* with sessions */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-medium" style={{ color: "#0f6e56" }}>{d.withSessions}</span>
              <div className="h-2 w-2 rounded-full" style={{ background: "#1d9e75" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-4 text-[10px] text-[var(--muted)]">
        <span><span className="inline-block h-2 w-2 rounded-full bg-[#cbd5e1] mr-1" />no change</span>
        <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: "#1d9e75" }} />with sessions</span>
      </div>

      <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: "#e1f5ee", color: "#0f6e56" }}>
        Your check-in score tends to rise after active days. Doing your suggested sessions could lift your mood by +{uplift} pts by {days[days.length - 1]?.label}.
      </div>
    </div>
  );
}

// ── Per-area panels ───────────────────────────────────────────────────────────

function TennisPanel({
  cat,
  sessions,
  categories,
  checkins,
}: {
  cat: Category;
  sessions: Session[];
  categories: Category[];
  checkins: { date: string; mental: number }[];
}) {
  const { accent } = accentOf(cat.color);
  const catSessions = sessions.filter((s) => s.category_id === cat.id);
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const lastSession = [...catSessions].sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  const lastDays = lastSession ? daysBetween(lastSession.date, today) : null;
  const topSkill = skillConfidenceBySkill(catSessions).sort((a, b) => b.avgConfidence - a.avgConfidence)[0];

  return (
    <div className="space-y-4">
      <GoalCard category={cat} />
      <StatRow
        stats={[
          { value: catSessions.filter((s) => s.date.startsWith(thisMonth)).length, label: "sessions this month", color: accent },
          { value: lastDays === null ? "—" : lastDays === 0 ? "today" : `${lastDays}d ago`, label: "last session" },
          { value: topSkill?.avgConfidence > 0 ? `${topSkill.avgConfidence}/5` : "—", label: `best: ${topSkill?.skill ?? "—"}` },
        ]}
      />
      <div>
        <SectionLabel>Skill confidence</SectionLabel>
        <SkillBars sessions={catSessions} accent={accent} />
      </div>
      <div>
        <SectionLabel>Sessions per week</SectionLabel>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent} />
      </div>
      <div>
        <SectionLabel>Energy after sessions</SectionLabel>
        <EnergyChart sessions={sessions} categories={categories} categoryId={cat.id} />
      </div>
      <ForecastCard sessions={sessions} checkins={checkins} />
    </div>
  );
}

function UniPanel({
  cat,
  sessions,
  categories,
  checkins,
}: {
  cat: Category;
  sessions: Session[];
  categories: Category[];
  checkins: { date: string; mental: number }[];
}) {
  const { accent } = accentOf(cat.color);
  const catSessions = sessions.filter((s) => s.category_id === cat.id);
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const streak = currentStreak(catSessions.map((s) => s.date));
  const avgDuration = catSessions.filter((s) => s.duration_minutes).reduce((sum, s, _, arr) =>
    sum + (s.duration_minutes ?? 0) / arr.length, 0);

  return (
    <div className="space-y-4">
      <GoalCard category={cat} />
      <StatRow
        stats={[
          { value: catSessions.filter((s) => s.date.startsWith(thisMonth)).length, label: "sessions this month", color: accent },
          { value: streak > 0 ? `${streak}d` : "—", label: "study streak", color: streak >= 3 ? "#1d9e75" : undefined },
          { value: avgDuration > 0 ? `${Math.round(avgDuration)}m` : "—", label: "avg session" },
        ]}
      />
      <div>
        <SectionLabel>Session type breakdown</SectionLabel>
        <StudyBreakdown sessions={catSessions} accent={accent} />
      </div>
      <div>
        <SectionLabel>Sessions per week</SectionLabel>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent} />
      </div>
      <div>
        <SectionLabel>Energy after sessions</SectionLabel>
        <EnergyChart sessions={sessions} categories={categories} categoryId={cat.id} />
      </div>
      <ForecastCard sessions={sessions} checkins={checkins} />
    </div>
  );
}

function GymPanel({
  cat,
  sessions,
  metrics,
  logs,
  categories,
  checkins,
}: {
  cat: Category;
  sessions: Session[];
  metrics: Metric[];
  logs: MetricLog[];
  categories: Category[];
  checkins: { date: string; mental: number }[];
}) {
  const { accent } = accentOf(cat.color);
  const catSessions = sessions.filter((s) => s.category_id === cat.id);
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const lastSession = [...catSessions].sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  const lastDays = lastSession ? daysBetween(lastSession.date, today) : null;
  const weekSessions = catSessions.filter((s) => s.date >= startOfWeek(today)).length;
  const numeric = metrics.filter((m) => m.category_id === cat.id && (m.type === "numeric" || m.type === "scale"));

  return (
    <div className="space-y-4">
      <GoalCard category={cat} />
      <StatRow
        stats={[
          { value: catSessions.filter((s) => s.date.startsWith(thisMonth)).length, label: "sessions this month", color: accent },
          { value: weekSessions, label: "this week" },
          { value: lastDays === null ? "—" : lastDays === 0 ? "today" : `${lastDays}d ago`, label: "last session" },
        ]}
      />
      <div>
        <SectionLabel>Sessions per week</SectionLabel>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent} />
      </div>
      {numeric.map((m) => (
        <div key={m.id}>
          <SectionLabel>{m.name}{m.unit ? ` (${m.unit})` : ""}</SectionLabel>
          <LineTrend data={metricSeries(logs, m.id)} color={accent} unit={m.unit ?? ""} />
        </div>
      ))}
      <div>
        <SectionLabel>Energy after sessions</SectionLabel>
        <EnergyChart sessions={sessions} categories={categories} categoryId={cat.id} />
      </div>
      <ForecastCard sessions={sessions} checkins={checkins} />
    </div>
  );
}

function GenericPanel({
  cat,
  sessions,
  metrics,
  logs,
  categories,
  checkins,
}: {
  cat: Category;
  sessions: Session[];
  metrics: Metric[];
  logs: MetricLog[];
  categories: Category[];
  checkins: { date: string; mental: number }[];
}) {
  const { accent } = accentOf(cat.color);
  const catSessions = sessions.filter((s) => s.category_id === cat.id);
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const lastSession = [...catSessions].sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  const lastDays = lastSession ? daysBetween(lastSession.date, today) : null;
  const numeric = metrics.filter((m) => m.category_id === cat.id && (m.type === "numeric" || m.type === "scale"));

  return (
    <div className="space-y-4">
      <GoalCard category={cat} />
      <StatRow
        stats={[
          { value: catSessions.filter((s) => s.date.startsWith(thisMonth)).length, label: "sessions this month", color: accent },
          { value: catSessions.length, label: "total logged" },
          { value: lastDays === null ? "—" : lastDays === 0 ? "today" : `${lastDays}d ago`, label: "last session" },
        ]}
      />
      <div>
        <SectionLabel>Sessions per week</SectionLabel>
        <BarTrend data={weeklySessionCounts(sessions, cat.id, 8)} color={accent} />
      </div>
      {numeric.map((m) => (
        <div key={m.id}>
          <SectionLabel>{m.name}{m.unit ? ` (${m.unit})` : ""}</SectionLabel>
          <LineTrend data={metricSeries(logs, m.id)} color={accent} unit={m.unit ?? ""} />
        </div>
      ))}
      <div>
        <SectionLabel>Energy after sessions</SectionLabel>
        <EnergyChart sessions={sessions} categories={categories} categoryId={cat.id} />
      </div>
      <ForecastCard sessions={sessions} checkins={checkins} />
    </div>
  );
}

// ── Overview panel ────────────────────────────────────────────────────────────

function OverviewPanel({
  sessions,
  tasks,
  checkins,
  categories,
}: {
  sessions: Session[];
  tasks: { completed_at?: string | null }[];
  checkins: { date: string; mental: number }[];
  categories: Category[];
}) {
  const today = todayKey();
  const weekStart = startOfWeek(today);
  const thisMonth = today.slice(0, 7);
  const sessionsThisMonth = sessions.filter((s) => s.date.startsWith(thisMonth)).length;
  const tasksDoneThisWeek = tasks.filter((t) => t.completed_at && t.completed_at.slice(0, 10) >= weekStart).length;
  const studyCat = categories.find((c) => c.name === "Uni work");
  const studySessions = sessions.filter((s) => s.category_id === studyCat?.id);
  const streak = currentStreak(studySessions.map((s) => s.date));

  return (
    <div className="space-y-4">
      <GoalsOverview categories={categories} />
      <StatRow
        stats={[
          { value: sessionsThisMonth, label: "sessions this month" },
          { value: tasksDoneThisWeek, label: "tasks done this week" },
          { value: streak > 0 ? `${streak}d` : "—", label: "study streak", color: streak >= 3 ? "#1d9e75" : undefined },
        ]}
      />
      <div>
        <SectionLabel>Activity — last 28 days</SectionLabel>
        <HeatmapChart sessions={sessions} categories={categories} />
      </div>
      <div>
        <SectionLabel>Energy after sessions</SectionLabel>
        <EnergyChart sessions={sessions} categories={categories} />
      </div>
      <ForecastCard sessions={sessions} checkins={checkins} />
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

function Tab({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:scale-[1.05] hover:opacity-100"
      style={{
        background: active ? color : "var(--surface)",
        color: active ? "#fff" : "var(--muted)",
        border: `1px solid ${active ? color : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  return (
    <Suspense fallback={null}>
      <TrendsContent />
    </Suspense>
  );
}

function TrendsContent() {
  const { data: categories = [] } = useCategories();
  const { data: sessions = [] } = useSessions();
  const { data: tasks = [] } = useTasks();
  const { data: checkins = [] } = useCheckins();
  const { data: metrics = [] } = useMetrics();
  const { data: logs = [] } = useMetricLogs();

  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(() => searchParams.get("area") ?? "overview");
  const activeCats = categories.filter((c) => c.active);

  // Deep link: ?area=<id> from elsewhere in the app jumps straight to that tab.
  useEffect(() => {
    const area = searchParams.get("area");
    if (area) setSelected(area);
  }, [searchParams]);

  // Fall back to Overview if the linked area no longer exists.
  useEffect(() => {
    if (selected !== "overview" && categories.length > 0 && !categories.find((c) => c.id === selected)) {
      setSelected("overview");
    }
  }, [categories, selected]);
  const selectedCat = activeCats.find((c) => c.id === selected);
  const checkinData = checkins.map((c) => ({ date: c.date, mental: c.mental }));

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        <Tab label="Overview" active={selected === "overview"} color="#334155" onClick={() => setSelected("overview")} />
        {activeCats.map((cat) => {
          const { accent } = accentOf(cat.color);
          return (
            <Tab
              key={cat.id}
              label={`${cat.icon} ${cat.name}`}
              active={selected === cat.id}
              color={accent}
              onClick={() => setSelected(cat.id)}
            />
          );
        })}
      </div>

      {selected === "overview" && (
        <OverviewPanel sessions={sessions} tasks={tasks} checkins={checkinData} categories={activeCats} />
      )}

      {selectedCat?.name === "Tennis" && (
        <TennisPanel cat={selectedCat} sessions={sessions} categories={activeCats} checkins={checkinData} />
      )}

      {selectedCat?.name === "Uni work" && (
        <UniPanel cat={selectedCat} sessions={sessions} categories={activeCats} checkins={checkinData} />
      )}

      {selectedCat?.name === "Gym" && (
        <GymPanel cat={selectedCat} sessions={sessions} metrics={metrics} logs={logs} categories={activeCats} checkins={checkinData} />
      )}

      {selectedCat && !["Tennis", "Uni work", "Gym"].includes(selectedCat.name) && (
        <GenericPanel cat={selectedCat} sessions={sessions} metrics={metrics} logs={logs} categories={activeCats} checkins={checkinData} />
      )}
    </div>
  );
}
