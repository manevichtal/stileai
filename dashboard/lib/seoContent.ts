// Keyword-targeted marketing pages. Each targets a distinct, winnable search
// cluster with unique content (no doorway/duplicate pages). Rendered server-side
// by components/SeoLanding.tsx and listed in the sitemap.

export type SeoSection = { h2: string; body: string[]; bullets?: string[] };
export type SeoPage = {
  slug: string;
  eyebrow: string;
  h1: string;
  linkLabel: string; // used in "Related" lists
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: SeoSection[];
  faqs: { q: string; a: string }[];
  ctaTitle: string;
  ctaBody: string;
  related: string[];
};

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "ai-data-loss-prevention",
    eyebrow: "AI Data Loss Prevention",
    h1: "AI Data Loss Prevention (DLP) for ChatGPT, Claude, and Copilot",
    linkLabel: "AI data loss prevention (DLP)",
    metaTitle: "AI Data Loss Prevention (DLP) | StileAI",
    metaDescription:
      "AI DLP that checks every prompt your team sends to ChatGPT, Claude, Gemini, Cursor and Copilot, and blocks secrets, PII, and source code before they leave. See how StileAI works.",
    intro:
      "Traditional data loss prevention was built for files and email. It never sees the chat box, which is exactly where your team now pastes customer lists, API keys, and source code. StileAI is DLP built for AI: it inspects every request to an AI tool and stops sensitive data before it leaves your company.",
    sections: [
      {
        h2: "Why classic DLP misses AI",
        body: [
          "Your firewall, CASB, and email DLP watch attachments, uploads, and outbound mail. An employee pasting a spreadsheet into ChatGPT does none of those things, so nothing in your stack records it or stops it. The data is gone the instant they hit enter, to a server you do not control, sometimes into a model you will never see.",
        ],
      },
      {
        h2: "How StileAI does AI DLP",
        body: ["StileAI sits in the path between your team and the AI tools they use, and gives every request one of three outcomes:"],
        bullets: [
          "ALLOW: safe and in-policy, sent straight through with no friction.",
          "HOLD: sensitive, held for an admin to approve before it can be sent.",
          "BLOCK: against policy, stopped before it ever leaves the browser or client.",
        ],
      },
      {
        h2: "What it detects",
        body: ["Detection runs in layers so disguised and reworded leaks are still caught, not just tidy keywords."],
        bullets: [
          "Secrets: API keys, passwords, tokens, and private keys, including novel formats caught by entropy and shape.",
          "Personal data (PII): emails, phone numbers, national IDs, and valid payment-card numbers.",
          "Customer and client records, financial data, and legal documents.",
          "Source code and proprietary configuration.",
          "Meaning-based detection for paraphrased, unlabeled, or non-English content that pattern matching misses.",
        ],
      },
      {
        h2: "Audit-ready by default",
        body: [
          "Every decision is logged, who sent what, which policy caught it, and the outcome, with sensitive values redacted. The categories map to SOC 2, GDPR, HIPAA, PCI-DSS, and ISO 27001, so an AI leak you stopped becomes evidence you can hand an auditor.",
        ],
      },
    ],
    faqs: [
      { q: "What is AI DLP?", a: "AI data loss prevention checks the prompts and requests your team sends to AI tools and blocks or holds anything sensitive before it leaves, the same idea as classic DLP but built for the chat box and AI APIs that traditional tools cannot see." },
      { q: "Does StileAI replace my existing DLP?", a: "No. It covers the gap your existing DLP cannot: outbound requests to AI tools. It runs alongside your firewall, CASB, and email DLP." },
      { q: "Does my data get stored?", a: "Content that is blocked or held is never stored, only the decision and category are logged, with sensitive spans redacted. Your AI provider keys pass straight through and are never saved." },
      { q: "Which AI tools does it cover?", a: "ChatGPT, Claude, and Gemini in the browser via an extension, plus Cursor, Claude Code, and any OpenAI- or Anthropic-API app via a one-line gateway setup." },
    ],
    ctaTitle: "Put AI DLP in place this week",
    ctaBody: "Connect StileAI to the AI tools your team already uses and start seeing, and stopping, sensitive data leaving in prompts.",
    related: ["prevent-chatgpt-data-leaks", "enterprise-ai-security", "prevent-source-code-leaks-ai"],
  },
  {
    slug: "prevent-chatgpt-data-leaks",
    eyebrow: "ChatGPT Data Leak Prevention",
    h1: "How to Prevent Data Leaks in ChatGPT",
    linkLabel: "Prevent ChatGPT data leaks",
    metaTitle: "Prevent ChatGPT Data Leaks | StileAI",
    metaDescription:
      "Stop employees pasting customer data, API keys, and source code into ChatGPT. StileAI checks every prompt against your policy and blocks or holds leaks before they leave the browser.",
    intro:
      "The fastest way company data leaves today is a copy-paste into ChatGPT. There is no undo button on a prompt. StileAI checks every message before it is sent and stops the ones that carry secrets, customer data, or source code, without banning ChatGPT for your team.",
    sections: [
      {
        h2: "The one-keystroke leak",
        body: [
          "An employee drops a customer spreadsheet in to \"clean it up,\" pastes a stack trace that contains a live API key, or shares a contract to summarize. It feels harmless and it takes one second. None of it shows up in your normal security stack, because the chat box is invisible to it.",
        ],
      },
      {
        h2: "Block the leak, keep the tool",
        body: [
          "Banning ChatGPT does not work: people use it anyway on personal accounts, where you have zero visibility. The better answer is a checkpoint. StileAI installs as a browser extension for ChatGPT, Claude, and Gemini, checks each prompt in the browser in about 40 milliseconds, and only stops the ones that break your policy.",
        ],
        bullets: [
          "Real secrets and against-policy content are blocked before they leave.",
          "Borderline requests are held for a quick admin approval.",
          "Safe prompts go straight through, so nobody's workflow slows down.",
        ],
      },
      {
        h2: "See what your team is really sending",
        body: [
          "Turn on monitor mode for your first two weeks and StileAI logs what would have happened on every prompt without blocking anything. Most teams are surprised how much sensitive data is going out. Then flip to enforce with your eyes open.",
        ],
      },
    ],
    faqs: [
      { q: "How do I stop employees pasting sensitive data into ChatGPT?", a: "Put a checkpoint in front of ChatGPT. StileAI's browser extension checks each prompt against your policy and blocks or holds anything with secrets, PII, or source code before it is sent, while letting safe prompts through." },
      { q: "Will it slow my team down?", a: "No. The check takes about 40 milliseconds and only interrupts the small fraction of prompts that actually carry sensitive data." },
      { q: "Can I try it without blocking anyone?", a: "Yes. Monitor mode logs what would have happened on every prompt for a window you choose, so you can see your environment before enforcement is turned on." },
      { q: "Does it work on the ChatGPT website?", a: "Yes, through a Chrome extension for ChatGPT, Claude, and Gemini on the web. For desktop and dev tools, a one-line gateway setup covers the OpenAI and Anthropic APIs." },
    ],
    ctaTitle: "Stop the next ChatGPT leak",
    ctaBody: "Install the checkpoint, set your policy, and let your team keep using ChatGPT without sending your data with it.",
    related: ["ai-data-loss-prevention", "shadow-ai", "ai-governance"],
  },
  {
    slug: "shadow-ai",
    eyebrow: "Shadow AI",
    h1: "Shadow AI: See It, Then Control It",
    linkLabel: "Shadow AI governance",
    metaTitle: "Shadow AI: How to See and Control It | StileAI",
    metaDescription:
      "Shadow AI is the unapproved AI use happening across your company right now. StileAI gives you visibility into every AI request and enforces policy on what leaves.",
    intro:
      "Shadow AI is the AI your team already uses without approval or oversight, on personal accounts, in the browser, inside their IDE. You cannot secure what you cannot see. StileAI turns shadow AI into governed AI: one console for every request, and policy enforced on what leaves.",
    sections: [
      {
        h2: "Why shadow AI is different from shadow IT",
        body: [
          "Old shadow IT leaked data slowly, through an unsanctioned app someone signed up for. Shadow AI leaks it instantly, in the text of a single prompt, and it often goes to a model that may train on it. The surface is every employee with a browser, and the exit is a chat box your security tools do not watch.",
        ],
      },
      {
        h2: "Step one: visibility",
        body: [
          "StileAI's monitor mode records what your team sends to AI, and what would have been allowed, held, or blocked, without stopping anything. In the first two weeks most teams find secrets, customer data, and source code going out daily. Now you have the evidence instead of a hunch.",
        ],
      },
      {
        h2: "Step two: control",
        body: ["Switch to enforce and your policy is applied on every request, on every covered tool, with every decision logged."],
        bullets: [
          "Set rules per category: block secrets, hold customer data for approval, allow general use.",
          "Cover browser AI (ChatGPT, Claude, Gemini) and dev tools (Cursor, Claude Code) from one place.",
          "Give each employee their own key so you can see who sent what.",
        ],
      },
    ],
    faqs: [
      { q: "What is shadow AI?", a: "Shadow AI is unapproved or unmonitored use of AI tools across a company, typically employees pasting company data into ChatGPT, Claude, or coding assistants without oversight." },
      { q: "How do I detect shadow AI?", a: "Put a checkpoint in the path to AI tools and run it in monitor mode. StileAI logs every AI request and what would have happened to it, so you can see the real scope before enforcing anything." },
      { q: "How do I control shadow AI without banning AI?", a: "Enforce policy at the point of use instead of blocking the tools. StileAI allows safe prompts, holds sensitive ones for approval, and blocks against-policy content, so people keep their AI and the data stays in." },
    ],
    ctaTitle: "Bring shadow AI into the light",
    ctaBody: "Start in monitor mode, see exactly what your team sends to AI, then enforce your policy with one switch.",
    related: ["ai-data-loss-prevention", "prevent-chatgpt-data-leaks", "ai-governance"],
  },
  {
    slug: "ai-governance",
    eyebrow: "AI Governance",
    h1: "AI Governance and Acceptable-Use Enforcement",
    linkLabel: "AI governance and policy enforcement",
    metaTitle: "AI Governance & Acceptable-Use Enforcement | StileAI",
    metaDescription:
      "Turn your AI acceptable-use policy from a document into enforcement. StileAI applies your rules on every AI request and logs every decision for audit.",
    intro:
      "Most companies have an AI acceptable-use policy in a document nobody reads. StileAI turns that policy into enforcement that runs on every request your team sends to AI, and logs every decision so you can prove it.",
    sections: [
      {
        h2: "From a PDF policy to real enforcement",
        body: [
          "A written policy asks people to remember rules under deadline pressure. Enforcement does not rely on memory. You set what happens to each kind of sensitive data once, and StileAI applies it automatically on every prompt, the same way every time.",
        ],
      },
      {
        h2: "Governance that maps to your frameworks",
        body: ["Every decision is recorded and the categories line up with the controls you already report against."],
        bullets: [
          "SOC 2, ISO 27001, and ISO 42001 (AI management).",
          "GDPR, CCPA, HIPAA, PCI-DSS, and GLBA where they apply.",
          "The EU AI Act, NIST AI RMF, and OWASP LLM risks.",
        ],
      },
      {
        h2: "Built for multi-tenant control",
        body: [
          "Each organization is fully isolated with row-level security, so an admin only ever sees their own data. For MSPs and IT teams managing several clients, you set and enforce policy across every organization you support, and every block becomes evidence you can hand them.",
        ],
      },
    ],
    faqs: [
      { q: "What is AI governance?", a: "AI governance is the set of rules and controls that decide how AI can be used with company data, and the enforcement and logging that make those rules real rather than aspirational." },
      { q: "How does StileAI enforce an AI acceptable-use policy?", a: "You configure what happens to each category of sensitive content (allow, hold for approval, or block). StileAI applies that policy on every AI request and records the outcome in an audit log." },
      { q: "Can StileAI produce audit evidence?", a: "Yes. Every decision is logged with the policy that fired and the outcome, sensitive values redacted, and can be exported for any review period." },
    ],
    ctaTitle: "Make your AI policy enforceable",
    ctaBody: "Configure your rules once and let StileAI enforce them on every request, with a full audit trail behind every decision.",
    related: ["ai-compliance", "enterprise-ai-security", "shadow-ai"],
  },
  {
    slug: "enterprise-ai-security",
    eyebrow: "Enterprise AI Security",
    h1: "Enterprise AI Security: Protect Company Data in Every AI Tool",
    linkLabel: "Enterprise AI security",
    metaTitle: "Enterprise AI Security | StileAI",
    metaDescription:
      "Enterprise AI security that inspects every prompt to ChatGPT, Claude, Gemini, Cursor and Copilot, and blocks secrets, PII, and source code before they leave. See how StileAI secures AI adoption.",
    intro:
      "Your team already uses AI. The question is whether anything checks what they send it. Enterprise AI security is not about banning tools, it is about putting a checkpoint in front of them so people can move fast while secrets, customer data, and source code stay inside the company.",
    sections: [
      {
        h2: "The new perimeter is the prompt",
        body: [
          "Security has spent a decade watching files, email, and uploads. None of that sees the chat box, which is now the fastest path for data to leave. The prompt is the new perimeter, and most companies have nothing standing on it.",
        ],
      },
      {
        h2: "A checkpoint, not a ban",
        body: ["StileAI sits in the path between your team and every AI tool and gives each request one of three outcomes, so productivity stays high and leaks stop."],
        bullets: [
          "ALLOW: safe and in-policy, sent through with no friction.",
          "HOLD: sensitive, held for an admin to approve.",
          "BLOCK: against policy, stopped before it leaves.",
        ],
      },
      {
        h2: "Coverage across the tools your team actually uses",
        body: ["One policy, enforced everywhere people reach for AI."],
        bullets: [
          "Browser tools: ChatGPT, Claude, and Gemini via a managed extension.",
          "Coding assistants: Cursor, Claude Code, and any OpenAI- or Anthropic-API client via a one-line gateway.",
          "Meaning-based detection so paraphrased, unlabeled, and non-English content is still caught.",
        ],
      },
      {
        h2: "Deploy without breaking anything",
        body: [
          "Start in monitor mode: StileAI watches and logs what your team sends to AI without changing anything, so you see your real exposure first. When you are ready, flip to enforcement with one switch. If StileAI is ever unreachable it fails closed, it never quietly lets sensitive data through.",
        ],
      },
    ],
    faqs: [
      { q: "What is enterprise AI security?", a: "Enterprise AI security is the set of controls that keep company data safe as employees use AI tools: inspecting prompts, enforcing policy on what can be sent, and logging every decision for audit." },
      { q: "Do we have to block AI tools?", a: "No. StileAI is built so your team keeps using ChatGPT, Claude, Gemini, and coding assistants. It only stops the individual requests that carry sensitive data." },
      { q: "How fast can we roll it out?", a: "Monitor mode can be on the same week. It logs exposure without changing anything, then you enforce your policy with one switch when you are ready." },
      { q: "What happens if StileAI goes down?", a: "It fails closed. Sensitive requests are held or blocked rather than allowed through, so an outage never becomes a leak." },
    ],
    ctaTitle: "Secure AI adoption without slowing your team",
    ctaBody: "Put a checkpoint in front of every AI tool your team uses, start in monitor mode, and enforce your policy when you are ready.",
    related: ["ai-data-loss-prevention", "ai-compliance", "shadow-ai"],
  },
  {
    slug: "ai-compliance",
    eyebrow: "AI Compliance",
    h1: "AI Compliance: Audit-Ready Controls for SOC 2, GDPR, and HIPAA",
    linkLabel: "AI compliance and audit evidence",
    metaTitle: "AI Compliance for SOC 2, GDPR & HIPAA | StileAI",
    metaDescription:
      "Turn AI usage into audit evidence. StileAI logs every AI request and maps controls to SOC 2, GDPR, HIPAA, PCI-DSS, ISO 27001, and the EU AI Act, with sensitive values redacted.",
    intro:
      "Auditors are starting to ask a simple question: what stops an employee from pasting regulated data into an AI tool? If your answer is a policy document, that is not a control. StileAI turns AI usage into an enforced, logged, audit-ready control.",
    sections: [
      {
        h2: "A control auditors accept",
        body: [
          "A written acceptable-use policy asks people to remember rules. A control does something and produces evidence. StileAI enforces your policy on every AI request and records the decision, so you can show not just that you have a rule but that it fires.",
        ],
      },
      {
        h2: "Mapped to the frameworks you report against",
        body: ["Detection categories line up with the controls and regulations you already answer to."],
        bullets: [
          "SOC 2, ISO 27001, and ISO 42001 (AI management systems).",
          "GDPR, CCPA, HIPAA, PCI-DSS, and GLBA where they apply.",
          "The EU AI Act, NIST AI RMF, and OWASP LLM Top 10 risks.",
        ],
      },
      {
        h2: "Evidence without exposure",
        body: [
          "Every decision is logged with who sent what, the policy that caught it, and the outcome, and sensitive values are redacted before anything is stored. You get a complete audit trail without the log itself becoming a new place your secrets live.",
        ],
      },
    ],
    faqs: [
      { q: "How does StileAI help with compliance audits?", a: "It produces a logged, timestamped record of every AI request and the policy decision behind it, with sensitive data redacted, which you can export for any review period as evidence that your AI controls are enforced." },
      { q: "Which frameworks does it map to?", a: "The detection categories map to SOC 2, ISO 27001, ISO 42001, GDPR, CCPA, HIPAA, PCI-DSS, GLBA, the EU AI Act, and NIST AI RMF." },
      { q: "Does the audit log store sensitive data?", a: "No. Sensitive spans are redacted before the decision is logged, so the log records what happened and which policy fired without keeping the secret itself." },
    ],
    ctaTitle: "Make AI usage audit-ready",
    ctaBody: "Enforce your policy on every AI request and hand auditors a clean, redacted record of every decision.",
    related: ["ai-governance", "enterprise-ai-security", "ai-data-loss-prevention"],
  },
  {
    slug: "prevent-source-code-leaks-ai",
    eyebrow: "Source Code Protection",
    h1: "Prevent Source Code Leaks in Copilot, Cursor, and AI Coding Tools",
    linkLabel: "Prevent source code leaks in AI tools",
    metaTitle: "Prevent Source Code Leaks in AI Coding Tools | StileAI",
    metaDescription:
      "Stop proprietary code, secrets, and config leaking into Copilot, Cursor, Claude Code, and ChatGPT. StileAI inspects requests from coding assistants and blocks leaks before they leave.",
    intro:
      "AI coding assistants are pasted the exact things you most need to protect: proprietary source, private keys, and internal config. StileAI inspects what those tools send and stops the requests that carry your code or credentials out of the company.",
    sections: [
      {
        h2: "The IDE is a data-exfiltration path",
        body: [
          "A coding assistant reads files, sends context to a model, and gets completions back. That flow is useful, and it is also a direct route for a proprietary file or a hardcoded key to leave your environment, one that your email and file DLP never sees.",
        ],
      },
      {
        h2: "One line to cover every API-based tool",
        body: [
          "For Cursor, Claude Code, and any OpenAI- or Anthropic-API client, StileAI installs as a gateway with a single line. Requests route through the checkpoint, get inspected, and only in-policy ones reach the model. No per-tool integration to maintain.",
        ],
      },
      {
        h2: "What it catches in code",
        body: ["Detection is tuned for the things that leak from an IDE."],
        bullets: [
          "Secrets: API keys, tokens, and private keys, including novel formats caught by entropy and shape.",
          "Proprietary source code and internal configuration.",
          "Connection strings, environment variables, and infrastructure detail.",
        ],
      },
    ],
    faqs: [
      { q: "Does StileAI work with Cursor and Claude Code?", a: "Yes. Any OpenAI- or Anthropic-API client, including Cursor and Claude Code, routes through StileAI with a one-line gateway setup, and every request is inspected before it reaches the model." },
      { q: "Will it slow down my developers?", a: "In-policy requests pass straight through. Only the requests that carry secrets or proprietary code are held or blocked, so day-to-day coding is unaffected." },
      { q: "Does it catch hardcoded secrets?", a: "Yes. Secret detection uses format patterns plus entropy and shape analysis, so even novel or unusual key formats are caught, not just known prefixes." },
    ],
    ctaTitle: "Keep your source code inside the company",
    ctaBody: "Route your AI coding tools through StileAI and stop proprietary code and secrets from leaving in a completion request.",
    related: ["ai-data-loss-prevention", "enterprise-ai-security", "prevent-chatgpt-data-leaks"],
  },
];

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}
