import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of StileAI.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "July 17, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Agreement to these terms",
    body: [
      "These Terms of Service (the \"Terms\") are a legal agreement between you and the company operating StileAI (\"StileAI\", \"we\", \"us\"). They govern your access to and use of the StileAI website, dashboard, browser extension, gateway, and related services (together, the \"Service\").",
      "By creating an account, installing the extension, connecting a tool, or otherwise using the Service, you agree to these Terms. If you are entering into these Terms on behalf of a company or other organization, you represent that you have authority to bind that organization, and \"you\" refers to that organization.",
    ],
  },
  {
    heading: "What StileAI does",
    body: [
      "StileAI is a security checkpoint for artificial intelligence tools. It inspects requests that your users send to AI tools (such as ChatGPT, Claude, Gemini, and Copilot), applies the policies you configure, and allows, holds, or blocks each request. It records a redacted decision log so you can review and audit activity.",
      "StileAI is a policy-enforcement and monitoring tool. It reduces the risk of sensitive data leaving your organization through AI tools, but no security tool can detect or prevent every possible leak. The Service is one control among several and is not a guarantee against data loss.",
    ],
  },
  {
    heading: "Accounts and eligibility",
    body: [
      "You must provide accurate account information and keep it current. You are responsible for all activity under your account and for keeping your credentials and API keys secure. Notify us promptly of any unauthorized use.",
      "You must be at least 18 years old and able to form a binding contract to use the Service. The Service is intended for business use, not for personal or consumer use.",
    ],
  },
  {
    heading: "Your responsibilities as an administrator",
    body: [
      "StileAI is a tool that lets an organization monitor and control how its own users interact with AI tools. You are solely responsible for ensuring that your use of the Service is lawful and that you have the necessary rights, authority, and (where required) notices or consents to monitor your users' AI activity in your jurisdiction and under your employment and privacy obligations.",
      "You are responsible for the policies you configure, the users you invite, the tools you connect, and the AI provider keys you supply. You agree not to use the Service to violate any law or the terms of any AI provider you connect.",
    ],
  },
  {
    heading: "Acceptable use",
    body: ["You agree not to:"],
    bullets: [
      "Use the Service to break the law or infringe anyone's rights.",
      "Attempt to access another organization's data, or probe, scan, or breach the Service's security.",
      "Reverse engineer, resell, or provide the Service to a third party except as expressly allowed.",
      "Interfere with or overload the Service, or circumvent its usage limits or protections.",
    ],
  },
  {
    heading: "Fees, billing, and renewal",
    body: [
      "Paid plans are billed per seat on a subscription basis through our payment processor, Stripe. Unless stated otherwise, subscriptions renew automatically at the end of each billing period until cancelled. You authorize us to charge your payment method for the applicable fees, including any taxes.",
      "You can cancel at any time from the billing portal; cancellation takes effect at the end of the current billing period. Fees already paid are non-refundable except where required by law. We may change pricing on renewal with reasonable notice.",
    ],
  },
  {
    heading: "Third-party services and your keys",
    body: [
      "The Service works alongside third-party AI providers and connected tools. When you approve a request, it is completed using your own provider keys; your relationship with those providers is governed by their terms. We rely on subprocessors to operate the Service, as described in our Privacy Policy. We are not responsible for third-party services we do not control.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "We own all rights in the Service, including its software, design, and content, excluding your data. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable right to use the Service during your subscription. You own your data, including your policies and your redacted audit records, and you grant us the rights needed to operate the Service for you.",
    ],
  },
  {
    heading: "Confidentiality",
    body: [
      "Each party may access the other's confidential information in connection with the Service. Each party agrees to protect the other's confidential information with reasonable care and to use it only to perform under these Terms.",
    ],
  },
  {
    heading: "Disclaimers",
    body: [
      "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
      "We do not warrant that the Service will detect or block every sensitive or policy-violating request, that it will be uninterrupted or error-free, or that it will meet every regulatory obligation you may have. You remain responsible for your own compliance program.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, OR DATA, ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE.",
      "OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.",
    ],
  },
  {
    heading: "Indemnification",
    body: [
      "You will defend and indemnify us against third-party claims arising from your data, your use of the Service in violation of these Terms or the law, or your failure to obtain any notices or consents required to monitor your users.",
    ],
  },
  {
    heading: "Term and termination",
    body: [
      "These Terms apply while you use the Service. Either party may terminate for material breach that is not cured within 30 days of notice. We may suspend the Service immediately if your use poses a security or legal risk. On termination, your right to use the Service ends and we will delete or return your data in the ordinary course, subject to legal retention requirements.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update the Service and these Terms from time to time. If we make a material change, we will provide reasonable notice, such as by posting the updated Terms with a new date or notifying you in the dashboard. Your continued use after the change takes effect means you accept the updated Terms.",
    ],
  },
  {
    heading: "Governing law and contact",
    body: [
      "These Terms are governed by the laws of the jurisdiction in which StileAI is established, without regard to conflict-of-law rules, and the parties submit to the exclusive jurisdiction of its courts, except where mandatory local law provides otherwise.",
      "Questions about these Terms can be sent to legal@stileai.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={UPDATED}
      intro="Please read these terms carefully. They set out the rules for using StileAI, including your responsibilities as an administrator, how billing works, and the limits of our liability."
      sections={SECTIONS}
    />
  );
}
