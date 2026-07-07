-- StileAI migration: speeds up per-actor / recent-window counting for velocity
-- policies (GET /api/usage). audit_log's timestamp column is `ts` (see schema.sql).
-- Apply via the Supabase SQL editor.

create index if not exists audit_log_org_actor_ts on audit_log (org_id, actor, ts desc);
