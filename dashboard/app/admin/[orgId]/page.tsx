import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell, PageHeader } from "@/components/AppShell";
import { EffectBadge, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// Platform-owner read-only drill-down into one tenant.
export default async function AdminOrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const ctx = await requirePlatformAdmin();
  const { orgId } = await params;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, created_at, policy_version")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  const [{ data: profiles }, { data: policies }, { data: keys }, { data: audit }, { data: approvals }, { data: settings }] =
    await Promise.all([
      admin.from("profiles").select("email, role, created_at").eq("org_id", orgId),
      admin.from("policies").select("policy_id, effect, priority, actor, action, resource, enabled").eq("org_id", orgId).order("priority"),
      admin.from("api_keys").select("label, key_prefix, created_at, last_used_at").eq("org_id", orgId).order("created_at", { ascending: false }),
      admin.from("audit_log").select("ts, actor, action, resource, effect, matched_policy, status").eq("org_id", orgId).order("ts", { ascending: false }).limit(25),
      admin.from("approvals").select("actor, action, resource, status, created_at").eq("org_id", orgId).eq("status", "pending").order("created_at", { ascending: false }),
      admin.from("org_policy_settings").select("default_effect").eq("org_id", orgId).maybeSingle(),
    ]);

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin>
      <PageHeader
        title={org.name}
        subtitle={`Tenant detail (read-only) · default effect: ${settings?.default_effect ?? "require_approval"}`}
        actions={
          <Link href="/admin" className="font-mono text-[11.5px] text-ink3 hover:text-ink self-center">← all tenants</Link>
        }
      />
      <div className="p-7 flex flex-col gap-7 max-w-[1000px]">
        <Section title={`Admins · ${profiles?.length ?? 0}`}>
          <SimpleTable
            head={["Email", "Role", "Joined"]}
            rows={(profiles ?? []).map((p) => [p.email ?? "—", p.role, new Date(p.created_at).toLocaleDateString()])}
            empty="No admins."
          />
        </Section>

        <Section title={`Policies · ${policies?.length ?? 0}`}>
          <div className="border border-line rounded-[14px] overflow-hidden bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg2 border-b border-line">
                  {["Pri", "Rule", "Effect", "Matches", ""].map((h) => (
                    <th key={h} className="text-left font-mono text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(policies ?? []).length === 0 && <tr><td colSpan={5} className="text-center font-mono text-[12px] text-ink3 py-8">No policies.</td></tr>}
                {(policies ?? []).map((p, i) => (
                  <tr key={i} className={`border-b border-line last:border-0 ${p.enabled ? "" : "opacity-45"}`}>
                    <td className="px-3.5 py-2.5 font-mono text-[12px] text-ink2">{p.priority}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[12px] text-ink">{p.policy_id}</td>
                    <td className="px-3.5 py-2.5"><EffectBadge effect={p.effect} /></td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-ink2">{p.actor} · {p.action} · {p.resource}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[10px] text-ink4">{p.enabled ? "" : "disabled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={`Pending approvals · ${approvals?.length ?? 0}`}>
          <SimpleTable
            head={["Actor", "Action", "Resource", "Since"]}
            rows={(approvals ?? []).map((a) => [a.actor ?? "—", a.action ?? "—", a.resource ?? "—", new Date(a.created_at).toLocaleString()])}
            empty="Nothing pending."
          />
        </Section>

        <Section title={`API keys · ${keys?.length ?? 0}`}>
          <SimpleTable
            head={["Label", "Prefix", "Created", "Last used"]}
            rows={(keys ?? []).map((k) => [k.label ?? "—", (k.key_prefix ?? "") + "…", new Date(k.created_at).toLocaleDateString(), k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"])}
            empty="No keys."
          />
        </Section>

        <Section title="Recent decisions · last 25">
          <div className="border border-line rounded-[14px] overflow-hidden bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg2 border-b border-line">
                  {["Time", "Actor", "Action", "Effect", "Status"].map((h) => (
                    <th key={h} className="text-left font-mono text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).length === 0 && <tr><td colSpan={5} className="text-center font-mono text-[12px] text-ink3 py-8">No decisions yet.</td></tr>}
                {(audit ?? []).map((a, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3.5 py-2.5 font-mono text-[10.5px] text-ink3 whitespace-nowrap">{new Date(a.ts).toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-ink2">{a.actor}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-ink">{a.action}</td>
                    <td className="px-3.5 py-2.5"><EffectBadge effect={a.effect} /></td>
                    <td className="px-3.5 py-2.5">{a.status ? <StatusBadge status={a.status} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-sans font-semibold text-[13px] text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <div className="border border-line rounded-[14px] overflow-hidden bg-card">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-bg2 border-b border-line">
            {head.map((h) => (
              <th key={h} className="text-left font-mono text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="text-center font-mono text-[12px] text-ink3 py-8">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-3.5 py-2.5 font-mono text-[11.5px] text-ink2">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
