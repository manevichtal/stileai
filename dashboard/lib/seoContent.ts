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
    related: ["prevent-chatgpt-data-leaks", "shadow-ai", "ai-governance"],
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
    related: ["ai-data-loss-prevention", "shadow-ai", "prevent-chatgpt-data-leaks"],
  },
];

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}
