-- Phase 4 C: one-tap logging
-- Run after schema.sql. Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).

-- C1: carry session_type on suggestions so accept → Session knows the type.
alter table suggestions
  add column if not exists session_type text;
