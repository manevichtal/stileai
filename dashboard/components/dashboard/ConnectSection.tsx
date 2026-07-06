"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

export function ConnectSection({ origin }: { origin: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `# On the machine running your StileAI checkpoint (MCP server):
INTERLOCK_STORE=api
INTERLOCK_TRANSPORT=http
INTERLOCK_DASHBOARD_URL=${origin}
INTERLOCK_API_KEY=<paste a key from the API keys page>
INTERLOCK_MCP_AUTH_TOKEN=<a long random secret your agents send>`;

  const steps = [
    { n: 1, title: "Generate an API key", body: "Create a key on the API keys page — it lets your checkpoint pull policies from this dashboard and push its audit trail back.", href: "/keys", link: "Open API keys" },
    { n: 2, title: "Point the checkpoint at StileAI", body: "Set these environment variables where your checkpoint runs. It stays in sync with policy edits automatically — no restarts." },
    { n: 3, title: "Route your agent through it", body: "Before any sensitive action, your agent asks the checkpoint and gets allow, deny, or wait-for-approval. It speaks the Model Context Protocol, so any MCP-compatible agent works out of the box." },
  ];

  return (
    <section className="bg-card border border-line rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-blue"><Icon name="plug" size={18} /></span>
        <h2 className="font-sans font-bold text-[16px] text-ink tracking-[-0.01em]">Connect your checkpoint</h2>
      </div>
      <p className="font-mono text-[12px] text-ink3 mb-5">
        Put StileAI between your AI agents and the systems they can touch — in three steps.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-6">
        <ol className="flex flex-col gap-4">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-3.5">
              <span className="flex-none w-7 h-7 rounded-full bg-bluedim text-blue font-sans font-bold text-[13px] flex items-center justify-center">{s.n}</span>
              <div>
                <div className="font-sans font-semibold text-[13.5px] text-ink">{s.title}</div>
                <p className="font-mono text-[11.5px] text-ink2 leading-relaxed mt-0.5">{s.body}</p>
                {s.href && (
                  <Link href={s.href} className="inline-block font-mono text-[11px] text-blue hover:underline mt-1">{s.link} →</Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="relative">
          <pre className="font-mono text-[11.5px] leading-relaxed text-railink bg-rail rounded-xl p-4 overflow-x-auto whitespace-pre h-full">{snippet}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute top-2.5 right-2.5 flex items-center gap-1.5 font-mono text-[10.5px] text-railink bg-railhov hover:bg-white/10 rounded-md px-2 py-1"
          >
            <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}
