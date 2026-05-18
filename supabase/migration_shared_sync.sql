-- Fix: achievement sync trigger now uses INSERT ON CONFLICT instead of UPDATE-only
-- This ensures linked goals get achievement rows even if the recipient hasn't entered one yet
-- Also syncs the new completion_date column

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
