// Branded HTML email templates. Email clients are picky: no external CSS, no
// flexbox/grid, images often blocked. So everything here is table-based with
// inline styles, which renders consistently in Gmail, Outlook, and Apple Mail.
// Each builder returns { subject, text, html } so we always send a plain-text
// fallback alongside the designed version.

const BRAND = {
  ink: "#181b1e",
  ink2: "#5e656e",
  ink3: "#9197a1",
  line: "#e6e8ec",
  blue: "#1953f0",
  dark: "#0e1013",
  gold: "#e0b33a",
  pageBg: "#f4f5f6",
};

const SITE = "https://stileai.com";

// The wrapper: dark header with the wordmark + gold accent, white card, muted
// footer. `inner` is the message-specific body HTML.
function shell(inner: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:${BRAND.dark};padding:18px 24px;border-bottom:3px solid ${BRAND.gold};">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">StileAI</span>
          <span style="color:${BRAND.ink3};font-size:12px;font-weight:500;">&nbsp;&nbsp;AI security</span>
        </td></tr>
        <tr><td style="padding:26px 24px;">
          ${inner}
        </td></tr>
        <tr><td style="background:#f9fafa;border-top:1px solid ${BRAND.line};padding:16px 24px;">
          <span style="color:${BRAND.ink3};font-size:11.5px;line-height:1.5;">
            StileAI, the policy checkpoint between your team and the AI they use.
            &nbsp;·&nbsp; <a href="${SITE}" style="color:${BRAND.ink2};text-decoration:none;">stileai.com</a>
          </span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 6px 0;color:${BRAND.ink};font-size:20px;font-weight:800;letter-spacing:-0.02em;">${text}</h1>`;
}
function para(text: string): string {
  return `<p style="margin:0 0 14px 0;color:${BRAND.ink2};font-size:14px;line-height:1.6;">${text}</p>`;
}
function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:9px;">${label}</a>`;
}
function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

// ---- Extraction-break alert -----------------------------------------------

export function extractionAlertEmail(args: { site: string; extVersion?: string; ts?: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const site = esc(args.site || "an AI tool");
  const version = esc(args.extVersion || "unknown");
  const ts = esc(args.ts || new Date().toISOString());

  const pill = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr>
    <td style="background:#fff8ec;border:1px solid #f0dcae;border-radius:8px;padding:8px 12px;color:#8a5a12;font-size:12.5px;font-weight:700;">
      &#9888;&nbsp; Extractor may be broken
    </td></tr></table>`;

  const inner = `
    ${pill}
    ${heading(`The ${site} extractor needs a look`)}
    ${para(`StileAI's browser extension just reported that it could not read a message from <b>${site}</b>.`)}
    ${para(`This usually means ${site} changed how its page sends messages, which can quietly reduce what StileAI catches on that site until the extractor is updated. Nothing sensitive is included in this alert.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px 0;border:1px solid ${BRAND.line};border-radius:8px;width:100%;">
      <tr><td style="padding:9px 12px;color:${BRAND.ink3};font-size:12px;border-bottom:1px solid ${BRAND.line};">Affected site</td><td style="padding:9px 12px;color:${BRAND.ink};font-size:12px;font-weight:600;border-bottom:1px solid ${BRAND.line};text-align:right;">${site}</td></tr>
      <tr><td style="padding:9px 12px;color:${BRAND.ink3};font-size:12px;border-bottom:1px solid ${BRAND.line};">Extension version</td><td style="padding:9px 12px;color:${BRAND.ink};font-size:12px;border-bottom:1px solid ${BRAND.line};text-align:right;">${version}</td></tr>
      <tr><td style="padding:9px 12px;color:${BRAND.ink3};font-size:12px;">Detected</td><td style="padding:9px 12px;color:${BRAND.ink};font-size:12px;text-align:right;">${ts}</td></tr>
    </table>
    ${para(`<b>What to do:</b> ask your StileAI build assistant to "update the ${site} extractor."`)}
  `;

  return {
    subject: `StileAI alert: the ${args.site || "AI tool"} extractor may be broken`,
    text:
      `Heads up. StileAI's browser extension could not read a message from ${args.site}.\n\n` +
      `This usually means ${args.site} changed how its page sends messages, which can quietly reduce what StileAI catches there until the extractor is updated. Nothing sensitive is included in this alert.\n\n` +
      `Affected site: ${args.site}\nExtension version: ${args.extVersion || "unknown"}\nDetected: ${ts}\n\n` +
      `What to do: ask your StileAI build assistant to "update the ${args.site} extractor."\n`,
    html: shell(inner),
  };
}

// ---- Demo request (to the StileAI owner) ----------------------------------

export function demoRequestEmail(args: {
  name: string;
  email: string;
  company?: string;
  teamSize?: string;
  source?: string;
  message?: string;
}): { subject: string; text: string; html: string } {
  const rows: [string, string][] = [
    ["Name", args.name || "(not given)"],
    ["Email", args.email || "(not given)"],
    ["Company", args.company || "(not given)"],
    ["Team size", args.teamSize || "(not given)"],
    ["Source", args.source || "(not given)"],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px 0;border:1px solid ${BRAND.line};border-radius:8px;width:100%;">
    ${rows
      .map(
        ([k, v], i) =>
          `<tr><td style="padding:9px 12px;color:${BRAND.ink3};font-size:12px;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.line};` : ""}">${esc(k)}</td><td style="padding:9px 12px;color:${BRAND.ink};font-size:12px;font-weight:600;text-align:right;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.line};` : ""}">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>`;

  const msg = args.message
    ? `<div style="margin:2px 0 18px 0;padding:12px 14px;background:#f9fafa;border:1px solid ${BRAND.line};border-radius:8px;color:${BRAND.ink2};font-size:13px;line-height:1.6;white-space:pre-wrap;">${esc(args.message)}</div>`
    : para(`<span style="color:${BRAND.ink3};">No message included.</span>`);

  const inner = `
    ${heading("New demo request")}
    ${para("Someone asked for a StileAI demo from the site.")}
    ${table}
    <div style="color:${BRAND.ink3};font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px 0;">What they want to protect</div>
    ${msg}
    ${args.email ? button("Reply to " + esc(args.name || "them"), "mailto:" + esc(args.email)) : ""}
  `;

  return {
    subject: `Demo request: ${args.name}${args.company ? " (" + args.company + ")" : ""}`,
    text:
      `New demo request from the StileAI site\n\n` +
      `Name:      ${args.name}\n` +
      `Email:     ${args.email}\n` +
      `Company:   ${args.company || "(not given)"}\n` +
      `Team size: ${args.teamSize || "(not given)"}\n` +
      `Source:    ${args.source || "(not given)"}\n\n` +
      `Message:\n${args.message || "(none)"}\n`,
    html: shell(inner),
  };
}
