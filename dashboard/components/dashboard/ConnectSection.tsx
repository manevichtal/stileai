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
        <pre className="font-mono text-[11px] leading-relaxed text-railink bg-rail rounded-xl p-3.5 pr-16 overflow-auto max-h-[164px] whitespace-pre">{code}</pre>
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

const RUN = `pip install -r requirements.txt
python -m interlock.server   # serves the checkpoint at /mcp`;

const MCP_CONFIG = `{
  "mcpServers": {
    "stileai": {
      "url": "https://your-checkpoint-host/mcp",
      "headers": {
        "Authorization": "Bearer <INTERLOCK_MCP_AUTH_TOKEN>"
      }
    }
  }
}`;

const USAGE = `# Ask BEFORE doing anything sensitive
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

export function ConnectSection({ origin }: { origin: string }) {
  const env = `# HTTP mode + point it at StileAI
INTERLOCK_STORE=api
INTERLOCK_TRANSPORT=http
INTERLOCK_DASHBOARD_URL=${origin}
INTERLOCK_API_KEY=<key from the API keys page>
INTERLOCK_MCP_AUTH_TOKEN=<a long random secret>`;

  const steps = [
    {
      title: "Run the checkpoint",
      where: "on your infrastructure or a host (Render, Railway, Fly)",
      body: (
        <>
          The checkpoint pulls your policies from this dashboard and pushes its audit trail back — automatically, no
          restarts when you edit rules. <Link href="/keys" className="text-blue hover:underline">Generate the API key →</Link>
        </>
      ),
      code: (
        <div className="flex flex-col gap-3">
          <CodeBlock caption="start it in HTTP mode" code={RUN} />
          <CodeBlock caption="configure it — add to a .env file beside the server, or your host's Environment settings" code={env} />
        </div>
      ),
    },
    {
      title: "Point your agent at it",
      where: "in your agent's MCP client config",
      body: (
        <>
          Register the checkpoint URL and the bearer token your agents send. StileAI speaks the Model Context Protocol,
          so Claude, Claude Code, or any MCP-compatible agent connects the same way.
        </>
      ),
      code: <CodeBlock caption="e.g. claude_desktop_config.json — any MCP client takes the same URL + header" code={MCP_CONFIG} />,
    },
    {
      title: "Ask before acting",
      where: "in your agent's code / tool logic",
      body: (
        <>
          Before any sensitive step, your agent calls <span className="text-ink font-medium">request_action</span> and gets
          back <span className="text-blue">allow</span>, <span className="text-slate">deny</span>, or{" "}
          <span className="text-ink3">require_approval</span> — every call is logged, and approvals wait for a human here.
        </>
      ),
      code: <CodeBlock caption="call request_action, then honor the answer" code={USAGE} />,
    },
  ];

  const [step, setStep] = useState(0);
  const cur = steps[step];

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue"><Icon name="plug" size={17} /></span>
        <h2 className="font-sans font-bold text-[15px] text-ink tracking-[-0.01em]">Connect your checkpoint</h2>
      </div>

      {/* stepper */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1 last:flex-none">
              <button onClick={() => setStep(i)} className="flex items-center gap-2 group">
                <span
                  className={`flex-none w-6 h-6 rounded-full flex items-center justify-center font-sans font-bold text-[11px] transition-colors ${
                    active ? "bg-blue text-white" : done ? "bg-bluedim text-blue" : "bg-bg2 border border-line text-ink3 group-hover:text-ink"
                  }`}
                >
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span className={`font-sans text-[12px] whitespace-nowrap ${active ? "text-ink font-semibold" : "text-ink3 group-hover:text-ink2"}`}>
                  {s.title}
                </span>
              </button>
              {i < steps.length - 1 && <span className={`flex-1 h-px mx-2 ${done ? "bg-blue/40" : "bg-line"}`} />}
            </div>
          );
        })}
      </div>

      {/* active step */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 lg:gap-6 items-start">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-blue">{cur.where}</div>
          <p className="font-mono text-[12px] text-ink2 leading-relaxed mt-2">{cur.body}</p>
        </div>
        <div>{cur.code}</div>
      </div>

      {/* nav */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-mono text-[11.5px] text-ink3 hover:text-ink disabled:opacity-40 disabled:hover:text-ink3"
        >
          ← Back
        </button>
        <span className="font-mono text-[10.5px] text-ink4">Step {step + 1} of {steps.length}</span>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="bg-blue text-white font-sans font-semibold text-[12px] rounded-xl px-4 py-2 hover:opacity-90"
          >
            Next →
          </button>
        ) : (
          <Link href="/keys" className="bg-blue text-white font-sans font-semibold text-[12px] rounded-xl px-4 py-2 hover:opacity-90">
            Get your API key →
          </Link>
        )}
      </div>
    </section>
  );
}
