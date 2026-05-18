-- Phase 1 Migration: Run this in Supabase SQL Editor AFTER the initial schema.sql

-- 1. Add missing columns to goal_sheets
ALTER TABLE goal_sheets ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE goal_sheets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Replace the achievement sync trigger to handle INSERT (not just UPDATE)
CREATE OR REPLACE FUNCTION sync_shared_achievement()
RETURNS TRIGGER AS $$
DECLARE
  parent_goal goals%ROWTYPE;
  linked_goal RECORD;
BEGIN
  SELECT * INTO parent_goal FROM goals WHERE id = NEW.goal_id;
  
  -- Only sync from primary owner to linked copies
  IF parent_goal.is_primary_owner AND parent_goal.id IS NOT NULL THEN
    FOR linked_goal IN
      SELECT g.id AS goal_id
      FROM goals g
      WHERE g.shared_goal_id = parent_goal.id
    LOOP
      INSERT INTO achievements (goal_id, quarter, planned_target, actual_achievement, progress_status, computed_score, updated_by)
      VALUES (
        linked_goal.goal_id,
        NEW.quarter,
        NEW.planned_target,
        NEW.actual_achievement,
        NEW.progress_status,
        NEW.computed_score,
        NEW.updated_by
      )
      ON CONFLICT (goal_id, quarter) DO UPDATE SET
        actual_achievement = EXCLUDED.actual_achievement,
        progress_status = EXCLUDED.progress_status,
        computed_score = EXCLUDED.computed_score,
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself already exists from schema.sql, but recreate to be safe
DROP TRIGGER IF EXISTS sync_shared_achievements_trigger ON achievements;
CREATE TRIGGER sync_shared_achievements_trigger
  AFTER INSERT OR UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION sync_shared_achievement();
