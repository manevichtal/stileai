import { redirect } from "next/navigation";
import { getProfileContext } from "@/lib/getProfile";
import { CompleteSetup } from "./CompleteSetup";

export const dynamic = "force-dynamic";

export default async function CompleteSetupPage() {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");
  if (ctx.subscriptionActive) redirect("/dashboard");
  return <CompleteSetup email={ctx.email} orgName={ctx.orgName} />;
}
