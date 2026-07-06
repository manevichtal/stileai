import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { ApprovalsClient, type Approval } from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await requireProfileContext();
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("approvals")
      .select("*")
      .eq("org_id", ctx.orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("*")
      .eq("org_id", ctx.orgId)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <PageHeader title="Approvals" subtitle="Decisions your policies routed to a human." />
      <ApprovalsClient
        pending={(pending ?? []) as Approval[]}
        recent={(recent ?? []) as Approval[]}
      />
    </>
  );
}
