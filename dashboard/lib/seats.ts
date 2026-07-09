export function seatedIds(active: { id: string; created_at: string }[], planSeats: number): Set<string> {
  const ordered = [...active].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Set(ordered.slice(0, Math.max(0, planSeats)).map((e) => e.id));
}

export function callerDecision(x: { subscriptionActive: boolean; isAdmin: boolean; seated: boolean }): { allowed: boolean; reason: string } {
  if (!x.subscriptionActive) return { allowed: false, reason: "Your company's StileAI subscription is inactive." };
  if (x.isAdmin) return { allowed: true, reason: "" };
  if (!x.seated) return { allowed: false, reason: "No active seat — ask your admin to add one." };
  return { allowed: true, reason: "" };
}

// A subscription counts as active for app + proxy access when Stripe reports it
// as "active" OR "trialing" — used by both the app access gate (getProfile) and
// the proxy caller resolution (aiGate) so they never disagree.
export function isActiveStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
