// Curated catalog of tools an admin can connect through the StileAI gateway.
// Each entry maps to a real, verified MCP server (see .superpowers/sdd/
// mcp-catalog-research.md). A tile pre-fills the technical connection; the admin
// only supplies the credential(s) they ALREADY use for that tool. Credentials are
// stored encrypted and handed to the tool at launch (stdio env vars) or as a
// bearer token (http) — StileAI never logs in itself; it reuses the existing key.

export type CatalogCredential = {
  key: string; // the env var (stdio) or "bearer" (http)
  label: string; // human label shown in the form
  where: string; // "where to find it" hint
  optional?: boolean;
};

export type CatalogTool = {
  id: string;
  name: string;
  category: string;
  transport: "stdio" | "http";
  // stdio: the launch command as an array; http: the endpoint URL.
  target: string[] | string;
  credentials: CatalogCredential[];
  blurb: string;
  official: boolean;
  // OAuth tools have no pasteable key — the admin reuses their existing connector.
  reuseExisting?: boolean;
  needsDocker?: boolean;
};

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "messaging", label: "Messaging" },
  { key: "email-calendar-files", label: "Email, Calendar & Files" },
  { key: "databases", label: "Databases" },
  { key: "dev-tools", label: "Developer Tools" },
  { key: "payments-commerce", label: "Payments & Commerce" },
  { key: "docs-productivity", label: "Docs & Productivity" },
  { key: "crm", label: "CRM" },
  { key: "infra-other", label: "Automation & Other" },
];

