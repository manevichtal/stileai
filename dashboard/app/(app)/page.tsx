import Link from "next/link";
import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { RecentActivity, type Decision } from "@/components/dashboard/RecentActivity";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const ctx = await requireProfileContext();
  const supabase = await createClient();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 6 * 86400_000);
  const weekAgoStart = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate()).toISOString();

  const [
    { count: todayCount },
    { count: deniedToday },
    { count: pendingCount },
    { count: policyCount },
    { data: recent },
    { data: week },
  ] = await Promise.all([
    supabase.from("audit_log").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).gte("ts", startOfToday),
    supabase.from("audit_log").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("effect", "deny").gte("ts", startOfToday),
    supabase.from("approvals").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("status", "pending"),
    supabase.from("policies").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("enabled", true),
    supabase.from("audit_log").select("decision_id, ts, actor, action, resource, effect, matched_policy").eq("org_id", ctx.orgId).order("ts", { ascending: false }).limit(12),
    supabase.from("audit_log").select("ts, effect").eq("org_id", ctx.orgId).gte("ts", weekAgoStart).limit(4000),
  ]);

  // bucket the week into 7 days
  const days: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), value: 0 });
  }
  const dayIndex = (ts: string) => {
    const diff = Math.floor((now.getTime() - new Date(ts).getTime()) / 86400_000);
    return 6 - diff;
  };
  for (const r of week ?? []) {
    const idx = dayIndex(r.ts);
    if (idx >= 0 && idx <= 6) days[idx].value++;
  }

  const name = greetName(ctx.email, ctx.orgName);

  return (
    <div className="p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 lg:gap-6 max-w-[1240px]">
      {/* Left column */}
      <div className="flex flex-col gap-5">
        <Hero name={name} orgName={ctx.orgName} />
        <StatusCard pending={pendingCount ?? 0} policies={policyCount ?? 0} />
        <RecentActivity decisions={(recent ?? []) as Decision[]} />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <StatTile value={todayCount ?? 0} label="Decisions today" />
          <StatTile value={pendingCount ?? 0} label="Awaiting approval" accent={(pendingCount ?? 0) > 0} />
        </div>
        <StatsCard days={days} deniedToday={deniedToday ?? 0} policies={policyCount ?? 0} />
        <PromoCard />
      </div>
    </div>
  );
}

function greetName(email: string | null, org: string): string {
  if (email) {
    const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return org || "there";
}

function Hero({ name, orgName }: { name: string; orgName: string }) {
  return (
    <section className="relative overflow-hidden bg-card border border-line rounded-2xl px-6 py-6">
      <div className="relative z-10 max-w-[62%]">
        <h1 className="font-sans font-extrabold text-[26px] tracking-[-0.03em] text-ink leading-tight">
          Welcome back, {name}
        </h1>
        <p className="font-mono text-[12.5px] text-ink3 mt-1.5">
          Here&apos;s what your checkpoint has been guarding at{" "}
          <span className="text-ink2 font-medium">{orgName || "your organization"}</span>.
        </p>
      </div>
      {/* signature: an abstract "checkpoint" gate motif */}
      <svg className="absolute right-4 top-1/2 -translate-y-1/2 opacity-90 hidden sm:block" width="150" height="120" viewBox="0 0 150 120" fill="none" aria-hidden>
        <rect x="1" y="1" width="148" height="118" rx="14" fill="var(--bluedim)" />
        <g stroke="var(--blue)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M48 44V34a10 10 0 0 1 10-10h6" />
          <path d="M86 24h6a10 10 0 0 1 10 10v10" />
          <path d="M102 76v10a10 10 0 0 1-10 10h-6" />
          <path d="M64 96h-6a10 10 0 0 1-10-10V76" />
        </g>
        <rect x="60" y="46" width="30" height="28" rx="6" transform="rotate(45 75 60)" fill="var(--blue)" />
      </svg>
    </section>
  );
}

function StatusCard({ pending, policies }: { pending: number; policies: number }) {
  const needsReview = pending > 0;
  return (
    <section className="bg-card border border-line rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 flex-none rounded-full bg-bluedim flex items-center justify-center">
        <span className="w-2.5 h-2.5 rounded-full bg-blue" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-sans font-semibold text-[14px] text-ink">Checkpoint online</div>
        <div className="font-mono text-[11.5px] text-ink3">
          {policies} active {policies === 1 ? "policy" : "policies"} ·{" "}
          {needsReview ? `${pending} decision${pending === 1 ? "" : "s"} need a human` : "nothing awaiting review"}
        </div>
      </div>
      <Link
        href={needsReview ? "/approvals" : "/settings"}
        className="flex-none bg-ink text-white font-sans font-semibold text-[12.5px] rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity"
      >
        {needsReview ? "Review approvals" : "Connect an agent"}
      </Link>
    </section>
  );
}

function StatTile({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "bg-blue border-blue text-white" : "bg-card border-line"}`}>
      <div className={`font-sans font-extrabold text-[30px] tracking-[-0.03em] ${accent ? "text-white" : "text-ink"}`}>{value}</div>
      <div className={`font-mono text-[11px] mt-0.5 ${accent ? "text-white/80" : "text-ink3"}`}>{label}</div>
    </div>
  );
}

function StatsCard({ days, deniedToday, policies }: { days: { label: string; value: number }[]; deniedToday: number; policies: number }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const W = 300, H = 118, padL = 6, padR = 6, padT = 12, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const pts = days.map((d, i) => {
    const x = padL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
    const y = padT + innerH * (1 - d.value / max);
    return { x, y, ...d };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${padL},${padT + innerH} ${line} ${padL + innerW},${padT + innerH}`;

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-sans font-bold text-[15px] text-ink tracking-[-0.01em]">Decisions this week</h2>
        <span className="font-mono text-[10.5px] text-ink3 bg-bg2 border border-line rounded-md px-2 py-0.5">7 days</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[118px]" preserveAspectRatio="none" role="img" aria-label="Decisions per day">
        <polygon points={area} fill="var(--bluedim)" />
        <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.6" fill="var(--card)" stroke="var(--blue)" strokeWidth="2" />
            <text x={p.x} y={H - 6} textAnchor="middle" className="font-mono" fontSize="8.5" fill="var(--ink3)">{p.label}</text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-line">
        <MiniStat value={days.reduce((a, b) => a + b.value, 0)} label="this week" />
        <MiniStat value={deniedToday} label="denied today" />
      </div>
    </section>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-sans font-bold text-[17px] text-ink">{value}</div>
      <div className="font-mono text-[10.5px] text-ink3">{label}</div>
    </div>
  );
}

function PromoCard() {
  return (
    <section className="rounded-2xl bg-rail text-white p-5 overflow-hidden relative">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 text-blue2">
          <Icon name="policies" size={18} />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-railmut">Compliance</span>
        </div>
        <h3 className="font-sans font-bold text-[15px] leading-snug">Add a compliance pack</h3>
        <p className="font-mono text-[11px] text-railink mt-1.5 leading-relaxed">
          Turn on ready-made SOC 2, HIPAA, PCI-DSS, GDPR and more — mapped to real controls, enabled in one click.
        </p>
        <Link href="/policies?tab=library" className="inline-block mt-3 bg-white text-ink font-sans font-semibold text-[12px] rounded-xl px-3.5 py-2 hover:opacity-90">
          Browse the library
        </Link>
      </div>
    </section>
  );
}
