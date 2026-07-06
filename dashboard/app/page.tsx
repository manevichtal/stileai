import { redirect } from "next/navigation";
import { getProfileContext } from "@/lib/getProfile";
import { AppShell, PageHeader } from "@/components/AppShell";

export default async function OverviewPage() {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email}>
      <PageHeader
        title="Overview"
        subtitle={`Signed in to ${ctx.orgName || "your organization"}.`}
      />
      <div className="p-7">
        <div className="bg-card border border-line rounded-[14px] p-6 max-w-[640px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue" />
            <span className="font-mono text-[12px] text-ink3">
              Checkpoint online — dashboard is the source of truth
            </span>
          </div>
          <p className="font-mono text-[13px] text-ink2 leading-relaxed">
            You&apos;re logged in as an admin of{" "}
            <span className="text-ink font-semibold">
              {ctx.orgName || "your organization"}
            </span>
            . This is your governance console for agentic AI: define the policy
            rules your AI agents must clear, review every decision in the audit
            trail, and approve or reject anything that needs a human.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Organization" value={ctx.orgName || "—"} />
            <Stat label="Your role" value={ctx.role} />
          </div>
          <p className="font-mono text-[11px] text-ink4 mt-5 leading-relaxed">
            Next: define policies, generate an API key, and point your MCP
            checkpoint at this dashboard. The Policies, Audit, Approvals, and API
            keys screens come online as we build them out.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg2 border border-line rounded-lg px-4 py-3">
      <div className="font-mono text-[10.5px] text-ink4 uppercase tracking-wide">
        {label}
      </div>
      <div className="font-mono text-[13px] text-ink mt-1 truncate">{value}</div>
    </div>
  );
}
