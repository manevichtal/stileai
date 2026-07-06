import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { RecentActivity, type Decision } from "@/components/dashboard/RecentActivity";
import { ConnectSection } from "@/components/dashboard/ConnectSection";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const ctx = await requireProfileContext();
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

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
    <div className="p-5 lg:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-4 lg:gap-5">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Hero name={name} orgName={ctx.orgName} />
          <StatusCard pending={pendingCount ?? 0} policies={policyCount ?? 0} />
          <RecentActivity decisions={(recent ?? []) as Decision[]} />
          <ConnectSection origin={origin} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <StatTile value={todayCount ?? 0} label="Decisions today" />
            <StatTile value={pendingCount ?? 0} label="Awaiting approval" accent={(pendingCount ?? 0) > 0} />
          </div>
          <StatsCard days={days} deniedToday={deniedToday ?? 0} policies={policyCount ?? 0} />
          <Integrations />
          <PromoCard />
        </div>
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
    <section className="relative overflow-hidden bg-card border border-line rounded-2xl px-5 py-4 flex items-center gap-5">
      <div className="flex-1 min-w-0">
        <h1 className="font-sans font-extrabold text-[23px] tracking-[-0.03em] text-ink leading-tight">
          Welcome back, {name}
        </h1>
        <p className="font-mono text-[12px] text-ink3 mt-1">
          Here&apos;s what your checkpoint has been guarding at{" "}
          <span className="text-ink2 font-medium">{orgName || "your organization"}</span>.
        </p>
      </div>
      {/* branded tile using the StileAI wordmark */}
      <div className="hidden sm:flex flex-none items-center justify-center w-[150px] h-[68px] rounded-xl bg-rail">
        <Image src="/brandmark.png" alt="StileAI" width={104} height={30} className="h-[23px] w-auto opacity-95" />
      </div>
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
    <section className="bg-card border border-line rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-sans font-bold text-[14px] text-ink tracking-[-0.01em]">Decisions this week</h2>
        <span className="font-mono text-[10px] text-ink3 bg-bg2 border border-line rounded-md px-2 py-0.5">7 days</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[92px]" preserveAspectRatio="none" role="img" aria-label="Decisions per day">
        <polygon points={area} fill="var(--bluedim)" />
        <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.6" fill="var(--card)" stroke="var(--blue)" strokeWidth="2" />
            <text x={p.x} y={H - 6} textAnchor="middle" className="font-mono" fontSize="8.5" fill="var(--ink3)">{p.label}</text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-3 mt-2 pt-2.5 border-t border-line">
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
    <section className="rounded-2xl bg-rail text-white p-4 overflow-hidden relative">
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

const AGENTS = [
  { name: "Model Context Protocol", icon: "plug" },
  { name: "Anthropic Claude", icon: "spark" },
  { name: "OpenAI", icon: "spark" },
  { name: "LangChain", icon: "code" },
  { name: "LlamaIndex", icon: "code" },
  { name: "Custom agents", icon: "bolt" },
];
const SYSTEMS = [
  { name: "Databases", icon: "database" },
  { name: "Email", icon: "mail" },
  { name: "Payments", icon: "payment" },
  { name: "Slack", icon: "chat" },
  { name: "Cloud APIs", icon: "cloud" },
  { name: "Internal tools", icon: "server" },
];

function Chip({ name, icon }: { name: string; icon: string }) {
  return (
    <span className="flex items-center gap-1.5 bg-bg2 border border-line rounded-lg px-2.5 py-1.5 font-sans text-[11.5px] text-ink2">
      <span className="text-ink3"><Icon name={icon} size={14} /></span>
      {name}
    </span>
  );
}

function Integrations() {
  return (
    <section className="bg-card border border-line rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue"><Icon name="spark" size={16} /></span>
        <h2 className="font-sans font-bold text-[14px] text-ink tracking-[-0.01em]">Works with your stack</h2>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink4 mb-2">Any AI agent</div>
          <div className="flex flex-wrap gap-1.5">
            {AGENTS.map((a) => <Chip key={a.name} {...a} />)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink4 mb-2">Any system they touch</div>
          <div className="flex flex-wrap gap-1.5">
            {SYSTEMS.map((s) => <Chip key={s.name} {...s} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
