// Shape of an approval row as the MCP expects it (DASHBOARD_API.md §3).
export type ApprovalRow = {
  decision_id: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  params: unknown;
  reason: string | null;
  matched_policy: string | null;
  approvals_required: number;
  status: string;
  approvals: unknown[];
};

export function toPublicApproval(r: Record<string, unknown>): ApprovalRow {
  return {
    decision_id: String(r.decision_id ?? ""),
    actor: (r.actor as string) ?? null,
    action: (r.action as string) ?? null,
    resource: (r.resource as string) ?? null,
    params: r.params ?? {},
    reason: (r.reason as string) ?? null,
    matched_policy: (r.matched_policy as string) ?? null,
    approvals_required: Number(r.approvals_required ?? 1),
    status: (r.status as string) ?? "pending",
    approvals: (r.approvals as unknown[]) ?? [],
  };
}
