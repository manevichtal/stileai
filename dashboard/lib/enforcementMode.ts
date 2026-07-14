// Enforcement mode: whether a company's checkpoint actually blocks ("enforce")
// or only observes and logs ("monitor"). Kept as a pure module so the decision
// is unit-testable and lives in exactly one place — both the extension path
// (gate) and the proxy path go through the same logic.
//
// Safety rule baked in here: an EXPIRED monitor window resolves back to
// "enforce". Monitor mode never silently outlives its window, so a company can
// never end up unprotected because someone forgot to turn enforcement back on.

export type EnforcementMode = "enforce" | "monitor";

export const ENFORCEMENT_MODES: EnforcementMode[] = ["enforce", "monitor"];

export function isEnforcementMode(x: unknown): x is EnforcementMode {
  return x === "enforce" || x === "monitor";
}

// The mode that actually applies right now. Monitor only applies while its window
// is open; a missing or past monitor_until means enforce.
export function effectiveMode(
  mode: string | null | undefined,
  monitorUntil: string | null | undefined,
  nowMs: number,
): EnforcementMode {
  if (mode !== "monitor") return "enforce";
  if (!monitorUntil) return "monitor"; // open-ended monitor (allowed, but the UI nudges toward a window)
  const until = Date.parse(monitorUntil);
  if (Number.isNaN(until)) return "monitor";
  return until > nowMs ? "monitor" : "enforce"; // expired → protect
}

// Whole days left in the monitor window (0 if today is the last day, null if none).
export function daysLeft(monitorUntil: string | null | undefined, nowMs: number): number | null {
  if (!monitorUntil) return null;
  const until = Date.parse(monitorUntil);
  if (Number.isNaN(until)) return null;
  const ms = until - nowMs;
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

// A monitor window ending N days from now, as an ISO string. Pass the current
// time in (callers stamp it) so this stays pure.
export function monitorUntilFrom(nowMs: number, days: number): string {
  const d = Math.max(1, Math.floor(days));
  return new Date(nowMs + d * 86_400_000).toISOString();
}
