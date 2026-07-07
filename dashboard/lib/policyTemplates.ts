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
  {
    key: "governance",
    name: "Agent guardrail governance",
    framework: "Guardrail integrity",
    recommended: true,
    blurb: "Protects the guardrail itself — no agent can edit its own rules — and backstops everything else with a default-deny catch-all.",
    templates: [
      { policy_id: "governance-deny-policy-edit-policy", effect: "deny", priority: 3, actor: "agent:*", action: "policy.*", description: "An agent can never create, edit, or disable the policies that constrain it.", control: "Guardrail self-protection" },
      { policy_id: "governance-deny-policy-edit-interlock", effect: "deny", priority: 3, actor: "agent:*", action: "interlock.*", description: "An agent can never modify the Interlock guardrail configuration itself.", control: "Guardrail self-protection" },
      { policy_id: "governance-catch-all-deny", effect: "deny", priority: 999, action: "*", resource: "*", description: "Default-deny backstop: anything not explicitly allowed or approved by a higher-precedence rule is blocked. Enabling this pack flips the org's posture to deny-by-default — make sure the allows/approvals you need are already in place.", control: "Default-deny posture" },
    ],
  },
  {
    key: "access-security",
    name: "Access & identity",
    framework: "Access control",
    blurb: "Keeps agents away from permissions, credentials, security settings, impersonation, and the audit trail.",
    templates: [
      { policy_id: "access-security-deny-permission-grant", effect: "deny", priority: 10, action: "permissions.grant", description: "Granting permissions is an access-control change and is off-limits to agents.", control: "Access-control guard" },
      { policy_id: "access-security-deny-role-assign", effect: "deny", priority: 10, action: "role.assign", description: "Assigning roles is an access-control change and is off-limits to agents.", control: "Access-control guard" },
      { policy_id: "access-security-deny-sharing-modify", effect: "deny", priority: 10, action: "sharing.modify", description: "Changing sharing/visibility settings is an access-control change and is off-limits to agents.", control: "Access-control guard" },
      { policy_id: "access-security-deny-credential-ops", effect: "deny", priority: 10, action: "credential.*", description: "Creating, reading, or rotating credentials via an agent is never allowed.", control: "Secrets guard" },
      { policy_id: "access-security-deny-apikey-create", effect: "deny", priority: 10, action: "apikey.create", description: "Minting new API keys via an agent is never allowed.", control: "Secrets guard" },
      { policy_id: "access-security-deny-secret-rotate", effect: "deny", priority: 10, action: "secret.rotate", description: "Rotating secrets via an agent is never allowed.", control: "Secrets guard" },
      { policy_id: "access-security-deny-security-settings", effect: "deny", priority: 10, action: "security.*", description: "Changing security settings via an agent is never allowed.", control: "Security-settings guard" },
      { policy_id: "access-security-deny-mfa-disable", effect: "deny", priority: 10, action: "mfa.disable", description: "Disabling multi-factor authentication via an agent is never allowed.", control: "Security-settings guard" },
      { policy_id: "access-security-deny-sso-configure", effect: "deny", priority: 10, action: "sso.configure", description: "Reconfiguring SSO via an agent is never allowed.", control: "Security-settings guard" },
      { policy_id: "access-security-deny-impersonation", effect: "deny", priority: 10, action: "user.impersonate", description: "An agent impersonating another user is never allowed.", control: "Identity guard" },
      { policy_id: "access-security-deny-disable-audit", effect: "deny", priority: 8, action: "audit.disable", description: "Disabling the audit trail is never allowed.", control: "Audit-integrity guard" },
      { policy_id: "access-security-deny-disable-logging", effect: "deny", priority: 8, action: "logging.disable", description: "Disabling logging is never allowed.", control: "Audit-integrity guard" },
      { policy_id: "access-security-approve-account-create", effect: "require_approval", priority: 24, action: "account.create", approvals_required: 1, description: "Creating a new account requires human approval.", control: "Provisioning control" },
      { policy_id: "access-security-approve-user-create", effect: "require_approval", priority: 24, action: "user.create", approvals_required: 1, description: "Creating a new user requires human approval.", control: "Provisioning control" },
    ],
  },
  {
    key: "data-integrity",
    name: "Database & data integrity",
    framework: "Data safety",
    blurb: "Blocks table-level wipes outright and puts approval on schema changes and restores/rollbacks.",
    templates: [
      { policy_id: "data-integrity-deny-truncate", effect: "deny", priority: 12, action: "db.truncate", description: "Truncating a table via an agent is never allowed.", control: "Destructive-action guard" },
      { policy_id: "data-integrity-approve-schema-migrate", effect: "require_approval", priority: 22, action: "db.migrate", approvals_required: 1, description: "Running a schema migration requires human approval.", control: "Change-management control" },
      { policy_id: "data-integrity-approve-schema-alter", effect: "require_approval", priority: 22, action: "db.alter", approvals_required: 1, description: "Altering a schema requires human approval.", control: "Change-management control" },
      { policy_id: "data-integrity-approve-restore", effect: "require_approval", priority: 22, action: "db.restore", approvals_required: 1, description: "Restoring a database from backup requires human approval.", control: "Data-recovery control" },
      { policy_id: "data-integrity-approve-rollback", effect: "require_approval", priority: 22, action: "db.rollback", approvals_required: 1, description: "Rolling back a database change requires human approval.", control: "Data-recovery control" },
    ],
  },
  {
    key: "payments-plus",
    name: "Payments & financial (extended)",
    framework: "Financial controls",
    blurb: "A hard ceiling on charges, approvals on refunds and payouts, and a lock on bank details and crypto conversion.",
    templates: [
      { policy_id: "payments-plus-deny-payment-ceiling", effect: "deny", priority: 14, action: "payment.charge", conditions: [{ field: "amount", op: "gt", value: 10000 }], description: "Hard ceiling: charges over $10,000 are never auto-run by an agent, regardless of any approval tier below.", control: "Money-movement ceiling" },
      { policy_id: "payments-plus-approve-refund", effect: "require_approval", priority: 26, action: "refund.issue", approvals_required: 1, conditions: [{ field: "amount", op: "gt", value: 100 }], description: "Refunds over $100 require human approval.", control: "Money-movement control" },
      { policy_id: "payments-plus-approve-payout", effect: "require_approval", priority: 26, action: "payout.send", approvals_required: 1, description: "Sending a payout requires human approval.", control: "Money-movement control" },
      { policy_id: "payments-plus-approve-transfer", effect: "require_approval", priority: 26, action: "transfer.create", approvals_required: 1, description: "Creating a transfer requires human approval.", control: "Money-movement control" },
      { policy_id: "payments-plus-deny-bank-details-change", effect: "deny", priority: 10, action: "payment.update_bank_details", description: "Changing payout bank details via an agent is never allowed.", control: "Payout-fraud guard" },
      { policy_id: "payments-plus-deny-crypto", effect: "deny", priority: 12, action: "crypto.*", description: "Cryptocurrency operations via an agent are never allowed.", control: "Money-movement guard" },
      { policy_id: "payments-plus-deny-payment-convert", effect: "deny", priority: 12, action: "payment.convert", description: "Converting funds between currencies/instruments via an agent is never allowed.", control: "Money-movement guard" },
    ],
  },
  {
    key: "infra",
    name: "Infrastructure & deploys",
    framework: "Operational safety",
    blurb: "Approval on capacity-affecting and deploy operations, and a hard deny on DNS changes.",
    templates: [
      { policy_id: "infra-approve-server-terminate", effect: "require_approval", priority: 24, action: "server.terminate", approvals_required: 1, description: "Terminating a server requires human approval.", control: "Operational-safety control" },
      { policy_id: "infra-approve-scale-down", effect: "require_approval", priority: 24, action: "instance.scale_down", approvals_required: 1, description: "Scaling down instances requires human approval.", control: "Operational-safety control" },
      { policy_id: "infra-approve-cluster-ops", effect: "require_approval", priority: 24, action: "cluster.*", approvals_required: 1, description: "Cluster operations require human approval.", control: "Operational-safety control" },
      { policy_id: "infra-deny-dns", effect: "deny", priority: 12, action: "dns.*", description: "DNS changes via an agent are never allowed — a bad record can cause a full outage.", control: "Outage-prevention guard" },
      { policy_id: "infra-approve-deploy", effect: "require_approval", priority: 24, action: "deploy.*", approvals_required: 1, description: "Deploying requires human approval. This approves ALL deploys for now; scoping to production only (env eq prod) needs an enrichment field the tool call doesn't currently carry.", control: "Change-management control" },
    ],
  },
  {
    key: "trust-tiers",
    name: "Actor trust tiers",
    framework: "Actor-based control",
    blurb: "Reduces approval fatigue for a proven internal agent on reads, sandboxes newly deployed agents, and backstops writes from unrecognized actors.",
    templates: [
      { policy_id: "trust-tiers-allow-trusted-agent-reads", effect: "allow", priority: 34, actor: "agent:internal-ops", action: "*.read", description: "Reduces approval fatigue for the proven internal-ops agent on read-only actions. Reads only, and this priority is below every deny above, so it never overrides a hard deny.", control: "Trusted-actor allowlist" },
      { policy_id: "trust-tiers-approve-probation-agent", effect: "require_approval", priority: 28, actor: "agent:probation-*", action: "*", approvals_required: 1, description: "Newly deployed agents (actor names prefixed agent:probation-) require approval on every action during a probation period.", control: "New-actor probation" },
      { policy_id: "trust-tiers-deny-unknown-delete", effect: "deny", priority: 35, actor: "*", action: "*.delete", description: "Default-deny-on-writes backstop for delete actions: sits just above the catch-all so any actor without an explicit allow/approval at a lower priority number is blocked. Narrow the actor glob to exempt specific known agents.", control: "Unknown-actor write backstop" },
      { policy_id: "trust-tiers-deny-unknown-write", effect: "deny", priority: 35, actor: "*", action: "*.write", description: "Default-deny-on-writes backstop for write actions: sits just above the catch-all so any actor without an explicit allow/approval at a lower priority number is blocked. Narrow the actor glob to exempt specific known agents.", control: "Unknown-actor write backstop" },
      { policy_id: "trust-tiers-deny-unknown-create", effect: "deny", priority: 35, actor: "*", action: "*.create", description: "Default-deny-on-writes backstop for create actions: sits just above the catch-all so any actor without an explicit allow/approval at a lower priority number is blocked. Narrow the actor glob to exempt specific known agents.", control: "Unknown-actor write backstop" },
    ],
  },
  {
    key: "velocity",
    name: "Velocity & context",
    framework: "Runaway-agent & context controls",
    blurb: "Catches the things a single-action policy can't see: mass or external email blasts, deletes with no filter, deploys during a freeze or off-hours, spend that adds up over a day, and an actor firing off an unusually high rate of actions.",
    templates: [
      { policy_id: "velocity-deny-freeze-window", effect: "deny", priority: 11, action: "deploy.*", conditions: [{ field: "freeze", op: "eq", value: true }], description: "Deploys are blocked during an active change freeze window.", control: "Change-freeze guard" },
      { policy_id: "velocity-deny-freeze-migrate", effect: "deny", priority: 11, action: "db.migrate", conditions: [{ field: "freeze", op: "eq", value: true }], description: "Database migrations are blocked during an active change freeze window.", control: "Change-freeze guard" },
      { policy_id: "velocity-deny-delete-no-filter", effect: "deny", priority: 12, action: "db.delete", conditions: [{ field: "has_where", op: "eq", value: false }], description: "Blocks a delete that has no WHERE filter, which would wipe an entire table's rows.", control: "Destructive-action guard" },
      { policy_id: "velocity-approve-prod-deploy", effect: "require_approval", priority: 24, action: "deploy.*", approvals_required: 1, conditions: [{ field: "env", op: "eq", value: "prod" }], description: "Deploys to the production environment require human approval.", control: "Change-management control" },
      { policy_id: "velocity-approve-external-email", effect: "require_approval", priority: 26, action: "email.send", approvals_required: 1, conditions: [{ field: "recipient_domain", op: "not_in", value: ["yourcompany.com"] }], description: "Emails going to a domain outside the company require approval before sending. Admins: edit the allowed-domain list for your org.", control: "Data-egress control" },
      { policy_id: "velocity-approve-mass-email", effect: "require_approval", priority: 26, action: "email.send", approvals_required: 1, conditions: [{ field: "recipient_count", op: "gt", value: 25 }], description: "Emails going to more than 25 recipients at once require approval, to catch accidental or runaway mass sends.", control: "Mass-action guard" },
      { policy_id: "velocity-approve-daily-spend-cap", effect: "require_approval", priority: 26, action: "payment.*", approvals_required: 1, conditions: [{ field: "daily_total", op: "gt", value: 5000 }], description: "Once the organization's payment activity for the day totals more than $5,000, further payment actions require approval.", control: "Money-movement control" },
      { policy_id: "velocity-approve-off-hours", effect: "require_approval", priority: 27, action: "deploy.*", approvals_required: 1, conditions: [{ field: "off_hours", op: "eq", value: true }], description: "Deploys initiated outside normal business hours require human approval.", control: "Off-hours control" },
      { policy_id: "velocity-approve-high-frequency", effect: "require_approval", priority: 28, action: "*", approvals_required: 1, conditions: [{ field: "actor_action_count_1h", op: "gt", value: 100 }], description: "If an actor has taken more than 100 actions in the last hour, further actions require approval — catches a runaway or looping agent.", control: "Runaway-agent guard" },
    ],
  },
];

export function packByKey(key: string): PolicyPack | undefined {
  return POLICY_PACKS.find((p) => p.key === key);
}
