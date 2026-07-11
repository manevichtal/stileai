-- Extension connect-link + per-user tracking.
--
-- A "seat" (employees row) can now be provisioned two ways:
--   1) Invite a user by email  -> a one-time connect link; the user's browser
--      extension redeems it and the seat's key is minted AT redeem time.
--   2) Generate a raw key (existing flow) for API/gateway tools (Cursor, Claude Code).
--
-- Inviting consumes a seat immediately (billing is per user), whether or not the
-- user has connected yet. `connected_at` distinguishes invited-but-not-connected
-- from actually-active users so admins can see real usage per org.

-- Key is no longer required at row creation: for invited seats it's minted when the
-- user redeems their connect link, so it starts null.
alter table employees alter column key_hash drop not null;
alter table employees alter column key_prefix drop not null;

alter table employees
  add column if not exists email text,
  add column if not exists invite_token_hash text,
  add column if not exists invited_at timestamptz,
  add column if not exists connected_at timestamptz;

create index if not exists employees_invite_token_idx on employees(invite_token_hash);
