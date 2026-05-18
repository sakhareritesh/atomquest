-- Add completion_date column to achievements table for timeline goal scoring
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS completion_date DATE;
