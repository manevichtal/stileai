import Link from "next/link";
import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const ctx = await requireProfileContext();
  const supabase = await createClient();

  const [{ count: policyCount }, { data: keys }, { count: auditCount }] = await Promise.all([
    supabase.from("policies").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    supabase.from("api_keys").select("id, last_used_at").eq("org_id", ctx.orgId),
    supabase.from("audit_log").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
  ]);

  const keysCount = keys?.length ?? 0;
  const anyKeyUsed = (keys ?? []).some((k) => k.last_used_at);
  const audits = auditCount ?? 0;

  const steps = [
    {
      done: (policyCount ?? 0) > 0,
      title: "Set your policies",
      body: "Define the rules your agents must clear — or enable a ready-made compliance pack in one click.",
      href: "/policies?tab=library",
      cta: "Browse the library",
    },
    {
      done: keysCount > 0,
      title: "Create an API key",
      body: "Generate a key so your checkpoint can authenticate to this dashboard.",
      href: "/keys",
      cta: "Create a key",
    },
    {
      done: anyKeyUsed || audits > 0,
      title: "Connect your checkpoint",
      body: "Run the checkpoint on your infrastructure and point it here. Route your agents through it.",
      href: "/",
      cta: "See the steps",
    },
    {
      done: audits > 0,
      title: "Watch your first decision",
      body: "Once an agent asks the checkpoint, every decision shows up in your audit trail.",
      href: "/audit",
      cta: "Open the audit log",
    },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader title="Getting started" subtitle="What StileAI does, and how to go live." />
      <div className="px-6 lg:px-8 pb-10 flex flex-col gap-6 max-w-[980px]">
        {/* What it is */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <h2 className="font-sans font-bold text-[17px] text-ink tracking-[-0.01em]">
            StileAI is the checkpoint between your AI agents and the systems they can touch.
          </h2>
          <p className="font-mono text-[12.5px] text-ink2 leading-relaxed mt-2 max-w-[720px]">
            Before an agent does something sensitive — move money, delete records, email a customer — it asks StileAI.
            StileAI checks your policies and answers <span className="text-blue font-medium">allow</span>,{" "}
            <span className="text-slate font-medium">deny</span>, or{" "}
            <span className="text-ink font-medium">needs a human</span>, and records every decision. You manage the
            rules and review activity right here.
          </p>

          {/* How it works — flow */}
          <div className="mt-5 bg-bg2 border border-line rounded-xl p-4 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-[560px]">
              <FlowNode icon="agent" title="Your AI agent" sub="about to act" />
              <Arrow label="asks" />
              <FlowNode icon="policies" title="StileAI checkpoint" sub="checks your policies" highlight />
              <Arrow label="allow / deny / approve" />
              <FlowNode icon="server" title="Your systems" sub="acts only if allowed" />
            </div>
            <p className="font-mono text-[10.5px] text-ink4 mt-3">
              This dashboard is the control plane — your policies feed the checkpoint, and its audit trail flows back here.
            </p>
          </div>
        </section>

        {/* The pieces */}
        <section>
          <h3 className="font-sans font-bold text-[14px] text-ink mb-3">The four pieces</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Piece icon="policies" title="Policies" body="The rules agents must clear. Write your own or enable a compliance pack." href="/policies" />
            <Piece icon="plug" title="Checkpoint" body="The small server your agents call before acting. You run it, pointed here." href="/" />
            <Piece icon="audit" title="Audit log" body="Every decision, recorded — with sensitive values redacted." href="/audit" />
            <Piece icon="approvals" title="Approvals" body="Decisions that need a human wait here for your yes or no." href="/approvals" />
          </div>
        </section>

        {/* Checklist */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-bold text-[15px] text-ink">Your setup checklist</h3>
            <span className="font-mono text-[11px] text-ink3">{completed} of {steps.length} done</span>
          </div>
          {/* progress bar */}
          <div className="h-1.5 rounded-full bg-bg3 overflow-hidden mb-5">
            <div className="h-full bg-blue rounded-full transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>

          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3.5 py-3.5 border-b border-line last:border-0">
                <span className={`flex-none w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${s.done ? "bg-blue text-white" : "bg-bg2 border border-line2 text-ink3"}`}>
                  {s.done ? <Icon name="check" size={14} /> : <span className="font-sans font-bold text-[11px]">{i + 1}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-sans font-semibold text-[13.5px] ${s.done ? "text-ink3 line-through decoration-ink4" : "text-ink"}`}>{s.title}</div>
                  <p className="font-mono text-[11.5px] text-ink2 leading-relaxed mt-0.5">{s.body}</p>
                </div>
                <Link
                  href={s.href}
                  className={`flex-none font-sans font-semibold text-[12px] rounded-xl px-3.5 py-2 transition-colors ${
                    s.done ? "border border-line text-ink2 hover:bg-bg2" : "bg-blue text-white hover:opacity-90"
                  }`}
                >
                  {s.done ? "Review" : s.cta}
                </Link>
              </li>
            ))}
          </ol>

          {completed === steps.length && (
            <div className="mt-4 flex items-center gap-2 font-mono text-[12px] text-blue">
              <Icon name="check" size={16} /> You&apos;re live — StileAI is guarding your agents.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function FlowNode({ icon, title, sub, highlight = false }: { icon: string; title: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-xl border px-3.5 py-3 ${highlight ? "bg-bluedim border-blue/40" : "bg-card border-line"}`}>
      <div className={`flex items-center gap-2 ${highlight ? "text-blue" : "text-ink2"}`}>
        <Icon name={icon} size={17} />
        <span className="font-sans font-semibold text-[12.5px] text-ink">{title}</span>
      </div>
      <div className="font-mono text-[10.5px] text-ink3 mt-1">{sub}</div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex-none flex flex-col items-center text-ink4">
      <span className="font-mono text-[9px] text-ink4 whitespace-nowrap mb-0.5">{label}</span>
      <Icon name="arrowRight" size={18} />
    </div>
  );
}

function Piece({ icon, title, body, href }: { icon: string; title: string; body: string; href: string }) {
  return (
    <Link href={href} className="group bg-card border border-line rounded-2xl p-4 hover:border-line2 transition-colors flex flex-col">
      <div className="w-9 h-9 rounded-xl bg-bluedim text-blue flex items-center justify-center mb-2.5">
        <Icon name={icon} size={18} />
      </div>
      <div className="font-sans font-semibold text-[13.5px] text-ink">{title}</div>
      <p className="font-mono text-[11px] text-ink2 leading-relaxed mt-1">{body}</p>
      <span className="font-mono text-[11px] text-blue mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
    </Link>
  );
}
