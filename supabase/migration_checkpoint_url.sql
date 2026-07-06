-- StileAI migration: per-tenant checkpoint URL.
-- Each organization stores the public URL of its own self-hosted checkpoint, so
-- the dashboard can show each tenant its own ready-to-paste connect URL. The
-- checkpoint self-registers this on startup (or an admin sets it in Settings).
-- Apply via the Supabase SQL editor.

alter table organizations add column if not exists checkpoint_url text;
