import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell, PageHeader } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Platform-owner overview: every tenant with headline stats. Read-only, reached
// only by a platform admin (see requirePlatformAdmin). Uses the service role and
// aggregates across all orgs — the one place that intentionally crosses tenants.
export default async function AdminOverviewPage() {
  const ctx = await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, created_at, policy_version")
    .order("created_at", { ascending: false });

  const orgList = orgs ?? [];

  // Small tables: fetch org_ids and tally in memory.
  const [{ data: profiles }, { data: policies }, { data: keys }, { data: approvals }] =
    await Promise.all([
      admin.from("profiles").select("org_id"),
      admin.from("policies").select("org_id, enabled"),
      admin.from("api_keys").select("org_id"),
      admin.from("approvals").select("org_id, status"),
    ]);

  const tally = (rows: { org_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.org_id, (m.get(r.org_id) ?? 0) + 1);
    return m;
  };
  const admins = tally(profiles);
  const policyCount = tally(policies);
  const keyCount = tally(keys);
  const pending = tally((approvals ?? []).filter((a) => a.status === "pending"));

  // Audit counts per org (head-only counts, cheap even on large tables).
  const auditCounts = new Map<string, number>();
  await Promise.all(
    orgList.map(async (o) => {
      const { count } = await admin
        .from("audit_log")
        .select("*", { count: "exact", head: true })
        .eq("org_id", o.id);
      auditCounts.set(o.id, count ?? 0);
    }),
  );

  const totalDecisions = [...auditCounts.values()].reduce((a, b) => a + b, 0);
  const totalPending = [...pending.values()].reduce((a, b) => a + b, 0);

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin>
      <PageHeader
        title="All tenants"
        subtitle="Platform-owner view across every organization. Read-only."
      />
      <div className="p-7 flex flex-col gap-6 max-w-[1000px]">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Organizations" value={orgList.length} />
          <Kpi label="Policies" value={[...policyCount.values()].reduce((a, b) => a + b, 0)} />
          <Kpi label="Decisions logged" value={totalDecisions} />
          <Kpi label="Pending approvals" value={totalPending} />
        </div>

        <div className="border border-line rounded-[14px] overflow-hidden bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg2 border-b border-line">
                {["Organization", "Created", "Admins", "Policies", "Keys", "Pending", "Decisions", ""].map((h) => (
                  <th key={h} className="text-left font-mono text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgList.length === 0 && (
                <tr><td colSpan={8} className="font-mono text-[12.5px] text-ink3 text-center py-10">No organizations yet.</td></tr>
              )}
              {orgList.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-3.5 py-3 font-mono text-[12.5px] text-ink font-medium">{o.name}</td>
                  <td className="px-3.5 py-3 font-mono text-[11px] text-ink3">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-3.5 py-3 font-mono text-[12px] text-ink2">{admins.get(o.id) ?? 0}</td>
                  <td className="px-3.5 py-3 font-mono text-[12px] text-ink2">{policyCount.get(o.id) ?? 0}</td>
                  <td className="px-3.5 py-3 font-mono text-[12px] text-ink2">{keyCount.get(o.id) ?? 0}</td>
                  <td className="px-3.5 py-3 font-mono text-[12px] text-ink2">{pending.get(o.id) ?? 0}</td>
                  <td className="px-3.5 py-3 font-mono text-[12px] text-ink2">{auditCounts.get(o.id) ?? 0}</td>
                  <td className="px-3.5 py-3 text-right">
                    <Link href={`/admin/${o.id}`} className="font-mono text-[11.5px] text-blue hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[10.5px] text-ink4">
          This view is limited to the {platformNote()}. Tenant admins never see other tenants — only you, the platform owner, see this page.
        </p>
      </div>
    </AppShell>
  );
}

function platformNote() {
  return "platform-owner email(s) configured in PLATFORM_ADMIN_EMAILS";
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg2 border border-line rounded-[14px] px-4 py-3">
      <div className="font-mono text-[10.5px] text-ink4 uppercase tracking-wide">{label}</div>
      <div className="font-sans font-bold text-[22px] text-ink mt-1">{value}</div>
    </div>
  );
}
