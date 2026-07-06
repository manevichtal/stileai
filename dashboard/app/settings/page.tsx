import { headers } from "next/headers";
import { requireProfileContext } from "@/lib/getProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireProfileContext();

  // Best-effort public origin for the connection snippet (works locally and on Vercel).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <PageHeader title="Settings" subtitle="Your organization and how to connect a checkpoint." />
      <SettingsClient orgName={ctx.orgName} origin={origin} />
    </AppShell>
  );
}
