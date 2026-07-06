import type { SupabaseClient } from "@supabase/supabase-js";
import { toPublicApproval, type ApprovalRow } from "@/lib/approvals";

type Vote = { approver: string; approved: boolean; note: string; ts: string };

// Records one approver's vote on a pending decision and recomputes status.
// Shared by the MCP-facing resolve route and the dashboard's Approve/Reject UI.
//  - any reject  -> denied immediately
//  - enough approvals (>= approvals_required) -> approved
//  - otherwise   -> still pending
// Also mirrors the final status onto the matching audit_log row so the audit
// trail stays accurate. Idempotent once resolved.
export async function resolveApproval(
  admin: SupabaseClient,
  orgId: string,
  decisionId: string,
  approver: string,
  approved: boolean,
  note = "",
): Promise<ApprovalRow | null> {
  const { data: row } = await admin
    .from("approvals")
    .select(
      "decision_id, actor, action, resource, params, reason, matched_policy, approvals_required, status, approvals",
    )
    .eq("org_id", orgId)
    .eq("decision_id", decisionId)
    .maybeSingle();

  if (!row) return null;
  if (row.status !== "pending") return toPublicApproval(row); // already resolved

  const votes: Vote[] = Array.isArray(row.approvals) ? (row.approvals as Vote[]) : [];
  votes.push({
    approver: approver || "unknown",
    approved,
    note: note || "",
    ts: new Date().toISOString(),
  });

  const required = Number(row.approvals_required ?? 1);
  const approvedCount = votes.filter((v) => v.approved).length;
  let status: string;
  if (!approved) status = "denied";
  else if (approvedCount >= required) status = "approved";
  else status = "pending";

  const { data: updated, error } = await admin
    .from("approvals")
    .update({ approvals: votes, status })
    .eq("org_id", orgId)
    .eq("decision_id", decisionId)
    .select(
      "decision_id, actor, action, resource, params, reason, matched_policy, approvals_required, status, approvals",
    )
    .single();

  if (error || !updated) return null;

  // Keep the audit row's status in sync. Awaited so it's durable even on a
  // serverless host that may freeze the function once the response is sent.
  if (status !== "pending") {
    await admin
      .from("audit_log")
      .update({ status })
      .eq("org_id", orgId)
      .eq("decision_id", decisionId);
  }

  return toPublicApproval(updated);
}
