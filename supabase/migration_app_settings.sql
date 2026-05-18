-- Migration: App Settings table for integration configuration
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON app_settings FOR ALL USING (true);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('email_notifications_enabled', 'true'),
  ('teams_notifications_enabled', 'true'),
  ('teams_webhook_url', ''),
  ('email_from_name', 'GoalTracker'),
  ('app_base_url', 'http://localhost:3000')
ON CONFLICT (key) DO NOTHING;
