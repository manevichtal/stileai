// Decision feedback: recording that a decision looked wrong. Purely additive to
// the product — it never participates in a live allow/deny decision. The write
// path resolves the caller's org from their SESSION (never trusts a client-sent
// org id) and snapshots the already-redacted audit values, so no raw sensitive
// content is stored here.
import type { SupabaseClient } from "@supabase/supabase-js";

export const FEEDBACK_KINDS = ["false_positive", "false_negative", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export function isFeedbackKind(x: unknown): x is FeedbackKind {
  return typeof x === "string" && (FEEDBACK_KINDS as readonly string[]).includes(x);
}

export const MAX_NOTE = 1000;

// Trim and cap the free-text note; never store an unbounded blob.
export function normalizeNote(note: unknown): string {
  if (typeof note !== "string") return "";
  const t = note.trim();
  return t.length > MAX_NOTE ? t.slice(0, MAX_NOTE) : t;
}

export type RecordFeedbackInput = {
  decisionId: string;
  kind: FeedbackKind;
  note?: string;
  reportedBy?: string | null;
};

export type RecordFeedbackResult =
  | { ok: true; id: string }
  | { ok: false; error: "invalid" | "not_found" | "not_enabled" | "error" };

// Record feedback for a decision. Confirms the decision belongs to THIS org
// (so one tenant can't attach feedback to another's decision), snapshots the
// already-redacted audit values for reviewer context, and inserts. Never throws;
// returns a typed result the caller maps to an HTTP status.
export async function recordFeedback(
  admin: SupabaseClient,
  orgId: string,
  input: RecordFeedbackInput,
): Promise<RecordFeedbackResult> {
  if (!orgId || !input?.decisionId || !isFeedbackKind(input.kind)) {
    return { ok: false, error: "invalid" };
  }

  try {
    // Snapshot from the org's own audit row (also proves the decision is theirs).
    const { data: row, error: lookupErr } = await admin
      .from("audit_log")
      .select("effect, reason, params")
      .eq("org_id", orgId)
      .eq("decision_id", input.decisionId)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr) return { ok: false, error: mapPgError(lookupErr) };
    if (!row) return { ok: false, error: "not_found" };

    const preview =
      row.params && typeof row.params === "object"
        ? ((row.params as { preview?: unknown }).preview ?? null)
        : null;

    const { data: inserted, error: insertErr } = await admin
      .from("decision_feedback")
      .insert({
        org_id: orgId,
        decision_id: input.decisionId,
        kind: input.kind,
        note: normalizeNote(input.note) || null,
        reported_by: input.reportedBy ?? null,
        effect: row.effect ?? null,
        reason: row.reason ?? null,
        preview: typeof preview === "string" ? preview : null,
      })
      .select("id")
      .single();

    if (insertErr) return { ok: false, error: mapPgError(insertErr) };
    return { ok: true, id: inserted.id as string };
  } catch {
    return { ok: false, error: "error" };
  }
}

// A missing table (migration not yet applied in this environment) must degrade
// gracefully, not 500. 42P01 = undefined_table in Postgres.
function mapPgError(err: { code?: string }): "not_enabled" | "error" {
  return err?.code === "42P01" ? "not_enabled" : "error";
}