export const CATALOG: CatalogTool[] = [
  // — Messaging —
  {
    id: "slack", name: "Slack", category: "messaging", transport: "stdio",
    target: ["npx", "-y", "@zencoderai/slack-mcp-server"],
    credentials: [
      { key: "SLACK_BOT_TOKEN", label: "Slack Bot Token", where: "api.slack.com/apps → your app → OAuth & Permissions → Bot User OAuth Token (starts with xoxb-)." },
      { key: "SLACK_TEAM_ID", label: "Slack Team ID", where: "Your workspace ID, visible in the workspace URL/settings." },
    ],
    blurb: "Post messages and read channels in your Slack workspace.", official: false,
  },
  {
    id: "discord", name: "Discord", category: "messaging", transport: "stdio",
    target: ["npx", "-y", "mcp-discord"],
    credentials: [
      { key: "DISCORD_TOKEN", label: "Discord Bot Token", where: "discord.com/developers/applications → your app → Bot → Token." },
    ],
    blurb: "Send and read messages in your Discord server.", official: false,
  },
  // — Databases —
  {
    id: "postgres", name: "PostgreSQL", category: "databases", transport: "stdio",
    target: ["uvx", "postgres-mcp", "--access-mode=unrestricted"],
    credentials: [
      { key: "DATABASE_URI", label: "Database connection string", where: "e.g. postgresql://user:pass@host:5432/dbname — from your database provider." },
    ],
    blurb: "Query your Postgres database — and guard the risky writes/deletes.", official: false,
  },
  {
    id: "redis", name: "Redis", category: "databases", transport: "stdio",
    target: ["uvx", "--from", "redis-mcp-server@latest", "redis-mcp-server"],
    credentials: [
      { key: "REDIS_URL", label: "Redis connection URL", where: "e.g. redis://user:pass@host:6379/0 — from your Redis provider." },
    ],
    blurb: "Read and write keys in your Redis store.", official: true,
  },
  // — Developer Tools —
  {
    id: "github", name: "GitHub", category: "dev-tools", transport: "stdio",
    target: ["docker", "run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
    credentials: [
      { key: "GITHUB_PERSONAL_ACCESS_TOKEN", label: "GitHub Personal Access Token", where: "github.com/settings/tokens — create a token with the scopes you need (repo, issues, …)." },
    ],
    blurb: "Manage repos, issues, and pull requests on GitHub.", official: true, needsDocker: true,
  },
  {
    id: "sentry", name: "Sentry", category: "dev-tools", transport: "stdio",
    target: ["npx", "-y", "@sentry/mcp-server"],
    credentials: [
      { key: "SENTRY_ACCESS_TOKEN", label: "Sentry Access Token", where: "Sentry → Settings → Auth Tokens (org-level)." },
    ],
    blurb: "Read and triage errors and issues in Sentry.", official: true,
  },
  {
    id: "fetch", name: "Web Fetch", category: "dev-tools", transport: "stdio",
    target: ["uvx", "mcp-server-fetch"], credentials: [],
    blurb: "Fetch and read any public web page. No key needed — great for a first test.", official: true,
  },
  {
    id: "playwright", name: "Browser (Playwright)", category: "dev-tools", transport: "stdio",
    target: ["npx", "@playwright/mcp@latest"], credentials: [],
    blurb: "Drive a real browser — navigate pages, fill forms. No key needed.", official: true,
  },
  // — Payments & Commerce —
  {
    id: "stripe", name: "Stripe", category: "payments-commerce", transport: "stdio",
    target: ["npx", "-y", "@stripe/mcp", "--tools=all"],
    credentials: [
      { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", where: "dashboard.stripe.com/apikeys — use a restricted key scoped to what you need." },
    ],
    blurb: "Charges, refunds, and payouts — exactly what your approval rules guard.", official: true,
  },
  {
    id: "paypal", name: "PayPal", category: "payments-commerce", transport: "stdio",
    target: ["npx", "-y", "@paypal/mcp", "--tools=all"],
    credentials: [
      { key: "PAYPAL_ACCESS_TOKEN", label: "PayPal Access Token", where: "Generate from developer.paypal.com (OAuth2 client-credentials). Note: expires periodically and must be refreshed." },
      { key: "PAYPAL_ENVIRONMENT", label: "Environment", where: "SANDBOX or PRODUCTION." },
    ],
    blurb: "PayPal orders, invoices, and payouts.", official: true,
  },
  // — Docs & Productivity —
  {
    id: "notion", name: "Notion", category: "docs-productivity", transport: "stdio",
    target: ["npx", "-y", "@notionhq/notion-mcp-server"],
    credentials: [
      { key: "NOTION_TOKEN", label: "Notion Integration Token", where: "notion.so/my-integrations — create an internal integration and share your pages with it." },
    ],
    blurb: "Read and update Notion pages and databases.", official: true,
  },
  {
    id: "asana", name: "Asana", category: "docs-productivity", transport: "stdio",
    target: ["npx", "-y", "@roychri/mcp-server-asana"],
    credentials: [
      { key: "ASANA_ACCESS_TOKEN", label: "Asana Personal Access Token", where: "Asana → My Settings → Apps → Developer Apps → Personal Access Token." },
    ],
    blurb: "Manage tasks and projects in Asana.", official: false,
  },
  {
    id: "atlassian", name: "Jira & Confluence", category: "docs-productivity", transport: "stdio",
    target: ["uvx", "mcp-atlassian"],
    credentials: [
      { key: "JIRA_URL", label: "Jira URL", where: "e.g. https://your-company.atlassian.net" },
      { key: "JIRA_USERNAME", label: "Atlassian email", where: "The account email of your integration user." },
      { key: "JIRA_API_TOKEN", label: "Atlassian API Token", where: "id.atlassian.com/manage-profile/security/api-tokens" },
    ],
    blurb: "Work with Jira issues and Confluence pages.", official: false,
  },
  {
    id: "brave-search", name: "Brave Search", category: "docs-productivity", transport: "stdio",
    target: ["npx", "-y", "@brave/brave-search-mcp-server"],
    credentials: [
      { key: "BRAVE_API_KEY", label: "Brave Search API Key", where: "brave.com/search/api — sign up and copy your key." },
    ],
    blurb: "Web search via the Brave Search API.", official: true,
  },
  // — CRM —
  {
    id: "hubspot", name: "HubSpot", category: "crm", transport: "stdio",
    target: ["npx", "-y", "@hubspot/mcp-server"],
    credentials: [
      { key: "PRIVATE_APP_ACCESS_TOKEN", label: "Private App Access Token", where: "HubSpot → Settings → Integrations → Private Apps → create one with CRM scopes." },
    ],
    blurb: "Read and update contacts, deals, and companies in HubSpot.", official: true,
  },
  {
    id: "airtable", name: "Airtable", category: "crm", transport: "stdio",
    target: ["npx", "-y", "airtable-mcp-server"],
    credentials: [
      { key: "AIRTABLE_API_KEY", label: "Airtable Personal Access Token", where: "airtable.com/create/tokens — create a token (starts with pat…) with base access." },
    ],
    blurb: "Read and write records in your Airtable bases.", official: false,
  },
  // — Automation & Other —
  {
    id: "zapier", name: "Zapier", category: "infra-other", transport: "http",
    target: "https://mcp.zapier.com/api/v1/connect",
    credentials: [
      { key: "bearer", label: "Zapier MCP Connection Token", where: "In Zapier MCP → your server → Connect tab → Generate token (shown once)." },
    ],
    blurb: "Reach thousands of apps through your Zapier MCP server.", official: true,
  },
  {
    id: "cloudflare", name: "Cloudflare", category: "infra-other", transport: "http",
    target: "https://mcp.cloudflare.com/mcp",
    credentials: [
      { key: "bearer", label: "Cloudflare API Token", where: "Cloudflare Dashboard → My Profile → API Tokens → create a scoped token." },
    ],
    blurb: "Manage Cloudflare — DNS, Workers, and more.", official: true,
  },
  // — CRM (more) —
  {
    id: "salesforce", name: "Salesforce", category: "crm", transport: "stdio",
    target: ["npx", "-y", "mcp-server-salesforce"],
    credentials: [
      { key: "SALESFORCE_USERNAME", label: "Salesforce Username", where: "The login username of your integration user." },
      { key: "SALESFORCE_PASSWORD", label: "Salesforce Password", where: "The password for that user." },
      { key: "SALESFORCE_TOKEN", label: "Security Token", where: "Salesforce → Settings → My Personal Information → Reset My Security Token (emailed to you)." },
      { key: "SALESFORCE_INSTANCE_URL", label: "Instance URL", where: "e.g. https://your-company.my.salesforce.com" },
    ],
    blurb: "Read and update leads, contacts, and opportunities in Salesforce.", official: false,
  },
  // — Developer Tools (more) —
  {
    id: "gitlab", name: "GitLab", category: "dev-tools", transport: "stdio",
    target: ["npx", "-y", "@zereight/mcp-gitlab"],
    credentials: [
      { key: "GITLAB_PERSONAL_ACCESS_TOKEN", label: "GitLab Personal Access Token", where: "GitLab → User Settings → Access Tokens." },
    ],
    blurb: "Manage GitLab projects, issues, and merge requests.", official: false,
  },
  // — Docs & Productivity (more) —
  {
    id: "google-maps", name: "Google Maps", category: "docs-productivity", transport: "stdio",
    target: ["npx", "-y", "@cablate/mcp-google-map"],
    credentials: [
      { key: "GOOGLE_MAPS_API_KEY", label: "Google Maps API Key", where: "Google Cloud Console → APIs & Services → Credentials → create an API key (enable Places/Directions/Geocoding)." },
    ],
    blurb: "Places, directions, and geocoding via Google Maps.", official: false,
  },

  // — Reuse-existing-connection (OAuth): no pasteable key; point StileAI at the
  //   connector you already set up. Shown as advanced. —
  {
    id: "gmail", name: "Gmail", category: "email-calendar-files", transport: "stdio",
    target: ["npx", "-y", "google_workspace_mcp"], credentials: [], reuseExisting: true,
    blurb: "Send and read email. Google requires a one-time sign-in, so connect the Google connector you already use.", official: true,
  },
  {
    id: "google-calendar", name: "Google Calendar", category: "email-calendar-files", transport: "stdio",
    target: ["npx", "-y", "google_workspace_mcp"], credentials: [], reuseExisting: true,
    blurb: "Manage calendar events. Uses your existing Google sign-in.", official: false,
  },
  {
    id: "google-drive", name: "Google Drive", category: "email-calendar-files", transport: "stdio",
    target: ["npx", "-y", "gdrive-mcp-server"], credentials: [], reuseExisting: true,
    blurb: "Read and manage Drive files. Uses your existing Google sign-in.", official: false,
  },
  {
    id: "shopify", name: "Shopify", category: "payments-commerce", transport: "http",
    target: "", credentials: [], reuseExisting: true,
    blurb: "Manage your store. New Shopify apps use sign-in — connect your existing Shopify app.", official: true,
  },
  {
    id: "linear", name: "Linear", category: "docs-productivity", transport: "http",
    target: "https://mcp.linear.app/mcp", credentials: [], reuseExisting: true,
    blurb: "Track issues and projects. Linear uses sign-in — connect your existing Linear setup.", official: true,
  },
];

export function catalogTool(id: string): CatalogTool | undefined {
  return CATALOG.find((t) => t.id === id);
}
