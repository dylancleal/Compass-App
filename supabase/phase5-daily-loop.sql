-- Phase 5: daily loop improvements
-- Run after schema.sql. Safe to re-run (IF NOT EXISTS guards).

-- F2: personal_insight column on suggestions (learning visible).
-- LocalDB handles this automatically (JSON storage).
alter table suggestions
  add column if not exists personal_insight text;
