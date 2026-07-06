# Interlock — the checkpoint for agentic AI (MCP server)

Interlock sits between an AI agent and the systems it can act on. Before an agent
performs a sensitive action, it asks Interlock for permission. Interlock evaluates
the action against **your policy file** and returns one of three decisions —
**allow**, **deny**, or **require_approval** — and writes **every decision to an
audit trail**. Decisions that need a human are resolved by an approver.

This is a working v1 prototype of that concept, built as a Model Context Protocol
(MCP) server so it plugs into Claude Desktop, Claude Code, or anything that speaks
MCP.

## What's in the box

| Tool | Purpose |
|------|---------|
| `request_action` | The checkpoint. Ask "can I do X?" before doing it. Returns allow / deny / require_approval + a `decision_id`. |
| `submit_approval` | Human-in-the-loop. Approve or reject a pending decision. |
| `check_status` | Look up the status of a decision awaiting approval. |
| `list_pending` | List everything currently awaiting a human. |
| `get_audit_log` | Read the audit trail (filter by actor / effect). |
| `list_policies` | Show the active rules, in evaluation order. |
| `reload_policies` | Re-read `policies.yaml` without restarting. |
| `guarded_send_email`, `guarded_delete_record` | Example tools that *self-gate*: they only run the real side effect if policy allows. |

Two integration patterns are demonstrated:

1. **Checkpoint-as-a-service** — the agent calls `request_action` first and only
   proceeds on `allow`. Interlock decides and records; it does not perform the action.
2. **Guarded tools** — a tool wraps a real side effect and refuses to execute
   unless the same engine allows it. This is how you retrofit governance onto
   tools you already expose.

## How policies work

Rules live in [`policies.yaml`](./policies.yaml). Each action is described by
`actor`, `action`, `resource`, and free-form `params`. Rules are evaluated in
ascending `priority` (lower number checked first); the **first match wins**. If
nothing matches, `default_effect` applies (shipped as `require_approval` — a
fail-safe default). Matching uses shell-style globs (`db.*`, `customer:*`);
parameter checks are explicit, safe comparisons (no `eval`):

```yaml
- id: approve-large-payments
  effect: require_approval
  priority: 41
  action: "payment.charge"
  conditions:
    - { field: amount, op: gt, value: 100 }   # charges over $100 need a human
  description: "Charges over $100 require one human approval."
```

Sensitive param values (passwords, tokens, card numbers, SSNs, …) are
automatically **redacted** before anything is written to the audit log.

## Quick start (local)

```bash
cd interlock-mcp
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python selftest.py                    # sanity check the engine (no MCP client needed)
python -m interlock.server            # run the server over stdio
```

### Inspect it interactively

```bash
pip install "mcp[cli]"
mcp dev interlock/server.py            # opens the MCP Inspector in your browser
```

### Wire it into Claude Desktop

Copy the `interlock` block from
[`claude_desktop_config.example.json`](./claude_desktop_config.example.json) into
your Claude Desktop config (use **absolute paths**), then restart Claude Desktop:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Then try, in Claude: *"Using interlock, request_action for actor `agent:bot`,
action `payment.charge`, resource `customer:1`, params `{ "amount": 5000 }`."*
You'll get a `require_approval` back with a `decision_id`; approve it with
`submit_approval`.

## Dashboard mode (admin controls policies from your dashboard)

Interlock has a pluggable source of truth, chosen by `INTERLOCK_STORE`:

- `file` — local `policies.yaml` + local audit log. Great for dev / offline.
- `api` — **your dashboard's HTTP API is the source of truth.** Admins edit
  policies in the dashboard; the MCP pulls them (and pushes audit entries +
  pending approvals back). No file editing, no restarts.

In `api` mode the engine and tools are unchanged — only *where policies come from
and where audit data goes* differs. Point the MCP at your dashboard:

```bash
export INTERLOCK_STORE=api
export INTERLOCK_DASHBOARD_URL=https://your-dashboard.example.com
export INTERLOCK_API_KEY=your-key          # sent as: Authorization: Bearer <key>
INTERLOCK_TRANSPORT=http python -m interlock.server
```

Your dashboard needs to expose a small set of endpoints (policies, audit,
approvals). The full contract — request/response shapes, auth, and the
version-polling behaviour — is in **[`DASHBOARD_API.md`](./DASHBOARD_API.md)**.
All endpoint paths are configurable (see [`.env.example`](./.env.example)), so if
your dashboard's routes differ you map them with env vars, no code changes.

