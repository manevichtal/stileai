import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { AppShell, PageHeader } from "@/components/AppShell";
import { KeysClient, type KeyRow } from "./KeysClient";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const ctx = await requireProfileContext();
  const supabase = await createClient();

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, label, key_prefix, created_at, last_used_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <PageHeader
        title="API keys"
        subtitle="Keys your checkpoint uses to authenticate to this dashboard."
      />
      <KeysClient keys={(keys ?? []) as KeyRow[]} />
    </AppShell>
  );
}
