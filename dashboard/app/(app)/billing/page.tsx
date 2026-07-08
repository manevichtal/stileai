import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeSeatCount } from "@/lib/employees";
import { PLANS, type PlanId } from "@/lib/stripe";
import { PageHeader } from "@/components/AppShell";
import { ManageBillingButton } from "./ManageBillingButton";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireProfileContext();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("plan, plan_seats, subscription_status, current_period_end")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const used = await activeSeatCount(ctx.orgId);

  const planId = (org?.plan ?? null) as PlanId | null;
  const plan = planId ? PLANS[planId] : null;
  const seats = org?.plan_seats ?? 0;
  const status = org?.subscription_status ?? "—";
  const isActive = status === "active";
  const renewal = org?.current_period_end
    ? new Date(org.current_period_end).toLocaleDateString()
    : null;

  const isAdmin = ctx.role === "admin";

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Your plan, seats, and subscription status."
      />
      <div className="px-6 lg:px-8 pb-10 flex flex-col gap-6 max-w-[820px]">
        <section className="bg-card border border-line rounded-2xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="font-sans text-[11px] text-ink3 uppercase tracking-wide font-medium">Plan</div>
              <div className="font-sans text-[16px] text-ink font-semibold mt-1">
                {plan?.label ?? "—"}
                {plan?.perSeat != null && (
                  <span className="font-sans text-[12px] text-ink3 font-normal ml-2">
                    ${plan.perSeat}/seat/mo
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-ink3 uppercase tracking-wide font-medium">Seats</div>
              <div className="font-sans text-[16px] text-ink font-semibold mt-1">
                {used} of {seats} used
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-ink3 uppercase tracking-wide font-medium">Status</div>
              <div className={`font-sans text-[16px] font-semibold mt-1 ${isActive ? "text-blue" : "text-slate"}`}>
                {status}
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-ink3 uppercase tracking-wide font-medium">Renewal</div>
              <div className="font-sans text-[16px] text-ink font-semibold mt-1">
                {renewal ?? "—"}
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-6 pt-5 border-t border-line">
              <ManageBillingButton />
            </div>
          ) : (
            <p className="mt-6 pt-5 border-t border-line font-sans text-[11.5px] text-ink3">
              Only an admin can manage billing.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
