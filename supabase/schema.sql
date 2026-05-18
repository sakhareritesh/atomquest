-- GoalTracker Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');
CREATE TYPE goal_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'locked');
CREATE TYPE uom_type AS ENUM ('min_numeric', 'max_numeric', 'timeline', 'zero');
CREATE TYPE progress_status AS ENUM ('not_started', 'on_track', 'completed');
CREATE TYPE quarter_type AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');
CREATE TYPE cycle_status AS ENUM ('active', 'closed');
CREATE TYPE window_status AS ENUM ('open', 'closed');
CREATE TYPE escalation_status AS ENUM ('pending', 'resolved', 'escalated');

-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  manager_id UUID REFERENCES users(id),
  department TEXT NOT NULL DEFAULT 'Unassigned',
  designation TEXT NOT NULL DEFAULT 'Employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_manager_id ON users(manager_id);

-- CYCLES TABLE
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  goal_setting_start DATE NOT NULL,
  goal_setting_end DATE NOT NULL,
  status cycle_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUARTERLY WINDOWS
CREATE TABLE quarterly_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  quarter quarter_type NOT NULL,
  window_open DATE NOT NULL,
  window_close DATE NOT NULL,
  status window_status NOT NULL DEFAULT 'closed',
  UNIQUE(cycle_id, quarter)
);

-- THRUST AREAS
CREATE TABLE thrust_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'All',
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- GOAL SHEETS
CREATE TABLE goal_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES users(id),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  status goal_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, cycle_id)
);

CREATE INDEX idx_goal_sheets_employee ON goal_sheets(employee_id);
CREATE INDEX idx_goal_sheets_cycle ON goal_sheets(cycle_id);
CREATE INDEX idx_goal_sheets_status ON goal_sheets(status);

-- GOALS
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES users(id),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  goal_sheet_id UUID NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
  thrust_area_id UUID NOT NULL REFERENCES thrust_areas(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  uom_type uom_type NOT NULL,
  target_value NUMERIC,
  target_date DATE,
  weightage INTEGER NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
  status goal_status NOT NULL DEFAULT 'draft',
  shared_goal_id UUID REFERENCES goals(id),
  is_primary_owner BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_employee ON goals(employee_id);
CREATE INDEX idx_goals_cycle ON goals(cycle_id);
CREATE INDEX idx_goals_sheet ON goals(goal_sheet_id);
CREATE INDEX idx_goals_shared ON goals(shared_goal_id);

-- ACHIEVEMENTS
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  quarter quarter_type NOT NULL,
  planned_target NUMERIC,
  actual_achievement NUMERIC,
  progress_status progress_status NOT NULL DEFAULT 'not_started',
  computed_score NUMERIC,
  completion_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(goal_id, quarter)
);

CREATE INDEX idx_achievements_goal ON achievements(goal_id);

-- CHECKINS
CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_sheet_id UUID NOT NULL REFERENCES goal_sheets(id),
  quarter quarter_type NOT NULL,
  manager_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(goal_sheet_id, quarter)
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- ESCALATION VIOLATIONS (auto-detected by scan engine)
CREATE TABLE escalation_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_type TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES users(id),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  details JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_escalated BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(rule_type, target_user_id, cycle_id)
);

CREATE INDEX idx_violations_user ON escalation_violations(target_user_id);
CREATE INDEX idx_violations_cycle ON escalation_violations(cycle_id);

-- ESCALATIONS (enhanced with message, deadline, created_by, violation link)
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_type TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES users(id),
  escalation_level INTEGER NOT NULL DEFAULT 1,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  status escalation_status NOT NULL DEFAULT 'pending',
  message TEXT,
  deadline TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  violation_id UUID REFERENCES escalation_violations(id)
);

CREATE INDEX idx_escalations_user ON escalations(target_user_id);
CREATE INDEX idx_escalations_status ON escalations(status);

