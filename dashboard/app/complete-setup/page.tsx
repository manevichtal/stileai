import { redirect } from "next/navigation";
import { getProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompleteSetup } from "./CompleteSetup";

export const dynamic = "force-dynamic";

export default async function CompleteSetupPage() {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");
  if (ctx.subscriptionActive) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", ctx.orgId)
    .maybeSingle();

  return (
    <CompleteSetup
      email={ctx.email}
      orgName={ctx.orgName}
      hasBilling={!!org?.stripe_customer_id}
    />
  );
}
