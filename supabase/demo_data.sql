-- Compass demo data — paste into the Supabase SQL editor (postgres role is fine).
-- Fetches your user ID from auth.users automatically (assumes single-user dev setup).
-- Safe to re-run: clears existing data first.

DO $$
DECLARE
  uid uuid;
  cat_uni    uuid := '11111111-0000-0000-0000-000000000001';
  cat_job    uuid := '11111111-0000-0000-0000-000000000002';
  cat_tennis uuid := '11111111-0000-0000-0000-000000000003';
  cat_gym    uuid := '11111111-0000-0000-0000-000000000004';
  cat_fin    uuid := '11111111-0000-0000-0000-000000000005';
  m_study    uuid := '22222222-0000-0000-0000-000000000001';
  m_apps     uuid := '22222222-0000-0000-0000-000000000002';
  m_utr      uuid := '22222222-0000-0000-0000-000000000003';
  m_feel     uuid := '22222222-0000-0000-0000-000000000004';
  m_soreness uuid := '22222222-0000-0000-0000-000000000005';
  m_rpe      uuid := '22222222-0000-0000-0000-000000000006';
  m_savings  uuid := '22222222-0000-0000-0000-000000000007';
BEGIN
  SELECT id INTO uid FROM auth.users LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No user found in auth.users — sign up first.';
  END IF;

  -- ── Clear existing data ──────────────────────────────────────────────────
  DELETE FROM metric_logs  WHERE user_id = uid;
  DELETE FROM metrics      WHERE user_id = uid;
  DELETE FROM sessions     WHERE user_id = uid;
  DELETE FROM tasks        WHERE user_id = uid;
  DELETE FROM checkins     WHERE user_id = uid;
  DELETE FROM suggestions  WHERE user_id = uid;
  DELETE FROM categories   WHERE user_id = uid;

  -- ── Categories ───────────────────────────────────────────────────────────
  INSERT INTO categories (id, user_id, name, color, icon, "order", active) VALUES
    (cat_uni,    uid, 'Uni work',      'blue',   '📘', 0, true),
    (cat_job,    uid, 'Job searching', 'violet', '💼', 1, true),
    (cat_tennis, uid, 'Tennis',        'green',  '🎾', 2, true),
    (cat_gym,    uid, 'Gym',           'amber',  '🏋️', 3, true),
    (cat_fin,    uid, 'Finances',      'teal',   '💰', 4, true);

  -- ── Metrics ──────────────────────────────────────────────────────────────
  INSERT INTO metrics (id, user_id, category_id, name, type, unit) VALUES
    (m_study,    uid, cat_uni,    'Study minutes',     'numeric', 'min'),
    (m_apps,     uid, cat_job,    'Applications sent', 'numeric', null),
    (m_utr,      uid, cat_tennis, 'UTR',               'numeric', null),
    (m_feel,     uid, cat_tennis, 'Session feel',      'scale',   null),
    (m_soreness, uid, cat_gym,    'Soreness',          'scale',   null),
    (m_rpe,      uid, cat_gym,    'RPE',               'scale',   null),
    (m_savings,  uid, cat_fin,    'Savings',           'numeric', '$');

  -- ── Sessions ─────────────────────────────────────────────────────────────
  -- Uni work
  INSERT INTO sessions (user_id, category_id, date, type, duration_minutes, payload) VALUES
    (uid, cat_uni, current_date - 28, 'Study',       60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date - 27, 'Reading',     50, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date - 26, 'Problem set', 75, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date - 25, 'Study',       90, '{"feedback":{"energy_after":5}}'),
    (uid, cat_uni, current_date - 21, 'Reading',     45, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date - 20, 'Study',       80, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date - 19, 'Past paper',  60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date - 18, 'Problem set', 70, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date - 14, 'Study',       90, '{"feedback":{"energy_after":5}}'),
    (uid, cat_uni, current_date - 13, 'Reading',     55, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date - 12, 'Revision',    60, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date - 11, 'Study',       75, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date -  7, 'Past paper',  90, '{"feedback":{"energy_after":5}}'),
    (uid, cat_uni, current_date -  6, 'Study',       60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date -  5, 'Revision',    45, '{"feedback":{"energy_after":3}}'),
    (uid, cat_uni, current_date -  4, 'Reading',     50, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date -  3, 'Study',       80, '{"feedback":{"energy_after":5}}'),
    (uid, cat_uni, current_date -  1, 'Problem set', 70, '{"feedback":{"energy_after":4}}'),
    (uid, cat_uni, current_date,      'Study',       60, '{"feedback":{"energy_after":4}}');

  -- Tennis (skill type = session type, for skill confidence charts)
  INSERT INTO sessions (user_id, category_id, date, type, duration_minutes, payload) VALUES
    (uid, cat_tennis, current_date - 27, 'Serve',    75, '{"feedback":{"energy_after":4,"skill_confidence":3.5}}'),
    (uid, cat_tennis, current_date - 24, 'Forehand', 60, '{"feedback":{"energy_after":5,"skill_confidence":4.0}}'),
    (uid, cat_tennis, current_date - 20, 'Backhand', 75, '{"feedback":{"energy_after":3,"skill_confidence":3.0}}'),
    (uid, cat_tennis, current_date - 17, 'Serve',    60, '{"feedback":{"energy_after":4,"skill_confidence":3.8}}'),
    (uid, cat_tennis, current_date - 13, 'Volleys',  90, '{"feedback":{"energy_after":5,"skill_confidence":2.5}}'),
    (uid, cat_tennis, current_date - 10, 'Forehand', 75, '{"feedback":{"energy_after":4,"skill_confidence":4.2}}'),
    (uid, cat_tennis, current_date -  6, 'Backhand', 60, '{"feedback":{"energy_after":3,"skill_confidence":3.2}}'),
    (uid, cat_tennis, current_date -  3, 'Serve',    75, '{"feedback":{"energy_after":4,"skill_confidence":4.0}}');

  -- Gym
  INSERT INTO sessions (user_id, category_id, date, type, duration_minutes, payload) VALUES
    (uid, cat_gym, current_date - 28, 'Strength', 60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_gym, current_date - 26, 'Cardio',   50, '{"feedback":{"energy_after":3}}'),
    (uid, cat_gym, current_date - 24, 'Strength', 65, '{"feedback":{"energy_after":5}}'),
    (uid, cat_gym, current_date - 21, 'Strength', 60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_gym, current_date - 19, 'Cardio',   45, '{"feedback":{"energy_after":3}}'),
    (uid, cat_gym, current_date - 17, 'Strength', 70, '{"feedback":{"energy_after":4}}'),
    (uid, cat_gym, current_date - 14, 'Strength', 60, '{"feedback":{"energy_after":5}}'),
    (uid, cat_gym, current_date - 12, 'Cardio',   50, '{"feedback":{"energy_after":3}}'),
    (uid, cat_gym, current_date - 10, 'Strength', 65, '{"feedback":{"energy_after":4}}'),
    (uid, cat_gym, current_date -  7, 'Strength', 60, '{"feedback":{"energy_after":4}}'),
    (uid, cat_gym, current_date -  5, 'Cardio',   45, '{"feedback":{"energy_after":3}}'),
    (uid, cat_gym, current_date -  3, 'Strength', 70, '{"feedback":{"energy_after":5}}'),
    (uid, cat_gym, current_date -  1, 'Strength', 60, '{"feedback":{"energy_after":4}}');

  -- Job searching
  INSERT INTO sessions (user_id, category_id, date, type, duration_minutes, payload) VALUES
    (uid, cat_job, current_date - 25, 'Applications', 45, '{"feedback":{"energy_after":3}}'),
    (uid, cat_job, current_date - 18, 'Applications', 60, '{"feedback":{"energy_after":3}}'),
    (uid, cat_job, current_date - 11, 'Applications', 40, '{"feedback":{"energy_after":2}}'),
    (uid, cat_job, current_date -  4, 'Applications', 50, '{"feedback":{"energy_after":3}}');

  -- Finances
  INSERT INTO sessions (user_id, category_id, date, type, duration_minutes, payload) VALUES
    (uid, cat_fin, current_date - 14, 'Review', 30, '{"feedback":{"energy_after":3}}'),
    (uid, cat_fin, current_date -  1, 'Review', 30, '{"feedback":{"energy_after":4}}');

  -- ── Tasks ─────────────────────────────────────────────────────────────────
  INSERT INTO tasks (user_id, category_id, title, status, source, due_date, completed_at, created_at) VALUES
    (uid, cat_uni,    'SIT221 Assignment 2 — graphs & traversal', 'complete',    'manual', current_date - 3, now() - interval '4 days',  now() - interval '14 days'),
    (uid, cat_uni,    'Read Chapter 8 — dynamic programming',     'complete',    'manual', null,             now() - interval '6 days',  now() - interval '10 days'),
    (uid, cat_uni,    'Mid-semester exam revision',               'working',     'manual', current_date + 5, null,                       now() - interval '5 days'),
    (uid, cat_uni,    'Past paper — SIT221 2024',                 'not_started', 'manual', current_date + 4, null,                       now() - interval '3 days'),
    (uid, cat_job,    'Apply to Seek listings — Junior Dev',      'complete',    'manual', null,             now() - interval '7 days',  now() - interval '10 days'),
    (uid, cat_job,    'Update portfolio with Compass project',    'working',     'manual', null,             null,                       now() - interval '5 days'),
    (uid, cat_tennis, 'Book court at Shepparton Tennis',          'complete',    'manual', null,             now() - interval '8 days',  now() - interval '9 days'),
    (uid, cat_gym,    'Plan next 4-week training block',          'not_started', 'manual', null,             null,                       now() - interval '2 days'),
    (uid, cat_fin,    'Review monthly budget',                    'complete',    'manual', null,             now() - interval '1 day',   now() - interval '3 days');

  -- ── Check-ins ─────────────────────────────────────────────────────────────
  INSERT INTO checkins (user_id, date, mental, uni_readiness, capacity, extra) VALUES
    (uid, current_date - 28, 3, 3, 'medium', '{}'),
    (uid, current_date - 27, 4, 4, 'big',    '{}'),
    (uid, current_date - 26, 4, 3, 'medium', '{}'),
    (uid, current_date - 25, 3, 3, 'medium', '{}'),
    (uid, current_date - 24, 4, 4, 'big',    '{}'),
    (uid, current_date - 23, 3, 2, 'light',  '{}'),
    (uid, current_date - 22, 2, 2, 'light',  '{}'),
    (uid, current_date - 21, 3, 3, 'medium', '{}'),
    (uid, current_date - 20, 4, 4, 'big',    '{}'),
    (uid, current_date - 19, 4, 3, 'medium', '{}'),
    (uid, current_date - 18, 3, 3, 'medium', '{}'),
    (uid, current_date - 17, 4, 4, 'big',    '{}'),
    (uid, current_date - 16, 3, 3, 'medium', '{}'),
    (uid, current_date - 15, 2, 2, 'light',  '{}'),
    (uid, current_date - 14, 3, 3, 'medium', '{}'),
    (uid, current_date - 13, 4, 4, 'big',    '{}'),
    (uid, current_date - 12, 4, 3, 'medium', '{}'),
    (uid, current_date - 11, 3, 3, 'medium', '{}'),
    (uid, current_date - 10, 4, 4, 'big',    '{}'),
    (uid, current_date -  9, 3, 3, 'medium', '{}'),
    (uid, current_date -  8, 2, 2, 'light',  '{}'),
    (uid, current_date -  7, 3, 3, 'medium', '{}'),
    (uid, current_date -  6, 4, 4, 'big',    '{}'),
    (uid, current_date -  5, 4, 3, 'medium', '{}'),
    (uid, current_date -  4, 3, 3, 'medium', '{}'),
    (uid, current_date -  3, 4, 4, 'big',    '{}'),
    (uid, current_date -  2, 3, 3, 'medium', '{}'),
    (uid, current_date -  1, 4, 4, 'big',    '{}'),
    (uid, current_date,      3, 3, 'medium', '{}');

  -- ── Metric logs ───────────────────────────────────────────────────────────
  -- UTR rising over time
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_utr, current_date - 28, '3.8'),
    (uid, m_utr, current_date - 21, '3.9'),
    (uid, m_utr, current_date - 14, '4.0'),
    (uid, m_utr, current_date -  7, '4.1'),
    (uid, m_utr, current_date,      '4.1');

  -- Tennis session feel
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_feel, current_date - 27, '4'),
    (uid, m_feel, current_date - 24, '5'),
    (uid, m_feel, current_date - 20, '3'),
    (uid, m_feel, current_date - 17, '4'),
    (uid, m_feel, current_date - 13, '5'),
    (uid, m_feel, current_date - 10, '4'),
    (uid, m_feel, current_date -  6, '3'),
    (uid, m_feel, current_date -  3, '4');

  -- Gym RPE
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_rpe, current_date - 28, '7'),
    (uid, m_rpe, current_date - 26, '6'),
    (uid, m_rpe, current_date - 24, '8'),
    (uid, m_rpe, current_date - 21, '7'),
    (uid, m_rpe, current_date - 19, '6'),
    (uid, m_rpe, current_date - 17, '8'),
    (uid, m_rpe, current_date - 14, '7'),
    (uid, m_rpe, current_date - 12, '6'),
    (uid, m_rpe, current_date - 10, '8'),
    (uid, m_rpe, current_date -  7, '7'),
    (uid, m_rpe, current_date -  5, '6'),
    (uid, m_rpe, current_date -  3, '9'),
    (uid, m_rpe, current_date -  1, '7');

  -- Gym soreness
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_soreness, current_date - 27, '3'),
    (uid, m_soreness, current_date - 25, '2'),
    (uid, m_soreness, current_date - 23, '3'),
    (uid, m_soreness, current_date - 20, '3'),
    (uid, m_soreness, current_date - 18, '2'),
    (uid, m_soreness, current_date - 16, '4'),
    (uid, m_soreness, current_date - 13, '3'),
    (uid, m_soreness, current_date - 11, '2'),
    (uid, m_soreness, current_date -  9, '3'),
    (uid, m_soreness, current_date -  6, '3'),
    (uid, m_soreness, current_date -  4, '2'),
    (uid, m_soreness, current_date -  2, '4'),
    (uid, m_soreness, current_date,      '2');

  -- Applications sent
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_apps, current_date - 25, '3'),
    (uid, m_apps, current_date - 18, '2'),
    (uid, m_apps, current_date - 11, '1'),
    (uid, m_apps, current_date -  4, '4');

  -- Study minutes
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_study, current_date - 28, '60'),
    (uid, m_study, current_date - 27, '50'),
    (uid, m_study, current_date - 26, '75'),
    (uid, m_study, current_date - 25, '90'),
    (uid, m_study, current_date - 21, '45'),
    (uid, m_study, current_date - 20, '80'),
    (uid, m_study, current_date - 19, '60'),
    (uid, m_study, current_date - 18, '70'),
    (uid, m_study, current_date - 14, '90'),
    (uid, m_study, current_date - 13, '55'),
    (uid, m_study, current_date - 12, '60'),
    (uid, m_study, current_date - 11, '75'),
    (uid, m_study, current_date -  7, '90'),
    (uid, m_study, current_date -  6, '60'),
    (uid, m_study, current_date -  5, '45'),
    (uid, m_study, current_date -  4, '50'),
    (uid, m_study, current_date -  3, '80'),
    (uid, m_study, current_date -  1, '70'),
    (uid, m_study, current_date,      '60');

  -- Savings snapshots
  INSERT INTO metric_logs (user_id, metric_id, date, value) VALUES
    (uid, m_savings, current_date - 28, '2100'),
    (uid, m_savings, current_date - 14, '2350'),
    (uid, m_savings, current_date,      '2620');

END $$;
