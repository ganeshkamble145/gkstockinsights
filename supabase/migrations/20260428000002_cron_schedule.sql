-- pg_cron schedule for outcome-tracker edge function
-- Runs every weekday at 4:00 PM IST (10:30 UTC)
-- Run this in the Supabase SQL Editor after enabling the pg_cron extension.

-- Enable extensions (if not already done)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule outcome tracker to run at 4 PM IST (10:30 UTC) on weekdays
SELECT cron.schedule(
  'track-outcomes',          -- job name
  '30 10 * * 1-5',           -- cron: 10:30 UTC = 4:00 PM IST, Mon-Fri
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/outcome-tracker',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- To verify the schedule was created:
-- SELECT * FROM cron.job;

-- To manually trigger the tracker for testing:
-- SELECT net.http_post(
--   url     := '<YOUR_SUPABASE_URL>/functions/v1/outcome-tracker',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--   body    := '{}'::jsonb
-- );
