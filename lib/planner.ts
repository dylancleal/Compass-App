import type {
  AppSettings,
  CalendarBlock,
  Capacity,
  Category,
  Checkin,
  Session,
  SessionTemplate,
  Suggestion,
  Task,
} from "@/lib/types";
import { addDays, dayIndex, daysBetween, todayKey } from "@/lib/date";
import { getNextGymType, TENNIS_SKILLS, getUTRSkillWeights } from "@/lib/science";
import { resolveSession } from "@/lib/science/resolve";
import { detectDomain } from "@/lib/categorySetup";
import { getPersonalStats, blendedDuration } from "@/lib/personalStats";

// Transparent, rule-based "Personalised Day" engine (SPEC §6). It scores each
// category by neglect × readiness × deadline urgency × balance, then turns the
// top few into gentle, affirming suggestions sized to today's capacity.
//
// It never invents hard commitments — every suggestion is grounded in a real
// task, a real schedule entry, or a real recent-activity gap.

export interface PlannerInput {
  date: string;
  checkin?: Checkin;
  assume?: { capacity: Capacity; mental: number; uni_readiness: number };
  categories: Category[];
  tasks: Task[];
  sessions: Session[];
  settings: AppSettings;
  calendarBlocks?: CalendarBlock[]; // today's blocks — used to avoid double-suggesting covered areas
  library: SessionTemplate[];       // data-driven science library (A3)
}

export type DraftSuggestion = Omit<Suggestion, "id" | "created_at">;

const CAPACITY_BUDGET: Record<string, { count: number; minutes: number }> = {
  light: { count: 2, minutes: 75 },
  medium: { count: 3, minutes: 150 },
  big: { count: 4, minutes: 240 },
};

const SCHEDULED: Record<string, keyof AppSettings["weeklySchedule"]> = {
  Gym: "gym",
  Tennis: "tennis",
  "Uni work": "study",
};

function weeklyCount(catSessions: Session[], date: string): number {
  const weekStart = addDays(date, -(dayIndex(date)));
  return catSessions.filter((s) => s.date >= weekStart).length;
}

function lastActivity(cat: Category, input: PlannerInput): string | undefined {
  const dates: string[] = [];
  for (const s of input.sessions) if (s.category_id === cat.id) dates.push(s.date);
  for (const t of input.tasks)
    if (t.category_id === cat.id && t.completed_at) dates.push(t.completed_at.slice(0, 10));
  dates.sort();
  return dates[dates.length - 1];
}