Key guarantees in this mode: admin edits take effect within `INTERLOCK_POLL_INTERVAL`
seconds (the MCP checks a cheap version endpoint and only refetches on change);
sensitive params are redacted before being sent to the dashboard; and if the
dashboard is unreachable the MCP serves the last-known-good policies and **never
falls open to allow** (unavailable default is `deny`).

You can verify the whole round-trip locally without a real dashboard:

```bash
python test_api_store.py   # spins up a mock dashboard and exercises the api store
```

## Hosting it in the cloud

The action logic never changes — only the transport and deployment do. Instead of
stdio, run the streamable-HTTP transport:

```bash
INTERLOCK_TRANSPORT=http python -m interlock.server
# serves MCP at http://0.0.0.0:8000/mcp
```

Deploy that anywhere that runs a Python process and exposes a port:

- **Railway / Render / Fly.io** — point them at this repo; start command
  `INTERLOCK_TRANSPORT=http python -m interlock.server`. Easiest path.
- **A VPS (EC2, DigitalOcean, etc.)** — run under systemd or Docker behind a
  reverse proxy (nginx/Caddy) with TLS.
- **Docker** — `pip install -r requirements.txt` then the http start command;
  expose port 8000.

Before exposing it publicly, add: **authentication** (the SDK supports OAuth/JWT
bearer tokens — see the MCP docs), TLS, and a real datastore for the audit log
and pending decisions (see below). Then connect to it as a remote MCP server by
its URL.

## Configuration (environment variables)

| Variable | Default | Meaning |
|----------|---------|---------|
| `INTERLOCK_STORE` | `file` | `file` or `api` (dashboard). |
| `INTERLOCK_TRANSPORT` | `stdio` | `stdio` for local, `http` for cloud. |
| `INTERLOCK_POLICIES` | `./policies.yaml` | File store: path to the policy file. |
| `INTERLOCK_AUDIT_LOG` | `./data/audit.log` | File store: path to the JSONL audit trail. |
| `INTERLOCK_DASHBOARD_URL` | — | Api store: base URL of your dashboard. |
| `INTERLOCK_API_KEY` | — | Api store: key sent on every request. |
| `INTERLOCK_AUTH_HEADER` / `INTERLOCK_AUTH_SCHEME` | `Authorization` / `Bearer` | How the key is sent. |
| `INTERLOCK_POLL_INTERVAL` | `30` | Seconds between policy version checks. |
| `INTERLOCK_UNAVAILABLE_EFFECT` | `deny` | Effect when the dashboard is unreachable (never set to `allow`). |
| `INTERLOCK_EP_*` | see `.env.example` | Override endpoint paths to match your dashboard. |

See [`.env.example`](./.env.example) for the complete list.

## Project layout

```
interlock-mcp/
├── interlock/
│   ├── engine.py     # policy models + evaluation (glob match, safe conditions)
│   ├── audit.py      # redaction + local JSONL log + pending-approval store
│   ├── config.py     # all settings, read from environment variables
│   ├── stores.py     # pluggable source of truth: file store + dashboard api store
│   └── server.py     # MCP server: tools, PolicyProvider (refresh/fail-safe), entrypoint
├── policies.yaml     # rules for the FILE store (dev)
├── selftest.py       # engine self-test (file store)
├── test_api_store.py # api store round-trip against a mock dashboard
├── DASHBOARD_API.md  # the contract your dashboard must expose (api store)
├── BUILD_BRIEF.md    # handoff brief (background/spec)
├── .env.example      # config template for dashboard mode
├── requirements.txt
├── pyproject.toml
└── claude_desktop_config.example.json
```

## Turning this into production

This prototype keeps pending approvals **in memory** and the audit log in a
**local file** — fine for a single local process, not for a hosted service.
Natural next steps:

- Back the audit log and pending decisions with a database (Postgres, SQLite,
  DynamoDB) so state survives restarts and scales across instances.
- Add authentication so only trusted callers can request actions or approve them.
- Add notifications (email/Slack) when something enters the approval queue.
- Extend the engine with rate limits, time-of-day rules, or per-actor budgets.
- Proxy other MCP servers so their tools automatically pass through the checkpoint
  (standalone FastMCP's proxy feature is a good fit here).

---

Built on the official MCP Python SDK (`mcp`, v1.x). The policy engine has no
external dependencies beyond PyYAML, so it's easy to reuse outside MCP too.
