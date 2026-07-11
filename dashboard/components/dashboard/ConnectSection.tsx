"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

const CLIENTS = [
  { key: "app", name: "Your app / SDK", loc: "In your code or app config", how: "Set the AI base URL to the StileAI endpoint below, and keep using your normal AI provider key." },
  { key: "cursor", name: "Cursor", loc: "Settings → Models → OpenAI Base URL", how: "Set the OpenAI Base URL to the StileAI endpoint below, and add your provider key." },
  { key: "openwebui", name: "Open WebUI / LibreChat", loc: "Admin → Connections / endpoints", how: "Add an OpenAI-compatible endpoint pointing at the StileAI URL below." },
  { key: "custom", name: "Any OpenAI-compatible tool", loc: "Your tool's API settings", how: "Point the tool's API base URL at the StileAI endpoint below; use your AI provider key as the tool's key." },
];

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className={`flex-1 min-w-0 truncate ${mono ? "font-sans" : "font-sans"} text-[11.5px] text-ink bg-bg2 border border-line rounded-lg px-2.5 py-2`}>
        {value}
      </code>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="flex-none flex items-center gap-1 font-sans text-[10.5px] text-blue border border-blue/40 rounded-lg px-2.5 py-2 hover:bg-bluedim"
      >
        <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ConnectSection({ checkpointUrl: _checkpointUrl }: { checkpointUrl: string | null }) {
  const [client, setClient] = useState(CLIENTS[0]);
  const base = typeof window !== "undefined" ? window.location.origin : "https://stileai.com";
  const proxyUrl = `${base}/api/proxy/YOUR_STILEAI_KEY/v1`;

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <span className="text-blue"><Icon name="plug" size={17} /></span>
          <h2 className="font-sans font-bold text-[15px] text-ink tracking-[-0.01em]">Connect your AI</h2>
        </div>
        {/* client picker — which AI assistant to point at StileAI */}
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
        <Step n={1} title="Point your tool at StileAI" body="Use this as your AI tool's API base URL — every request passes through StileAI first.">
          <CopyField value={proxyUrl} />
          <p className="font-sans text-[10px] text-ink4 mt-1.5">
            Replace <span className="text-ink3">YOUR_STILEAI_KEY</span> with a key from{" "}
            <Link href="/keys" className="text-blue hover:underline">API keys</Link>.
          </p>
        </Step>

        <Step n={2} title={`Set it up in ${client.name}`} body={client.how}>
          <div className="font-sans text-[11px] text-blue bg-bluedim border border-blue/25 rounded-lg px-2.5 py-2">
            {client.loc}
          </div>
        </Step>

        <Step n={3} title="You're protected" body="From now on, every request your team sends is checked against your policies before it reaches the AI — approved, blocked, or routed to admin.">
          <div className="font-sans text-[11px] text-ink3 bg-bg2 border border-line rounded-lg px-2.5 py-2">
            Keep this URL private — your key is in it.
          </div>
        </Step>
      </div>

      <p className="font-sans text-[10.5px] text-ink4 mt-4 pt-3 border-t border-line">
        Works with any tool or app that lets you set an OpenAI-compatible API base URL. Your team keeps using their
        normal AI provider key — StileAI checks each request, then forwards the approved ones to the AI.
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
      <p className="font-sans text-[11px] text-ink2 leading-relaxed mb-2.5 min-h-[32px]">{body}</p>
      {children}
    </div>
  );
}
