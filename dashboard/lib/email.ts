// Minimal transactional email sender. Uses Resend's REST API directly (no SDK,
// no extra dependency) so it works on the Edge/Node runtime with just a fetch.
//
// It is intentionally OPTIONAL: if RESEND_API_KEY is not set, sendEmail() returns
// { sent: false } instead of throwing, so callers can persist their data first and
// treat the email as a best-effort notification. Nothing that matters should depend
// on the email actually going out.

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, text, replyTo }: SendArgs): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "no_provider" };
  // "from" must be a verified sender on your Resend account. Until a custom domain
  // is verified, Resend's shared onboarding sender works for notifications to the
  // account owner. Override with EMAIL_FROM once your domain is set up.
  const from = process.env.EMAIL_FROM || "StileAI <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e).slice(0, 200) };
  }
}
