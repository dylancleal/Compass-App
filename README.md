# Compass — personal life dashboard

An affirming, calm to-do list + life tracker. Built per `SPEC.md`. **Phase 1** is
complete: a fully usable app that runs locally with zero credentials.

## What's in Phase 1

- **Today** screen: daily greeting, check-in entry/summary, a rule-based
  personalised plan, quick-log buttons, and quick-tick tasks.
- **Daily check-in**: context-aware flow (core wellbeing + gym/tennis questions
  on scheduled days), delightful and skippable.
- **Areas (categories)**: data-driven, editable, recolourable, reorderable, with
  tasks (satisfying tick-off + confetti), session/metric logging, and trends.
- **Uni**: tasks, upcoming deadlines, study-session logging (the learning-science
  engine lands in Phase 3).
- **Trends/Review**: affirmation-first weekly review + per-category charts.
- **Settings**: areas, weekly schedule, planner-weight tuning, integration status.
- **PWA**: installs to your home screen and works offline.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Default categories/metrics are seeded automatically.
All data is stored in your browser's `localStorage` — no account needed.

## Tech

Next.js (App Router) + TypeScript · Tailwind CSS v4 · Recharts · TanStack Query.
The data layer (`lib/db`) is an interface with two implementations:
`LocalDB` (default) and `SupabaseDB` (ready to switch on).

## Switching to cloud sync (Supabase) — needs your account

Phase 1 runs local-first. To sync across devices later:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` (creates tables + RLS).
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_DATA_BACKEND=supabase
   ```
4. Restart `npm run dev`. The app now reads/writes Supabase (per-user via RLS).

> Auth (magic-link) wiring plugs into the same client and is part of finishing the
> Supabase switch — ask before we set it up, since it touches your credentials.

## Deploying (Vercel) — needs your account

Not done yet (you chose to skip for now). When ready: push to GitHub, import the
repo on [vercel.com](https://vercel.com), add the same env vars, and deploy.

## Roadmap

- **Phase 2**: Google Calendar (OAuth read/write), smarter planner, weekly review.
- **Phase 3**: OnTrack/Doubtfire sync, time-estimation learning, backwards
  planning/burn-down, cited study-technique engine.
