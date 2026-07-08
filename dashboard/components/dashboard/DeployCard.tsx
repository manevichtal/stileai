"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

const REPO = "https://github.com/manevichtal/stileai";
const DEPLOY_URL = `https://render.com/deploy?repo=${REPO}`;

const DOCKER = `# build once
docker build -t stileai-checkpoint ./interlock-mcp

# run it (fill in your values from the API keys / Settings pages)
docker run -p 8000:8000 \\
  -e INTERLOCK_STORE=api \\
  -e INTERLOCK_TRANSPORT=http \\
  -e INTERLOCK_DASHBOARD_URL=https://stileai.vercel.app \\
  -e INTERLOCK_API_KEY=<your API key> \\
  -e INTERLOCK_MCP_AUTH_TOKEN=<a long random secret> \\
  -e INTERLOCK_PUBLIC_URL=<this container's public URL> \\
  stileai-checkpoint`;

export function DeployCard() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="bg-card border border-line rounded-2xl p-6">
      <h3 className="font-sans font-bold text-[15px] text-ink">Deploy your checkpoint</h3>
      <p className="font-sans text-[11.5px] text-ink2 leading-relaxed mt-1.5 mb-4 max-w-[680px]">
        The checkpoint runs in <span className="text-ink font-medium">your own</span> environment — sensitive actions
        never leave your infrastructure. One click spins it up in your Render account, wired to this dashboard. It
        registers its own URL back here automatically.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={DEPLOY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-ink text-white font-sans font-semibold text-[13px] rounded-xl px-4 py-2.5 hover:opacity-90"
        >
          <Icon name="cloud" size={16} /> Deploy to Render
          <Icon name="arrowRight" size={14} />
        </a>
        <span className="font-sans text-[11px] text-ink4">
          You&apos;ll paste your API key during setup. Free tier works for testing.
        </span>
      </div>

      <div className="mt-4">
        <div className="font-sans text-[10px] text-ink4 mb-1.5">…or run it anywhere with Docker</div>
        <div className="relative">
          <pre className="font-sans text-[11px] leading-relaxed text-railink bg-rail rounded-xl p-3.5 pr-16 overflow-auto max-h-[220px] whitespace-pre">{DOCKER}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(DOCKER); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute top-2.5 right-2.5 flex items-center gap-1.5 font-sans text-[10px] text-railink bg-railhov hover:bg-white/10 rounded-md px-2 py-1"
          >
            <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}