function studyStreak(input: PlannerInput): number {
  const uni = input.categories.find((c) => c.name === "Uni work");
  if (!uni) return 0;
  const studyDays = new Set(
    input.sessions.filter((s) => s.category_id === uni.id).map((s) => s.date),
  );
  let streak = 0;
  let cursor = input.date;
  // Count back from today (today optional) while consecutive days have study.
  for (let i = 0; i < 60; i++) {
    if (studyDays.has(cursor)) streak++;
    else if (i > 0) break; // allow today to be empty without breaking the run
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function nearestDueTask(cat: Category, input: PlannerInput): Task | undefined {
  return input.tasks
    .filter((t) => t.category_id === cat.id && t.status !== "complete" && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
}

function isScheduledToday(cat: Category, input: PlannerInput): boolean {
  const key = SCHEDULED[cat.name];
  if (!key) return false;
  return input.settings.weeklySchedule[key].includes(dayIndex(input.date) as never);
}

interface Scored {
  cat: Category;
  score: number;
  task?: Task;
  reasonBits: string[];
}

export function scoreCategories(input: PlannerInput): Scored[] {
  const w = input.settings.plannerWeights;
  const uniReadiness = input.checkin?.uni_readiness ?? input.assume?.uni_readiness ?? 3;
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;

  return input.categories
    .filter((c) => c.active)
    .map((cat) => {
      const reasonBits: string[] = [];

      // Neglect: days since last activity, normalised to ~2 weeks.
      const last = lastActivity(cat, input);
      const isFresh = !last; // no sessions and no completed tasks ever
      const sinceDays = last ? daysBetween(last, input.date) : 14;
      const neglect = Math.min(sinceDays, 14) / 14;
      if (isFresh) reasonBits.push("starting fresh");
      else if (sinceDays >= 5) reasonBits.push(`it's been ${sinceDays} days`);

      // Deadline urgency from the nearest open task.
      const task = nearestDueTask(cat, input);
      let deadline = 0;
      if (task?.due_date) {
        const days = daysBetween(input.date, task.due_date);
        deadline = days <= 0 ? 1 : Math.max(0, 1 - days / 10);
        if (days >= 0 && days <= 7)
          reasonBits.push(days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`);
      }

      // Readiness: uni scales with uni_readiness; physical categories with how
      // you feel mentally and whether today is a scheduled day for them.
      let readiness = 0.5;
      if (cat.name === "Uni work") readiness = uniReadiness / 5;
      else if (SCHEDULED[cat.name]) readiness = (mental / 5) * 0.7 + (isScheduledToday(cat, input) ? 0.3 : 0);
      if (isScheduledToday(cat, input)) reasonBits.push("it's on today's schedule");

      // Metadata weekly_goal: if the user is behind on their weekly target,
      // boost neglect to surface the category sooner.
      const meta = cat.metadata;
      const weeklyGoal =
        meta?.weekly_goal ?? meta?.tennis_weekly_goal ?? meta?.custom_weekly_goal;
      if (weeklyGoal) {
        const weekStart = addDays(input.date, -(dayIndex(input.date)));
        const sessionsThisWeek = input.sessions.filter(
          (s) => s.category_id === cat.id && s.date >= weekStart,
        ).length;
        const weeklyProgress = sessionsThisWeek / weeklyGoal;
        if (weeklyProgress < 0.5) {
          reasonBits.push(`${sessionsThisWeek}/${weeklyGoal} sessions this week`);
        }
      }

      let score =
        w.neglect * neglect + w.deadline * deadline + w.readiness * readiness;

      // If the calendar already has a busy block for this category today,
      // suppress the suggestion — the activity is already happening.
      // Physical categories (gym, sport) get near-silenced; mental categories
      // (study) get a lighter suppression since a lecture ≠ independent study.
      const coveredByCalendar = (input.calendarBlocks ?? []).some(
        (b) => b.category_id === cat.id && b.busy && !b.all_day,
      );
      if (coveredByCalendar) {
        const isPhysical =
          /gym|tennis|swim|run|jog|cycl|bike|hike|yoga|sport|fitness|athlet|box|martial|rugby|football|soccer|basketball|cricket/i.test(
            cat.name,
          );
        score *= isPhysical ? 0.08 : 0.65;
      }

      return { cat, score, task, reasonBits };
    })
    .sort((a, b) => b.score - a.score);
}

function gymSuggestion(s: Scored, input: PlannerInput, lighter: boolean): DraftSuggestion {
  const catSessions = input.sessions.filter((sess) => sess.category_id === s.cat.id);
  const lastSession = [...catSessions].sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  const experience = s.cat.metadata?.experience;
  const nextType = lighter ? "Recovery" : getNextGymType(lastSession?.type ?? "");
  const { sessionType, science } = resolveSession(input.library, "gym", nextType, { experience });
  const stats = getPersonalStats(catSessions, s.cat.id);
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;
  const est = blendedDuration(science.durationMin, stats, mental);

  const planLines = science.plan.map((p) => `· ${p}`).join("\n");
  const text = `${sessionType} day — ~${est} min\n${planLines}`;

  const personalNote = stats.hasEnoughData
    ? ` Your recent sessions average ${stats.avgDurationMin} min — blended in.`
    : "";
  const isFreshGym = catSessions.length === 0;
  const reasonBase = isFreshGym
    ? "A great place to start — here's your first session plan."
    : s.reasonBits.length
    ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
    : `Keeping your gym momentum going.`;
  const reason = `${reasonBase} ${science.whyItWorks}`.trim();

  const wCount = weeklyCount(catSessions, input.date);
  const wGoal = s.cat.metadata?.weekly_goal;
  const personal_insight = wGoal
    ? `${wCount}/${wGoal} gym sessions this week${wCount >= wGoal ? " ✓" : ""}`
    : stats.hasEnoughData
    ? `Your avg: ${stats.avgDurationMin} min — sized for you`
    : undefined;

  return { date: input.date, category_id: s.cat.id, text, reason, est_minutes: est, status: "pending", session_type: sessionType, personal_insight };
}

function tennisSuggestion(s: Scored, input: PlannerInput, lighter: boolean): DraftSuggestion {
  const catSessions = input.sessions.filter((sess) => sess.category_id === s.cat.id);
  const stats = getPersonalStats(catSessions, s.cat.id);
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;

  // Low-readiness day → suggest a Match (fun, no technical pressure) or rest.
  if (lighter) {
    const { science } = resolveSession(input.library, "tennis", "Match", {});
    const est = blendedDuration(science.durationMin, stats, mental);
    const planLines = science.plan.map((p) => `· ${p}`).join("\n");
    const text = `Match play — ~${est} min\n${planLines}`;
    const reason = `Easy day — match play keeps you sharp without the mental load of technical drilling. ${science.whyItWorks}`;
    const wCountT = weeklyCount(catSessions, input.date);
    const wGoalT = s.cat.metadata?.tennis_weekly_goal ?? s.cat.metadata?.weekly_goal;
    const personal_insight = wGoalT
      ? `${wCountT}/${wGoalT} tennis sessions this week${wCountT >= wGoalT ? " ✓" : ""}`
      : stats.hasEnoughData ? `Your avg: ${stats.avgDurationMin} min` : undefined;
    return { date: input.date, category_id: s.cat.id, text, reason, est_minutes: est, status: "pending", session_type: "Match", personal_insight };
  }

  // Score each core skill by neglect (how long since last practised) and
  // inverse confidence (low confidence = needs more work).
  const skillScores: Record<string, { score: number; daysSince: number; lastConfidence: number | undefined }> = {};

  const utr = s.cat.metadata?.utr;
  const utrWeights = getUTRSkillWeights(utr);

  for (const skill of TENNIS_SKILLS) {
    const skillSessions = catSessions
      .filter((sess) => sess.type === skill)
      .sort((a, b) => (b.date > a.date ? 1 : -1));

    const last = skillSessions[0];
    const daysSince = last ? daysBetween(last.date, input.date) : 14;
    const neglect = Math.min(daysSince, 14) / 14;

    // Find the most recent session with a skill_confidence rating.
    const lastRated = skillSessions.find(
      (sess) => (sess.payload?.feedback as { skill_confidence?: number } | undefined)?.skill_confidence,
    );
    const lastConfidence = (lastRated?.payload?.feedback as { skill_confidence?: number } | undefined)
      ?.skill_confidence;
    const needsWork = lastConfidence ? 1 - (lastConfidence - 1) / 4 : 0.5;

    skillScores[skill] = {
      score: (neglect * 0.5 + needsWork * 0.5) * (utrWeights[skill] ?? 1.0),
      daysSince,
      lastConfidence,
    };
  }

  const [recommendedSkill, meta] = Object.entries(skillScores).sort((a, b) => b[1].score - a[1].score)[0];
  const { science } = resolveSession(input.library, "tennis", recommendedSkill, { level: utr });
  const est = blendedDuration(science.durationMin, stats, mental);

  const planLines = science.plan.map((p) => `· ${p}`).join("\n");
  const text = `${recommendedSkill} focus — ~${est} min\n${planLines}`;

  const wCountTennis = weeklyCount(catSessions, input.date);
  const wGoalTennis = s.cat.metadata?.tennis_weekly_goal ?? s.cat.metadata?.weekly_goal;
  const tennisPInsight = wGoalTennis
    ? `${wCountTennis}/${wGoalTennis} tennis sessions this week${wCountTennis >= wGoalTennis ? " ✓" : ""}`
    : stats.hasEnoughData
    ? `Your avg: ${stats.avgDurationMin} min`
    : undefined;

  const isNewTennis = catSessions.length === 0;
  const neglectNote = isNewTennis
    ? `A great place to start — let's begin with your ${recommendedSkill.toLowerCase()}.`
    : meta.daysSince >= 7
    ? `You haven't worked on your ${recommendedSkill.toLowerCase()} in ${meta.daysSince} days.`
    : s.reasonBits.length
    ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
    : `Keeping your tennis balanced.`;
  const confidenceNote = meta.lastConfidence
    ? ` Last time you rated it ${meta.lastConfidence}/5 — ${meta.lastConfidence <= 2 ? "still room to grow." : meta.lastConfidence >= 4 ? "building nicely." : "getting there."}`
    : "";
  const personalNote = stats.hasEnoughData
    ? ` Your recent sessions average ${stats.avgDurationMin} min.`
    : "";

  const reason = `${neglectNote}${confidenceNote} ${science.whyItWorks}${personalNote}`.trim();

  return { date: input.date, category_id: s.cat.id, text, reason, est_minutes: est, status: "pending", session_type: recommendedSkill, personal_insight: tennisPInsight };
}

type StudyCategory = "reading" | "assignment" | "exam";

const EXAM_KEYWORDS = ["exam", "test", "quiz", "midterm", "final", "midsem", "end-sem"];
const READING_KEYWORDS = ["reading", "read", "chapter", "textbook", "article", "paper", "literature"];

function classifyStudyTask(task?: Task): StudyCategory {
  if (!task) return "assignment";
  const t = task.title.toLowerCase();
  if (EXAM_KEYWORDS.some((w) => t.includes(w))) return "exam";
  if (READING_KEYWORDS.some((w) => t.includes(w))) return "reading";
  return "assignment";
}

// How much study work has gone in recently — used to modulate urgency tone.
function studyMomentum(catSessions: Session[], date: string): "high" | "medium" | "low" {
  const recent = catSessions.filter((s) => daysBetween(s.date, date) <= 5);
  const totalMinutes = recent.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  if (recent.length >= 3 || totalMinutes >= 150) return "high";
  if (recent.length >= 1 || totalMinutes >= 30) return "medium";
  return "low";
}

// Short deadline messages, 2 sentences max, split by study category.
// Tone shifts with momentum so a well-prepped person never gets urgency language.
function deadlineUrgencyReason(
  momentum: "high" | "medium" | "low",
  lowWellbeing: boolean,
  daysLeft: number,
  studyCategory: StudyCategory,
  firstStep?: string,
): string {
  const due = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const step = firstStep ? ` Start with: ${firstStep}.` : "";

  if (studyCategory === "exam") {
    if (momentum === "high") {
      return daysLeft <= 1
        ? "You've done the work — light review and get good sleep. Sleep consolidates everything you've studied."
        : `Well-prepped for ${due} — do a timed past paper to lock in the exam-day feeling.`;
    }
    if (momentum === "medium") {
      return lowWellbeing
        ? `Exam ${due} and you've been making progress. One revision block today, then rest.`
        : `Exam ${due} — past paper practice is the highest-yield thing you can do right now.`;
    }
    return lowWellbeing
      ? `Exam ${due} and prep has been limited — focus on the highest-probability topics only.`
      : `Exam ${due} with limited prep — core concepts and past papers only, no new material.`;
  }

  if (studyCategory === "reading") {
    if (momentum === "high") {
      return "You've covered most of it — skim the remaining sections and you're done.";
    }
    if (momentum === "medium") {
      return lowWellbeing
        ? `Reading due ${due} and you've made a start. One more block finishes it.`
        : `Reading due ${due} and progress is good. One focused session and it's done.`;
    }
    return lowWellbeing
      ? `Reading due ${due} — even tired, active reading beats passive skimming.`
      : `Reading due ${due} — get the main argument first, fill in the detail second.${step}`;
  }

  // assignment
  if (momentum === "high") {
    return lowWellbeing
      ? "You've done the hard part — a short block to tie it together is all you need."
      : `Due ${due} and you've put in the work. One session to finish and you're done.`;
  }
  if (momentum === "medium") {
    return lowWellbeing
      ? `You've made a start and it's due ${due}. A single block today keeps it moving.`
      : `Due ${due} and you've been making progress. One focused session gets you home.`;
  }
  return lowWellbeing
    ? `Due ${due} and there's still ground to cover — even one block now genuinely changes this.${step}`
    : `Due ${due} with work still to do — now is the moment.${step}`;
}

function studySuggestion(s: Scored, input: PlannerInput, lighter: boolean, task?: Task): DraftSuggestion {
  const catSessions = input.sessions.filter((sess) => sess.category_id === s.cat.id);
  const sortedSessions = [...catSessions].sort((a, b) => (b.date > a.date ? 1 : -1));
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;
  const cap = input.checkin?.capacity ?? input.assume?.capacity ?? "medium";
  const stats = getPersonalStats(catSessions, s.cat.id);
  const momentum = studyMomentum(catSessions, input.date);
  const lowWellbeing = mental <= 2 || cap === "light";
  const studyCat = classifyStudyTask(task);

  const daysToDeadline = task?.due_date ? daysBetween(input.date, task.due_date) : undefined;
  const recentTypes = sortedSessions.slice(0, 5).map((sess) => sess.type);
  const lastType = recentTypes[0];
  const sameLast3 = recentTypes.length >= 3 && recentTypes.slice(0, 3).every((t) => t === lastType);
  const lastRevision = sortedSessions.find((sess) => sess.type === "Revision");
  const daysSinceRevision = lastRevision ? daysBetween(lastRevision.date, input.date) : 999;
  const isDeadlineUrgent = daysToDeadline !== undefined && daysToDeadline <= 3;

  // ── Session type selection — branched by what kind of work this actually is ─
  let sessionType: string;
  let selectionReason: string;

  if (studyCat === "reading") {
    // Reading tasks: session type is always Reading.
    // Wellbeing only affects block count, not the type of work.
    sessionType = "Reading";
    selectionReason = lowWellbeing
      ? "Low energy — a shorter reading block beats skipping it entirely."
      : s.reasonBits.length
      ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
      : "Keeping your reading rhythm going.";

  } else if (studyCat === "exam") {
    // Exam tasks: session type shifts by days remaining (understanding → testing → retrieval).
    if (lowWellbeing) {
      sessionType = "Revision";
      selectionReason = "Low energy — light retrieval practice is the right call before an exam.";
    } else if (daysToDeadline !== undefined && daysToDeadline <= 1) {
      sessionType = "Revision";
      selectionReason = "Exam tomorrow — retrieval practice and early sleep beat any last-minute cramming.";
    } else if (daysToDeadline !== undefined && daysToDeadline <= 3) {
      sessionType = momentum === "high" ? "Revision" : "Past paper";
      selectionReason = momentum === "high"
        ? "Exam very close — consolidate what you know, no new material."
        : `Exam in ${daysToDeadline} days — timed past papers are the highest-yield prep now.`;
    } else if (daysToDeadline !== undefined && daysToDeadline <= 7) {
      sessionType = "Past paper";
      selectionReason = `Exam in ${daysToDeadline} days — start testing yourself to find the gaps.`;
    } else {
      // >7 days: build understanding before switching to testing
      sessionType = momentum === "high" ? "Problem set" : "Study";
      selectionReason = momentum === "high"
        ? "Solid prep momentum — apply the material with problem sets."
        : "Plenty of time — understanding the material first, testing later.";
    }

  } else {
    // Assignment: existing multi-signal logic, but lowWellbeing → Study (keep working)
    // not Revision (which requires retrieval energy assignments don't have yet).
    if (lowWellbeing) {
      sessionType = "Study";
      selectionReason = "Low-energy day — a steady working session keeps things moving without overloading.";
    } else if (isDeadlineUrgent && daysToDeadline! <= 1) {
      sessionType = "Revision";
      selectionReason = daysToDeadline! <= 0
        ? "Due today — retrieval practice, not more reading."
        : "Due tomorrow — revision is the highest-yield thing you can do right now.";
    } else if (isDeadlineUrgent && momentum !== "high") {
      sessionType = lastType === "Problem set" ? "Revision" : "Problem set";
      selectionReason = `Due in ${daysToDeadline} days — time to test yourself, not just review.`;
    } else if (isDeadlineUrgent && momentum === "high") {
      sessionType = "Revision";
      selectionReason = `Due in ${daysToDeadline} days and you've been at it — consolidate what you've built.`;
    } else if (mental >= 4 && (lastType === "Study" || lastType === "Reading")) {
      sessionType = "Problem set";
      selectionReason = "High energy after recent study — good time to apply it.";
    } else if (daysToDeadline !== undefined && daysToDeadline <= 14 && lastType === "Study") {
      sessionType = "Problem set";
      selectionReason = `Due in ${daysToDeadline} days — testing yourself now is more effective than more reading.`;
    } else if (sameLast3 && lastType) {
      const NEXT: Record<string, string> = {
        Study: "Problem set",
        Reading: "Study",
        "Problem set": "Revision",
        Revision: "Study",
        "Group work": "Study",
      };
      sessionType = NEXT[lastType] ?? "Study";
      selectionReason = `Three ${lastType.toLowerCase()} sessions in a row — switching it up.`;
    } else if (daysSinceRevision >= 3 && daysSinceRevision <= 7 && lastType !== "Revision") {
      sessionType = "Revision";
      selectionReason = `${daysSinceRevision} days since your last revision — good spacing for memory consolidation.`;
    } else {
      sessionType = stats.preferredType ?? "Study";
      selectionReason = s.reasonBits.length
        ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
        : "Keeping your study rhythm going.";
    }
  }

  // ── Duration + block count ────────────────────────────────────────────────
  const blocks =
    isDeadlineUrgent && momentum === "high" && lowWellbeing
      ? 1
      : lowWellbeing
      ? 1
      : cap === "big"
      ? 3
      : 2;

  const { science } = resolveSession(input.library, "uni", sessionType, {});
  const scienceBase = lowWellbeing
    ? Math.round(science.durationMin * 0.6)
    : cap === "big"
    ? Math.min(Math.round(science.durationMin * 1.3), 90)
    : science.durationMin;
  const est = blendedDuration(scienceBase, stats, mental);

  // ── Text ─────────────────────────────────────────────────────────────────
  const blockHeader = `${blocks} × 25-min block${blocks === 1 ? "" : "s"} · ${sessionType} · ~${est} min\n`;
  const taskLine = task
    ? `Task: ${task.title}${task.first_step ? ` · start with: ${task.first_step}` : ""}\n`
    : "";
  const planLines = science.plan.map((p) => `· ${p}`).join("\n");
  const text = `${blockHeader}${taskLine}${planLines}`;

  // ── Reason — 2 sentences max ──────────────────────────────────────────────
  // Deadline urgent → momentum-aware message (already split by study category).
  // Otherwise → selection reason, optionally with personal average appended.
  const reason = isDeadlineUrgent
    ? deadlineUrgencyReason(momentum, lowWellbeing, daysToDeadline!, studyCat, task?.first_step)
    : stats.hasEnoughData
    ? `${selectionReason} Recent sessions average ${stats.avgDurationMin} min.`
    : selectionReason;

  const streak = studyStreak(input);
  const wCountStudy = weeklyCount(catSessions, input.date);
  const wGoalStudy = s.cat.metadata?.weekly_goal ?? 5;
  const study_insight = streak >= 2
    ? `${streak}-day study streak 🔥`
    : wCountStudy > 0
    ? `${wCountStudy}/${wGoalStudy} study sessions this week`
    : undefined;

  return { date: input.date, category_id: s.cat.id, text, reason, est_minutes: est, status: "pending", session_type: sessionType, personal_insight: study_insight };
}

function suggestionText(s: Scored, input: PlannerInput, lighter: boolean): DraftSuggestion {
  const { cat, task } = s;

  if (cat.name === "Gym") return gymSuggestion(s, input, lighter);
  if (cat.name === "Tennis") return tennisSuggestion(s, input, lighter);
  if (cat.name === "Uni work") return studySuggestion(s, input, lighter, task);

  const cap = input.checkin?.capacity ?? input.assume?.capacity ?? "medium";
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;
  const block = lighter ? 45 : cap === "big" ? 90 : 60;
  const meta = cat.metadata;
  const domain = detectDomain(cat.name);

  // Job searching and Finances: custom logic not suited to science-structured plans.
  if (cat.name === "Job searching" || meta?.applications_per_week) {
    let text = task ? `Move ${task.title} forward.` : "Send one application or follow up on a lead.";
    if (meta?.role_type) text += ` (${meta.role_type} roles)`;
    const reason = s.reasonBits.length
      ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
      : `A balanced choice to keep ${cat.name} ticking along.`;
    return { date: input.date, category_id: cat.id, text, reason, est_minutes: 30, status: "pending", session_type: "Session" };
  }
  if (cat.name === "Finances" || meta?.review_frequency) {
    const targetStr = meta?.savings_target ? ` — target: $${meta.savings_target}` : "";
    const text = task ? `Tick along ${task.title}.` : `A quick check-in on your savings${targetStr}.`;
    const est = meta?.review_frequency === "weekly" ? 20 : 15;
    const reason = s.reasonBits.length
      ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.`
      : `A balanced choice to keep ${cat.name} ticking along.`;
    return { date: input.date, category_id: cat.id, text, reason, est_minutes: est, status: "pending", session_type: "Session" };
  }

  // For domains with library templates (running, swimming, generic, custom): use resolver.
  // This is what makes running/swimming/any custom domain produce a structured, cited plan.
  const domainTemplates = input.library.filter((t) => t.domain === domain);
  if (domainTemplates.length > 0) {
    const catSessions = input.sessions.filter((sess) => sess.category_id === cat.id);
    const stats = getPersonalStats(catSessions, cat.id);
    const lastType = [...catSessions].sort((a, b) => b.date.localeCompare(a.date))[0]?.type;
    const preferredType =
      domainTemplates.find((t) => t.session_type === lastType)?.session_type ??
      domainTemplates[0].session_type;
    const { sessionType: resolvedType, science } = resolveSession(input.library, domain, preferredType, {});
    const est = blendedDuration(lighter ? Math.round(science.durationMin * 0.7) : science.durationMin, stats, mental);
    const planLines = science.plan.map((p) => `· ${p}`).join("\n");
    const taskLine = task ? `Task: ${task.title}\n` : "";
    const text = `${resolvedType} — ~${est} min\n${taskLine}${planLines}`;
    const successNote = meta?.success_description
      ? ` Goal: ${meta.success_description.slice(0, 80)}${meta.success_description.length > 80 ? "…" : ""}`
      : "";
    const reason = s.reasonBits.length
      ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}. ${science.whyItWorks}${successNote}`.trim()
      : `${science.whyItWorks}${successNote}`.trim();
    const wCountLib = weeklyCount(catSessions, input.date);
    const wGoalLib = meta?.weekly_goal ?? meta?.custom_weekly_goal;
    const lib_insight = wGoalLib
      ? `${wCountLib}/${wGoalLib} sessions this week${wCountLib >= wGoalLib ? " ✓" : ""}`
      : stats.hasEnoughData
      ? `Your avg: ${stats.avgDurationMin} min`
      : undefined;
    return { date: input.date, category_id: cat.id, text, reason, est_minutes: est, status: "pending", session_type: resolvedType, personal_insight: lib_insight };
  }

  // True fallback for categories with no domain templates (finance-like custom cats, etc.).
  let text: string;
  const est = block;
  if (meta?.success_description) {
    text = task
      ? `Work on ${task.title}.`
      : `A session towards: ${meta.success_description.slice(0, 60)}${meta.success_description.length > 60 ? "…" : ""}`;
  } else if (task) {
    text = `Spend a little time on ${task.title}.`;
  } else {
    text = `A small step in ${cat.name}.`;
  }
  const successNote = meta?.success_description
    ? ` Goal: ${meta.success_description.slice(0, 80)}${meta.success_description.length > 80 ? "…" : ""}`
    : "";
  const reason = s.reasonBits.length
    ? `Suggested because ${s.reasonBits.slice(0, 2).join(" and ")}.${successNote}`
    : `A balanced choice to keep ${cat.name} ticking along.${successNote}`;
  return { date: input.date, category_id: cat.id, text, reason, est_minutes: est, status: "pending", session_type: "Session" };
}

export function buildPlan(input: PlannerInput): DraftSuggestion[] {
  const cap = input.checkin?.capacity ?? input.assume?.capacity ?? "medium";
  const mental = input.checkin?.mental ?? input.assume?.mental ?? 3;
  const uniReadiness = input.checkin?.uni_readiness ?? input.assume?.uni_readiness ?? 3;
  const lowReadiness = mental <= 2 || uniReadiness <= 2 || cap === "light";

  const budget = CAPACITY_BUDGET[cap];
  const scored = scoreCategories(input);

  const out: DraftSuggestion[] = [];
  let minutes = 0;
  const usedCats = new Set<string>();

  for (const s of scored) {
    if (out.length >= budget.count) break;
    if (usedCats.has(s.cat.id)) continue; // balance: one per category
    const draft = suggestionText(s, input, lowReadiness);
    if (minutes + (draft.est_minutes ?? 0) > budget.minutes + 30) continue;
    out.push(draft);
    usedCats.add(s.cat.id);
    minutes += draft.est_minutes ?? 0;
  }

  // Respect rest (SPEC §3.6): on low-readiness days, lead with permission to rest.
  if (lowReadiness) {
    out.unshift({
      date: input.date,
      text: "Take it easy today — rest is a legitimate, productive choice.",
      reason:
        mental <= 2
          ? "You said you're feeling low today, so a lighter day is the right call."
          : "You marked today as a Light day, so we've kept this gentle.",
      est_minutes: 0,
      status: "pending",
    });
  }

  // Affirm a study streak if there is one (surface what you HAVE done, SPEC §4).
  const streak = studyStreak(input);
  if (streak >= 2) {
    out.push({
      date: input.date,
      text: `You've studied ${streak} day${streak === 1 ? "" : "s"} in a row — lovely momentum.`,
      reason: "Surfacing your recent consistency so it's the first thing you see.",
      est_minutes: 0,
      status: "accepted",
    });
  }

  return out;
}

export function todaysPlannerInput(
  partial: Omit<PlannerInput, "date">,
): PlannerInput {
  return { ...partial, date: todayKey() };
}
