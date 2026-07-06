// Ready-made policy packs. "Recommended" is general agent safety; the rest map
// to real compliance controls. Each template matches the engine's shape
// (actor/action/resource globs + optional conditions). Adding a pack upserts its
// policies into the org (idempotent on policy_id), so admins can turn a whole
// framework on in one click and then tune individual rules.

export type TemplateCondition = { field: string; op: string; value: unknown };
export type PolicyTemplate = {
  policy_id: string;
  effect: "allow" | "deny" | "require_approval";
  priority: number;
  actor?: string;
  action: string;
  resource?: string;
  conditions?: TemplateCondition[];
  approvals_required?: number;
  description: string;
  control?: string; // e.g. "SOC 2 CC6.1"
};

export type PolicyPack = {
  key: string;
  name: string;
  framework: string;
  blurb: string;
  recommended?: boolean;
  templates: PolicyTemplate[];
};

export const POLICY_PACKS: PolicyPack[] = [
  {
    key: "baseline",
    name: "Recommended baseline",
    framework: "General agent safety",
    recommended: true,
    blurb: "The starting set every deployment should have: block the irreversible, auto-allow the harmless, and put a human on money and mass changes.",
    templates: [
      { policy_id: "baseline-deny-db-drop", effect: "deny", priority: 10, action: "db.drop*", description: "Dropping tables or databases is never allowed via an agent.", control: "Destructive-action guard" },
      { policy_id: "baseline-deny-table-delete", effect: "deny", priority: 15, action: "db.delete", resource: "table:*", description: "Deleting an entire table is blocked; delete specific records instead.", control: "Destructive-action guard" },
      { policy_id: "baseline-allow-reads", effect: "allow", priority: 30, action: "*.read", description: "Read-only actions are allowed for any actor.", control: "Least-friction reads" },
      { policy_id: "baseline-allow-search", effect: "allow", priority: 31, action: "*.search", description: "Search and list actions are allowed.", control: "Least-friction reads" },
      { policy_id: "baseline-approve-large-payment", effect: "require_approval", priority: 40, action: "payment.charge", approvals_required: 1, conditions: [{ field: "amount", op: "gt", value: 100 }], description: "Charges over $100 need one human approval.", control: "Money-movement control" },
      { policy_id: "baseline-approve-record-delete", effect: "require_approval", priority: 45, action: "db.delete", approvals_required: 1, description: "Deleting a specific record needs human approval.", control: "Destructive-action control" },
      { policy_id: "baseline-approve-external-email", effect: "require_approval", priority: 50, action: "email.send", approvals_required: 1, description: "Sending outbound email needs approval.", control: "Data-egress control" },
    ],
  },
  {
    key: "soc2",
    name: "SOC 2",
    framework: "Trust Services Criteria",
    blurb: "Change management, access, and audit-integrity controls agents commonly touch.",
    templates: [
      { policy_id: "soc2-approve-prod-config", effect: "require_approval", priority: 22, action: "config.*", resource: "env:prod*", approvals_required: 1, description: "Production configuration changes require human approval.", control: "SOC 2 CC8.1 (Change mgmt)" },
      { policy_id: "soc2-deny-disable-audit", effect: "deny", priority: 8, action: "*.disable_audit", description: "Disabling the audit trail is never allowed.", control: "SOC 2 CC7.2 (Monitoring)" },
      { policy_id: "soc2-approve-access-grant", effect: "require_approval", priority: 24, action: "iam.grant*", approvals_required: 1, description: "Granting access or roles requires approval.", control: "SOC 2 CC6.1 (Logical access)" },
      { policy_id: "soc2-approve-data-export", effect: "require_approval", priority: 26, action: "*.export", approvals_required: 1, description: "Exporting data requires approval.", control: "SOC 2 CC6.7 (Data transfer)" },
    ],
  },
  {
    key: "hipaa",
    name: "HIPAA",
    framework: "Protected Health Information",
    blurb: "Guardrails for anything touching PHI — access, export, and disclosure.",
    templates: [
      { policy_id: "hipaa-approve-phi-read", effect: "require_approval", priority: 28, action: "*.read", resource: "phi:*", approvals_required: 1, description: "Reading protected health information requires approval.", control: "HIPAA §164.312(a) (Access control)" },
      { policy_id: "hipaa-approve-phi-export", effect: "require_approval", priority: 20, action: "*.export", resource: "phi:*", approvals_required: 1, description: "Exporting PHI requires approval.", control: "HIPAA §164.312(e) (Transmission security)" },
      { policy_id: "hipaa-deny-phi-delete", effect: "deny", priority: 12, action: "*.delete", resource: "phi:*", description: "Deleting PHI records via an agent is blocked (retention).", control: "HIPAA §164.316(b) (Retention)" },
      { policy_id: "hipaa-approve-phi-disclose", effect: "require_approval", priority: 21, action: "*.share", resource: "phi:*", approvals_required: 1, description: "Disclosing PHI to any party requires approval.", control: "HIPAA §164.508 (Disclosure)" },
    ],
  },
  {
    key: "pci",
    name: "PCI-DSS",
    framework: "Cardholder data",
    blurb: "Keep agents away from storing PANs and put approvals on card operations.",
    templates: [
      { policy_id: "pci-deny-store-pan", effect: "deny", priority: 9, action: "card.store", description: "Storing full card numbers (PAN) is never allowed.", control: "PCI-DSS 3.2 (No PAN storage)" },
      { policy_id: "pci-deny-log-pan", effect: "deny", priority: 9, action: "log.write", resource: "card:*", description: "Writing card data to logs is blocked.", control: "PCI-DSS 3.4 (Render PAN unreadable)" },
      { policy_id: "pci-approve-charge", effect: "require_approval", priority: 42, action: "payment.charge", approvals_required: 1, description: "Card charges require approval.", control: "PCI-DSS 10 (Track access)" },
      { policy_id: "pci-approve-refund", effect: "require_approval", priority: 42, action: "payment.refund", approvals_required: 1, description: "Refunds require approval.", control: "PCI-DSS 10 (Track access)" },
    ],
  },
  {
    key: "gdpr",
    name: "GDPR",
    framework: "Personal data",
    blurb: "Approvals around personal-data export, erasure, and third-party sharing.",
    templates: [
      { policy_id: "gdpr-approve-pii-export", effect: "require_approval", priority: 27, action: "*.export", resource: "pii:*", approvals_required: 1, description: "Exporting personal data requires approval.", control: "GDPR Art. 5 (Integrity)" },
      { policy_id: "gdpr-approve-erasure", effect: "require_approval", priority: 27, action: "user.delete", approvals_required: 1, description: "Erasing a user's data requires approval (right to be forgotten).", control: "GDPR Art. 17 (Erasure)" },
      { policy_id: "gdpr-approve-3p-share", effect: "require_approval", priority: 25, action: "data.share", resource: "external:*", approvals_required: 1, description: "Sharing personal data with third parties requires approval.", control: "GDPR Art. 44 (Transfers)" },
    ],
  },
  {
    key: "iso27001",
    name: "ISO 27001",
    framework: "Information security",
    blurb: "Privileged access and cryptographic-material controls.",
    templates: [
      { policy_id: "iso-approve-privileged", effect: "require_approval", priority: 23, action: "iam.*", approvals_required: 1, description: "Privileged identity/access changes require approval.", control: "ISO 27001 A.9 (Access control)" },
      { policy_id: "iso-approve-crypto", effect: "require_approval", priority: 18, action: "key.*", approvals_required: 1, description: "Key and certificate operations require approval.", control: "ISO 27001 A.10 (Cryptography)" },
      { policy_id: "iso-deny-disable-security", effect: "deny", priority: 8, action: "security.disable", description: "Disabling security controls is never allowed.", control: "ISO 27001 A.12 (Operations security)" },
    ],
  },
  {
    key: "nist-ai",
    name: "NIST AI RMF",
    framework: "AI risk management",
    blurb: "AI-specific limits: model deployment, autonomy escalation, and new tool/connections.",
    templates: [
      { policy_id: "nist-approve-model-deploy", effect: "require_approval", priority: 24, action: "model.deploy", approvals_required: 1, description: "Deploying or updating a model requires approval.", control: "NIST AI RMF GOVERN 1.1" },
      { policy_id: "nist-approve-escalation", effect: "require_approval", priority: 20, action: "agent.escalate*", approvals_required: 1, description: "An agent expanding its own privileges requires approval.", control: "NIST AI RMF MANAGE 2.1" },
      { policy_id: "nist-approve-tool-connect", effect: "require_approval", priority: 26, action: "tool.install", approvals_required: 1, description: "Connecting a new tool or MCP server requires approval.", control: "NIST AI RMF MAP 4.1" },
    ],
  },
];

export function packByKey(key: string): PolicyPack | undefined {
  return POLICY_PACKS.find((p) => p.key === key);
}
