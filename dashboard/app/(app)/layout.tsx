import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { effectiveMode, daysLeft } from "@/lib/enforcementMode";

export const dynamic = "force-dynamic";

// Shared shell for every authenticated page. The dark sidebar renders once here
// and stays put across navigation; only the content area swaps (see loading.tsx),
// which is what makes moving between pages feel instant.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireProfileContext();

  // Monitor-mode banner: if this org is observing (not enforcing), say so on every
  // page. A security product must never let someone believe they're protected when
  // they're only watching.
  let monitorLeft: number | null = null;
  if (ctx.orgId) {
    const supabase = await createClient();
    const { data: s } = await supabase
      .from("org_policy_settings")
      .select("enforcement_mode, monitor_until")
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (effectiveMode(s?.enforcement_mode as string | undefined, s?.monitor_until as string | undefined, Date.now()) === "monitor") {
      monitorLeft = daysLeft((s?.monitor_until as string | undefined) ?? null, Date.now());
    }
  }

  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      {monitorLeft !== null && (
        <div
          className="px-4 py-2 font-sans text-[12px] font-medium flex items-center gap-2 flex-wrap"
          style={{ background: "#fff8ec", borderBottom: "1px solid #e7c98a", color: "#8a5a12" }}
        >
          <span>👁️ Monitor mode is on — StileAI is reporting only and <b>not blocking anything</b>.</span>
          <span className="text-ink3">
            {monitorLeft > 0 ? `Enforcement turns on in ${monitorLeft} day${monitorLeft === 1 ? "" : "s"}.` : "Window ended; enforcing now."}
          </span>
          <a href="/policies" className="text-blue hover:underline">Manage</a>
        </div>
      )}
      {children}
    </AppShell>
  );
}
