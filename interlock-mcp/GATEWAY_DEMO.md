# StileAI Gateway Demo Runbook

One-page guide to demo the enforced gateway. An AI agent connects to a single URL and uses tools normally — every call is checked (allowed, blocked, or held for approval) and logged. The user never types "StileAI."

---

## What You'll Show

The demo proves:
- An AI agent connects to **one gateway URL** and sees tools like `sample__read_data`, `sample__send_email`, `sample__charge_card`, `sample__delete_records`.
- Every tool call is **automatically checked** against policies before the real tool runs.
- Calls can be **allowed** (run immediately), **blocked** (fail silently), or **held for approval** (paused in a dashboard, approved/denied manually).
- **Every interaction is logged** in the Audit page — no call is hidden.

---

## Setup (Run Once)

### 1. Create the Connected Tools Table

In [Supabase](https://supabase.com):
1. Go to the **SQL Editor**.
2. Open the file `supabase/migration_connected_tools.sql` from this repo, copy its entire contents, paste into the SQL Editor, and click **Run**. (This creates the `connected_tools` table with row-level security, admin-only access, and an encrypted-credentials constraint — do not hand-write your own version; the columns must match exactly, e.g. `target` is `text` holding a JSON string.)
3. You should see "Success. No rows returned."

### 2. Add the Sample Server as a Connected Tool

In Supabase **Table Editor** (or via INSERT):
- Go to `connected_tools` table.
- Click **Insert** and add one row:
  ```
  name = sample
  transport = stdio
  target = ["python", "-m", "sample_tools.server"]
  enabled = true
  org_id = <your org UUID>
  ```
  (Your org UUID is shown in the StileAI dashboard under **Org Settings**.)

### 3. Add Three Policies

In the [StileAI Dashboard](https://stileai.vercel.app):
1. Go to **Policies**.
2. Add three rules. Each rule's **Action** is the tool's name (StileAI matches the policy `action` against the tool being called); set the **Effect** accordingly:
   - **Action** `read_data` → Effect **Allow**
   - **Action** `delete_records` → Effect **Deny**
   - **Action** `charge_card` → Effect **Require approval**
3. (Recommended) Set your org's **default effect** to **Deny** so any tool call that matches no rule is blocked rather than allowed — a default-deny posture for the agent guardrail.

### 4. Start the Gateway Server

From the `interlock-mcp/` directory:

```bash
# Set environment variables (copy-paste this block)
export INTERLOCK_MODE=gateway
export INTERLOCK_STORE=api
export INTERLOCK_TRANSPORT=http
export INTERLOCK_DASHBOARD_URL=https://stileai.vercel.app
export INTERLOCK_API_KEY=<your org API key>
export INTERLOCK_MCP_AUTH_TOKEN=my_secret_demo_token
export PORT=8791

# Start the server
python -m interlock.server
```

You'll see: `Gateway listening on http://localhost:8791`

The connect URL is: `http://localhost:8791/gw?key=my_secret_demo_token`

---

## Connect Claude (or Your AI Client)

1. Open [Claude](https://claude.ai), [Cursor](https://cursor.sh), or your AI client.
2. Go to **Settings** → **Connectors** (or **MCP Servers**).
3. Add a new MCP server:
   - **Name:** `StileAI Gateway`
   - **URL:** `http://localhost:8791/gw?key=my_secret_demo_token`
   - Leave headers and auth blank.
4. Click **Connect**.

The agent now sees four tools: `sample__read_data`, `sample__send_email`, `sample__charge_card`, `sample__delete_records`.

---

## Run the Demo

Say these to the agent — never mention "StileAI" or "policies":

### Demo Line 1: Allowed Call
**You say:**  
> "Read the latest data."

**What happens:**  
✅ The agent calls `sample__read_data`. The policy allows it. The tool runs. You see the data.

---

### Demo Line 2: Approval Flow
**You say:**  
> "Charge customer c1 $4,200."

**What happens:**  
🕐 The agent attempts `sample__charge_card`. The policy flags it for approval. The agent pauses and tells you:  
> *"I need your approval to charge the customer. The charge is on hold."*

1. Go to the StileAI **Dashboard** → **Approvals** tab.
2. You see the pending charge with full details (customer, amount, timestamp).
3. Click **Approve**.
4. The agent resumes, completes the charge, and tells you it's done.

*(Alternatively: click **Deny** — the agent is told the charge failed and moves on.)*

---

### Demo Line 3: Blocked Call
**You say:**  
> "Delete the customers table."

**What happens:**  
🚫 The agent attempts `sample__delete_records`. The policy blocks it. The tool never runs. The agent reports:  
> *"I'm unable to delete the customers table."*

---

### Demo Line 4: Show the Audit Log
1. Go to the StileAI **Dashboard** → **Audit** tab.
2. You see every call:
   - `read_data` → ✅ **Allowed**
   - `charge_card` → ⏳ **Held** → ✅ **Approved**
   - `delete_records` → 🚫 **Denied**
3. Click any row to see full details (timestamp, agent, policy rule, args, result).

---

## Key Points

- **One URL, no manual auth:** The agent only knows the gateway URL and secret token. No OAuth, no header juggling.
- **Policies are invisible:** The agent calls tools normally; policies enforce silently.
- **Approval is human-in-the-loop:** High-risk calls wait in the dashboard until you say yes or no.
- **Self-hosted keeps data safe:** The gateway runs on your infrastructure. Tool data never leaves your network.
- **Timeout is fail-safe:** If an approval is held longer than `INTERLOCK_HOLD_TIMEOUT` seconds (default: 300), it auto-denies and the agent is notified.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Check `PORT=8791` is not in use; restart gateway with `python -m interlock.server` |
| Agent doesn't see tools | Verify `connected_tools` row exists and `enabled = true` in Supabase |
| Policy doesn't trigger | Confirm the rule's **Action** exactly matches the tool name in Dashboard → Policies (e.g. `charge_card`) |
| Approval never appears | Check Dashboard → Approvals tab; verify `INTERLOCK_DASHBOARD_URL` is correct |

---

**Ready to demo?** Grab a fresh terminal, set env vars, run `python -m interlock.server`, connect the agent, and say "Read the latest data."
