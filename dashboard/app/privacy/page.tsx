import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How StileAI collects, uses, and protects data. Built to see less, not more.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "July 17, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Our approach",
    body: [
      "StileAI is a security product, and its whole design is to see less, not more. We sit in the path of your team's AI requests to enforce your policies, but we minimize what we keep, we do not sell your data, and we do not train any model on it.",
      "This policy explains what we collect, how we use it, and the choices you have. For data your organization sends through the Service, your organization is the controller and StileAI acts as a processor on your behalf. For your account and billing data, StileAI is the controller.",
    ],
  },
  {
    heading: "Information we collect",
    body: ["We collect three kinds of information:"],
    bullets: [
      "Account data: your name, work email, organization, team members, and hashed API keys. Used to run your account.",
      "Billing data: handled by our payment processor, Stripe. We receive subscription and status information, not your full card details.",
      "AI request metadata: for each request your users send to a connected AI tool, we record the decision (approved, held, or blocked), the policy category that matched, and a short preview only of requests you explicitly allow.",
    ],
  },
  {
    heading: "What we never store",
    body: ["By design, we do not store:"],
    bullets: [
      "The content of any blocked or held request. It is replaced with a placeholder such as \"(restricted content hidden)\".",
      "The secrets, passwords, source code, or customer data that our checks detect. We record the category, never the sensitive value.",
      "Your AI provider keys. They pass through to the AI provider and are never saved.",
      "Anything used to train a model. Ever.",
    ],
  },
  {
    heading: "How we use information",
    body: [
      "We use account and billing data to provide the Service, authenticate you, process payments, and communicate with you about your account. We use AI request metadata to enforce your policies, show you your audit log and approvals queue, keep the Service secure, and troubleshoot problems.",
      "We do not sell personal information, and we do not use your requests or audit data to train models or for advertising.",
    ],
  },
  {
    heading: "How a request is processed",
    body: [
      "A request reaches StileAI over an encrypted (TLS) connection and is checked against your policies in memory as it passes through. Safe requests are forwarded to your AI provider unchanged, using your own key. Risky requests are stopped before they leave, and their content never reaches the AI and is never written to our records. Only the decision and category are.",
      "For the small share of requests our local checks cannot classify with confidence, and only when you enable it, the request text may be sent to Anthropic's Claude Haiku model for a second opinion. It is not stored by that model and not used for training, and your policies decide the outcome.",
    ],
  },
  {
    heading: "Subprocessors",
    body: ["We rely on a short list of service providers to run StileAI. We add nothing beyond these to handle your data:"],
    bullets: [
      "Vercel: runs the StileAI application and the policy checkpoint.",
      "Supabase (PostgreSQL): stores your account, policies, and the redacted audit trail.",
      "Stripe: processes subscription billing. Sees billing details, never your AI requests or audit data.",
      "Anthropic: provides the optional deep-inspection second opinion described above.",
      "Your connected AI providers (such as OpenAI, Anthropic, Google): receive only the requests your policies approve, using your own keys.",
    ],
  },
  {
    heading: "Data isolation and security",
    body: [
      "Every organization's policies, decisions, and keys live behind row-level security in the database, so one organization can never read another's data. The isolation is enforced at the data layer, not just in the application.",
      "We encrypt data in transit, hash API keys at rest, and design the checkpoint to fail closed: if StileAI cannot verify a request, it holds or blocks it rather than letting it through. No method of storage or transmission is perfectly secure, but we work to protect your data using industry-standard measures.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "We keep account data for as long as your account is active. We keep redacted audit records for the retention period associated with your plan or as configured by your administrator. When you delete data or close your account, we delete or de-identify the associated data in the ordinary course, subject to any legal retention obligations.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on where you live, you may have rights to access, correct, delete, or export your personal data, or to object to or restrict certain processing. Because much of the data we process is controlled by your organization, we will refer requests about that data to your organization, or act on its instructions.",
      "To exercise a right or ask a question, contact privacy@stileai.com. We do not discriminate against you for exercising your rights.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use only the cookies needed to run the Service, primarily to keep you signed in. We do not use advertising or cross-site tracking cookies.",
    ],
  },
  {
    heading: "International transfers and children",
    body: [
      "We and our subprocessors may process data in countries other than yours. Where required, we use appropriate safeguards for such transfers. The Service is for business use and is not directed to children, and we do not knowingly collect data from anyone under 16.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "We may update this policy from time to time. If we make a material change, we will post the updated policy with a new date and, where appropriate, notify you in the dashboard.",
      "For any privacy question, or for a Data Processing Agreement, contact privacy@stileai.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro="StileAI is built to see less, not more. This policy explains exactly what we collect, what we never store, who we rely on, and the control you keep over your data."
      sections={SECTIONS}
    />
  );
}
