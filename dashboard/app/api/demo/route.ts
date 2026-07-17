import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { demoRequestEmail } from "@/lib/emailTemplates";

// POST /api/demo, the public "Book a demo" form on the landing page.
//
// It always PERSISTS the lead to the demo_requests table (service role, so no
// lead is ever lost even if email is not configured), then sends a best-effort
// email notification to the founder when an email provider is set. It is public
// and unauthenticated, so it is rate limited by IP and strictly size-capped.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTIFY_TO = process.env.DEMO_NOTIFY_EMAIL || "manevichtal@gmail.com";
const MAX_BODY = 8 * 1024; // 8 KB is plenty for a contact form

function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  // Abuse guard: cap submissions per IP.
  const ip = clientIp(req);
  const rl = await rateLimit(`demo:${ip}`, 5, 600);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  // Size cap before parsing.
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return new Response(JSON.stringify({ error: "Request too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 160);
  const teamSize = clean(body.team_size, 40);
  const message = clean(body.message, 2000);
  const source = clean(body.source, 60) || "landing";

  // Honeypot: bots fill hidden fields. If present, pretend success and drop it.
  const trap = clean(body.website, 200);
  if (trap) return new Response(JSON.stringify({ ok: true }), { status: 200 });

  if (!name || !email || !isEmail(email)) {
    return new Response(JSON.stringify({ error: "Please enter your name and a valid email." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("demo_requests")
    .insert({
      name,
      email,
      company: company || null,
      team_size: teamSize || null,
      message: message || null,
      source,
      user_agent: (req.headers.get("user-agent") || "").slice(0, 400),
      ip,
    })
    .select("id")
    .single();

  if (error) {
    // The lead is what matters; if the DB write fails, surface an error so the
    // form can ask the user to try again (or email us directly).
    return new Response(JSON.stringify({ error: "Something went wrong. Please email sales@stileai.com." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Best-effort email notification. Never blocks the success response on it.
  const built = demoRequestEmail({ name, email, company, teamSize, source, message });
  const mail = await sendEmail({
    to: NOTIFY_TO,
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: email,
  });

  if (mail.sent && inserted?.id) {
    await admin.from("demo_requests").update({ notified: true }).eq("id", inserted.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
