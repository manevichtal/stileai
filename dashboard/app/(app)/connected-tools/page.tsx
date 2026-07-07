import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/AppShell";
import { ConnectedToolsClient, type ToolRow } from "./ConnectedToolsClient";

export const dynamic = "force-dynamic";

export default async function ConnectedToolsPage() {
  const ctx = await requireProfileContext();
  const supabase = createAdminClient();

  const { data: tools } = await supabase
    .from("connected_tools")
    .select("id, name, transport, target, enabled, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Connected tools"
        subtitle="The downstream tools your checkpoint guards."
      />
      <ConnectedToolsClient tools={(tools ?? []) as ToolRow[]} isAdmin={ctx.role === "admin"} />
    </>
  );
}
