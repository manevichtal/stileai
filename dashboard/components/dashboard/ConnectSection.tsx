"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

const CLIENTS = [
  { key: "claude", name: "Claude", loc: "Settings → Connectors", how: "Click Add custom connector, name it StileAI, and paste the URL." },
  { key: "chatgpt", name: "ChatGPT", loc: "Settings → Connectors", how: "Add a new connector (or a GPT Action) and paste the URL." },
  { key: "cursor", name: "Cursor", loc: "Settings → MCP", how: "Click Add new MCP server and paste the URL." },
  { key: "gemini", name: "Gemini", loc: "Gemini CLI / settings", how: "Run gemini mcp add stileai <url>, or add it under mcpServers in settings.json." },
  { key: "copilot", name: "Copilot", loc: "VS Code → mcp.json", how: "Command Palette → “MCP: Add Server” → paste the URL." },
  { key: "custom", name: "Any client", loc: "Your MCP client", how: "Add an MCP server with this URL and an Authorization: Bearer header." },
];

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className={`flex-1 min-w-0 truncate ${mono ? "font-mono" : "font-sans"} text-[11.5px] text-ink bg-bg2 border border-line rounded-lg px-2.5 py-2`}>
        {value}
      </code>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="flex-none flex items-center gap-1 font-mono text-[10.5px] text-blue border border-blue/40 rounded-lg px-2.5 py-2 hover:bg-bluedim"
      >
        <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ConnectSection({ checkpointUrl }: { checkpointUrl: string | null }) {
  const [client, setClient] = useState(CLIENTS[0]);
  const [url, setUrl] = useState(checkpointUrl ?? "");

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <span className="text-blue"><Icon name="plug" size={17} /></span>
          <h2 className="font-sans font-bold text-[15px] text-ink tracking-[-0.01em]">Connect your checkpoint</h2>
        </div>
        {/* client picker */}
        <div className="flex items-center gap-1 bg-bg2 border border-line rounded-xl p-0.5 flex-wrap">
          {CLIENTS.map((c) => (
            <button
              key={c.key}
              onClick={() => setClient(c)}
              className={`font-sans text-[12px] rounded-lg px-2.5 py-1.5 transition-colors ${
                client.key === c.key ? "bg-card text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,.06)]" : "text-ink3 hover:text-ink"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Step n={1} title="Copy your checkpoint URL" body="Paste it into your AI client in the next step.">
          {url ? (
            <CopyField value={url} />
          ) : (
            <>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-checkpoint.onrender.com/mcp"
                className="w-full font-mono text-[11px] text-ink2 bg-bg2 border border-line rounded-lg px-2.5 py-2 focus:border-blue outline-none"
                aria-label="Checkpoint URL"
              />
              <p className="font-mono text-[10px] text-ink4 mt-1.5">
                No checkpoint yet? <Link href="/guide" className="text-blue hover:underline">Deploy one in a click</Link> — it fills in here automatically.
              </p>
            </>
          )}
        </Step>

        <Step n={2} title={`Open ${client.name}`} body={client.how}>
          <div className="font-mono text-[11px] text-blue bg-bluedim border border-blue/25 rounded-lg px-2.5 py-2">
            {client.loc}
          </div>
        </Step>

        <Step n={3} title="Connect — that's it" body="Nothing else to enter. Your URL already includes your access key, so the connector signs in on its own. Keep the URL private — anyone with it can reach your checkpoint.">
          <div className="font-mono text-[11px] text-ink3 bg-bg2 border border-line rounded-lg px-2.5 py-2">
            No token field, no OAuth — just the URL.
          </div>
        </Step>
      </div>

      <p className="font-mono text-[10.5px] text-ink4 mt-4 pt-3 border-t border-line">
        Prefer a header instead of the key in the URL? Use{" "}
        <span className="text-ink3">Authorization: Bearer &lt;token&gt;</span> with the base <span className="text-ink3">/mcp</span> URL.
        Running your own checkpoint? <Link href="/guide" className="text-blue hover:underline">See the self-host steps</Link>.
      </p>
    </section>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex-none w-6 h-6 rounded-full bg-bg2 border border-line text-ink3 font-sans font-bold text-[11px] flex items-center justify-center">{n}</span>
        <span className="font-sans font-semibold text-[13px] text-ink">{title}</span>
      </div>
      <p className="font-mono text-[11px] text-ink2 leading-relaxed mb-2.5 min-h-[32px]">{body}</p>
      {children}
    </div>
  );
}
