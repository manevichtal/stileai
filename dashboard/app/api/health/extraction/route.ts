import { orgForKey } from "@/lib/aiGate";
import { sendEmail } from "@/lib/email";
import { extractionAlertEmail } from "@/lib/emailTemplates";
import { rateLimit } from "@/lib/rateLimit";

// POST /api/health/extraction — an operational health beacon from the browser
// extension. It fires when the extension matched a real "send" endpoint but could
// not extract a user message, which almost always means the AI vendor changed
// their request shape. We log it (no prompt content, ever) AND email the owner so
// the extractor gets fixed before coverage silently drops for that site.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who gets the alert. Reuses the demo-notify address by default; override with
// EXTRACTION_NOTIFY_EMAIL. Emails only go out if RESEND_API_KEY is configured
// (the same setup that already powers the demo-request emails).
const NOTIFY_TO =
  process.env.EXTRACTION_NOTIFY_EMAIL || process.env.DEMO_NOTIFY_EMAIL || "manevichtal@gmail.com";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // Resolve to an org so anonymous noise can't flood the logs; return 204 either
  // way so this never reveals whether a key is valid.
  const orgId = key ? await orgForKey(key) : null;
  if (!orgId) return new Response(null, { status: 204 });

  let site = "unknown";
  let extVersion = "";
  try {
    const b = await req.json();
    site = String(b?.site ?? "unknown").slice(0, 40);
    extVersion = String(b?.v ?? "").slice(0, 20);
  } catch {
    /* empty/invalid body is fine */
  }

  console.warn(
    JSON.stringify({ evt: "extraction_miss", orgId, site, extVersion, ts: new Date().toISOString() }),
  );

  // Email the owner, throttled to at most one per site every 6 hours so a real
  // breakage (which fires for every user at once) can't flood the inbox. The
  // limiter fails open, and sendEmail no-ops when RESEND_API_KEY is unset, so a
  // beacon never errors and never blocks the extension.
  try {
    const gate = await rateLimit("email:extraction_miss:" + site, 1, 6 * 60 * 60);
    if (gate.allowed) {
      const mail = extractionAlertEmail({ site, extVersion, ts: new Date().toISOString() });
      await sendEmail({ to: NOTIFY_TO, subject: mail.subject, text: mail.text, html: mail.html });
    }
  } catch {
    /* email is best-effort; the logged line above is the source of truth */
  }

  return new Response(null, { status: 204 });
}
