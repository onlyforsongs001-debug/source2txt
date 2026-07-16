-- Add subscription and daily-limit columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_stripe_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS zip_daily_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zip_daily_date date NOT NULL DEFAULT CURRENT_DATE;

-- Add 'folder' to processing_jobs file_type check
ALTER TABLE processing_jobs
  DROP CONSTRAINT IF EXISTS processing_jobs_file_type_check;

ALTER TABLE processing_jobs
  ADD CONSTRAINT processing_jobs_file_type_check
  CHECK (file_type IN ('video', 'audio', 'zip', 'image', 'folder'));
