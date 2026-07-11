import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEmployees, activeSeatCount } from "@/lib/employees";
import { PageHeader } from "@/components/AppShell";
import { TeamClient, type EmployeeRow } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireProfileContext();
  const admin = createAdminClient();

  const [employees, used, { data: org }] = await Promise.all([
    listEmployees(ctx.orgId),
    activeSeatCount(ctx.orgId),
    admin.from("organizations").select("plan_seats").eq("id", ctx.orgId).maybeSingle(),
  ]);

  const seats = org?.plan_seats ?? 0;
  const rows = employees as EmployeeRow[];
  const connected = rows.filter((e) => e.status === "active" && e.connected_at).length;

  return (
    <>
      <PageHeader
        title="Team & seats"
        subtitle="Invite each user by email — they connect their browser (and AI tools) to your company's policy. One seat per user."
      />
      <TeamClient
        employees={rows}
        used={used}
        seats={seats}
        connected={connected}
        isAdmin={ctx.role === "admin"}
      />
    </>
  );
}