-- NOTIFICATIONS (in-app delivery for all roles)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'escalation_reminder',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  escalation_id UUID REFERENCES escalations(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- AUTO-UPDATE updated_at TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AUDIT LOG TRIGGER: logs ALL changes to goals after they are locked/approved
-- Captures who changed what and when. user_id is set via current_setting
-- from the API layer; falls back to employee_id if not set.
CREATE OR REPLACE FUNCTION log_goal_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
BEGIN
  -- Try to get the actual actor from the session variable set by the API
  BEGIN
    actor_id := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    actor_id := NULL;
  END;
  -- Fallback to goal owner if actor not set
  IF actor_id IS NULL THEN
    actor_id := NEW.employee_id;
  END IF;

  IF OLD.status = 'locked' OR OLD.status = 'approved' THEN
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'title', OLD.title, NEW.title);
    END IF;
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'description', LEFT(OLD.description, 200), LEFT(NEW.description, 200));
    END IF;
    IF OLD.target_value IS DISTINCT FROM NEW.target_value THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'target_value', OLD.target_value::TEXT, NEW.target_value::TEXT);
    END IF;
    IF OLD.target_date IS DISTINCT FROM NEW.target_date THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'target_date', OLD.target_date::TEXT, NEW.target_date::TEXT);
    END IF;
    IF OLD.weightage IS DISTINCT FROM NEW.weightage THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'weightage', OLD.weightage::TEXT, NEW.weightage::TEXT);
    END IF;
    IF OLD.uom_type::TEXT IS DISTINCT FROM NEW.uom_type::TEXT THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'uom_type', OLD.uom_type::TEXT, NEW.uom_type::TEXT);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO audit_logs (entity_type, entity_id, user_id, action, field_changed, old_value, new_value)
      VALUES ('goal', OLD.id, actor_id, 'update', 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_audit_trigger
  AFTER UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION log_goal_changes();

-- SHARED GOAL SYNC TRIGGER: syncs achievement from primary owner to all linked goals
-- Uses INSERT ON CONFLICT to create achievement rows if they don't exist yet
CREATE OR REPLACE FUNCTION sync_shared_achievement()
RETURNS TRIGGER AS $$
DECLARE
  parent_goal goals%ROWTYPE;
  linked_goal RECORD;
BEGIN
  SELECT * INTO parent_goal FROM goals WHERE id = NEW.goal_id;

  IF parent_goal.is_primary_owner AND parent_goal.id IS NOT NULL THEN
    FOR linked_goal IN
      SELECT g.id, g.employee_id FROM goals g WHERE g.shared_goal_id = parent_goal.id
    LOOP
      INSERT INTO achievements (goal_id, quarter, planned_target, actual_achievement,
        progress_status, computed_score, completion_date, updated_by)
      VALUES (linked_goal.id, NEW.quarter, NEW.planned_target, NEW.actual_achievement,
        NEW.progress_status, NEW.computed_score, NEW.completion_date, NEW.updated_by)
      ON CONFLICT (goal_id, quarter)
      DO UPDATE SET
        actual_achievement = EXCLUDED.actual_achievement,
        progress_status = EXCLUDED.progress_status,
        computed_score = EXCLUDED.computed_score,
        completion_date = EXCLUDED.completion_date,
        updated_at = NOW();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_shared_achievements_trigger
  AFTER INSERT OR UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION sync_shared_achievement();

-- ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE thrust_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- For service_role key usage (bypasses RLS), allow all for service role
-- The app uses service role key server-side so RLS policies are permissive
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON cycles FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON quarterly_windows FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON thrust_areas FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON goal_sheets FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON goals FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON achievements FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON checkins FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON escalations FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON escalation_violations FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON notifications FOR ALL USING (true);

-- APP SETTINGS (key-value store for integration config)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON app_settings FOR ALL USING (true);

INSERT INTO app_settings (key, value) VALUES
  ('email_notifications_enabled', 'true'),
  ('teams_notifications_enabled', 'true'),
  ('teams_webhook_url', ''),
  ('email_from_name', 'GoalTracker'),
  ('app_base_url', 'http://localhost:3000')
ON CONFLICT (key) DO NOTHING;

-- SEED DATA FOR DEMO
-- Cycle
INSERT INTO cycles (id, name, year, goal_setting_start, goal_setting_end, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'FY 2026-27', 2026, '2026-05-01', '2026-05-31', 'active');

-- Quarterly Windows
INSERT INTO quarterly_windows (cycle_id, quarter, window_open, window_close, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Q1', '2026-07-01', '2026-07-31', 'closed'),
('00000000-0000-0000-0000-000000000001', 'Q2', '2026-10-01', '2026-10-31', 'closed'),
('00000000-0000-0000-0000-000000000001', 'Q3', '2027-01-01', '2027-01-31', 'closed'),
('00000000-0000-0000-0000-000000000001', 'Q4', '2027-03-01', '2027-04-30', 'closed');

-- Thrust Areas
INSERT INTO thrust_areas (name, description, department) VALUES
('Revenue Growth', 'Goals related to increasing revenue and sales', 'All'),
('Operational Excellence', 'Goals related to improving operational efficiency', 'All'),
('Customer Satisfaction', 'Goals related to improving customer experience', 'All'),
('Innovation & Technology', 'Goals related to tech improvements and innovation', 'Engineering'),
('People & Culture', 'Goals related to team development and culture', 'HR'),
('Cost Optimization', 'Goals related to reducing costs and improving margins', 'Finance');
