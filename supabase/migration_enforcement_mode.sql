-- Enforcement mode: lets a company run StileAI in "monitor" (observe-only) for a
-- window, then switch to "enforce". In monitor mode every prompt is still checked
-- and logged with what WOULD have happened, but nothing is blocked or held — the
-- request passes through. This is the safe onboarding period: see your environment
-- before you turn on enforcement.
--
-- Default is 'enforce', so this migration changes nothing for anyone until a
-- company explicitly chooses monitor. Safe to run more than once.
--
-- IMPORTANT: monitor mode does NOT protect data — by design it does not block.
-- The UI must label it clearly and it is meant to be time-boxed (monitor_until).

alter table org_policy_settings
  add column if not exists enforcement_mode text not null default 'enforce';

alter table org_policy_settings
  add column if not exists monitor_until timestamptz;
