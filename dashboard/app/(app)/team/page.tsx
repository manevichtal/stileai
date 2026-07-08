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

  return (
    <>
      <PageHeader
        title="Team & seats"
        subtitle="Each employee gets their own personal API key to connect their AI tools through StileAI."
      />
      <TeamClient
        employees={employees as EmployeeRow[]}
        used={used}
        seats={seats}
        isAdmin={ctx.role === "admin"}
      />
    </>
  );
}
