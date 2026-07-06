"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {caption && <div className="font-mono text-[10px] text-ink4 mb-1.5">{caption}</div>}
      <div className="relative">
        <pre className="font-mono text-[11px] leading-relaxed text-railink bg-rail rounded-xl p-3.5 pr-16 overflow-x-auto whitespace-pre">{code}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 font-mono text-[10px] text-railink bg-railhov hover:bg-white/10 rounded-md px-2 py-1"
        >
          <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, where, children, code }: { n: number; title: string; where: string; children: React.ReactNode; code?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-6">
      <div className="flex gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-bluedim text-blue font-sans font-bold text-[13px] flex items-center justify-center">{n}</span>
        <div>
          <div className="font-sans font-semibold text-[13.5px] text-ink">{title}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-blue mt-0.5">{where}</div>
          <p className="font-mono text-[11.5px] text-ink2 leading-relaxed mt-1.5">{children}</p>
        </div>
      </div>
      <div className="lg:pt-0 pl-10 lg:pl-0">{code}</div>
    </li>
  );
}

export function ConnectSection({ origin }: { origin: string }) {
  const env = `# HTTP mode + point it at StileAI
INTERLOCK_STORE=api
INTERLOCK_TRANSPORT=http
INTERLOCK_DASHBOARD_URL=${origin}
INTERLOCK_API_KEY=<key from the API keys page>
INTERLOCK_MCP_AUTH_TOKEN=<a long random secret>`;

  const run = `pip install -r requirements.txt
python -m interlock.server   # serves the checkpoint at /mcp`;

  const mcpConfig = `{
  "mcpServers": {
    "stileai": {
      "url": "https://your-checkpoint-host/mcp",
      "headers": {
        "Authorization": "Bearer <INTERLOCK_MCP_AUTH_TOKEN>"
      }
    }
  }
}`;

  const usage = `# Ask BEFORE doing anything sensitive
decision = request_action(
    actor="agent:support-bot",
    action="payment.charge",
    resource="customer:1234",
    params={"amount": 5000},
)

if decision["effect"] == "allow":
    charge(...)                         # proceed
elif decision["effect"] == "deny":
    raise Blocked(decision["reason"])   # never happens
else:                                   # "require_approval"
    wait_for_human(decision["decision_id"])  # poll check_status`;

  return (
    <section className="bg-card border border-line rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-blue"><Icon name="plug" size={18} /></span>
        <h2 className="font-sans font-bold text-[16px] text-ink tracking-[-0.01em]">Connect your checkpoint</h2>
      </div>
      <p className="font-mono text-[12px] text-ink3 mb-6">
        StileAI runs as a small server (the checkpoint) that your agents call before acting. Here&apos;s how to wire it up.
      </p>

      <ol className="flex flex-col gap-7">
        <Step
          n={1}
          title="Run the checkpoint"
          where="on your infrastructure or a host (Render, Railway, Fly)"
          code={
            <div className="flex flex-col gap-3">
              <CodeBlock caption="start it in HTTP mode" code={run} />
              <CodeBlock caption="configure it — add to a .env file beside the server, or your host's Environment settings" code={env} />
            </div>
          }
        >
          The checkpoint pulls your policies from this dashboard and pushes its audit trail back — automatically, no
          restarts when you edit rules. <Link href="/keys" className="text-blue hover:underline">Generate the API key →</Link>
        </Step>

        <Step
          n={2}
          title="Point your agent at it"
          where="in your agent's MCP client config"
          code={<CodeBlock caption="e.g. claude_desktop_config.json — any MCP client takes the same URL + header" code={mcpConfig} />}
        >
          Register the checkpoint URL and the bearer token your agents must send. StileAI speaks the Model Context
          Protocol, so Claude, Claude Code, or any MCP-compatible agent connects the same way.
        </Step>

        <Step
          n={3}
          title="Ask before acting"
          where="in your agent's code / tool logic"
          code={<CodeBlock caption="call request_action, then honor the answer" code={usage} />}
        >
          Before any sensitive step, your agent calls <span className="text-ink font-medium">request_action</span> and gets
          back <span className="text-blue">allow</span>, <span className="text-slate">deny</span>, or{" "}
          <span className="text-ink3">require_approval</span> — every call is logged, and approvals wait for a human here in the dashboard.
        </Step>
      </ol>
    </section>
  );
}
