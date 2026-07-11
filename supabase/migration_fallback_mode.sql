-- Resilience setting: what a tenant wants to happen to a gray-zone request when
-- the AI deep-inspection step cannot run (Anthropic unreachable, timed out, or the
-- org's monthly budget is spent). The local deterministic checks always run first
-- regardless; this only governs the small allowed-but-unverified slice.
--
--   'availability' : allow it (the local checks already cleared it). Default.
--   'hold'         : send it to an admin for approval instead of allowing it.
--   'flag'         : allow it, but mark the audit entry as not AI-verified so an
--                    admin can review it.
--
-- Safe to run more than once.

alter table org_policy_settings
  add column if not exists ai_fallback_mode text not null default 'availability';
