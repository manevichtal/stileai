"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "ready" | "coming" | "locked";
type Tool = {
  id: string;
  name: string;
  status: Status;
  intro: string;
  steps: string[];
  code?: { label: string; body: string };
  notes?: string[];
};

const BASE = "https://stileai.vercel.app/api/proxy/YOUR_KEY";

const TOOLS: Tool[] = [
  {
    id: "claude",
    name: "Claude / Claude Code",
    status: "ready",
    intro: "Claude Code, or any app that uses the Anthropic API.",
    steps: [
      "Get an Anthropic API key from console.anthropic.com. (This works with an API key — not the Pro/Max subscription login.)",
      "Open your Claude Code settings file at ~/.claude/settings.json and add the block on the right.",
      "Restart Claude Code.",
    ],
    code: {
      label: "~/.claude/settings.json",
      body: `{
  "env": {
    "ANTHROPIC_BASE_URL": "${BASE}",
    "ANTHROPIC_API_KEY": "sk-ant-your-anthropic-key"
  }
}`,
    },
    notes: [
      "Claude Code sends your code in most requests. On Policies, set “Source code” to Allow so it isn’t held every time — secrets, customer data, etc. are still caught.",
    ],
  },
  {
    id: "openai",
    name: "OpenAI / your app",
    status: "ready",
    intro: "Any app or code that uses the OpenAI API.",
    steps: ["Set your client’s base URL to your StileAI endpoint, and keep using your OpenAI key."],
    code: {
      label: "Python (OpenAI SDK)",
      body: `from openai import OpenAI

client = OpenAI(
    base_url="${BASE}/v1",
    api_key="sk-your-openai-key",
)`,
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    status: "ready",
    intro: "The Cursor code editor.",
    steps: [
      "Cursor → Settings → Models.",
      "Turn on “Override OpenAI Base URL” and paste the endpoint on the right.",
      "Add your OpenAI key, and save.",
    ],
    code: { label: "OpenAI Base URL", body: `${BASE}/v1` },
  },
  {
    id: "openwebui",
    name: "Open WebUI / LibreChat",
    status: "ready",
    intro: "Self-hosted chat front-ends your team uses.",
    steps: [
      "Admin → Settings → Connections (or “Endpoints”).",
      "Add an OpenAI-compatible connection with the URL on the right.",
      "Use your OpenAI key.",
    ],
    code: { label: "Endpoint URL", body: `${BASE}/v1` },
  },
  {
    id: "gemini",
    name: "Gemini",
    status: "coming",
    intro: "Google Gemini.",
    steps: [
      "Native Gemini support is coming. In the meantime, if your Gemini tool has an OpenAI-compatible mode, point it at the OpenAI endpoint above.",
    ],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    status: "locked",
    intro: "GitHub Copilot in your IDE.",
    steps: [
      "Copilot locks its connection and can’t be pointed at a custom URL, so it can’t be routed through StileAI this way. Covering Copilot needs network-level interception — it’s on our roadmap.",
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT (web / app)",
    status: "locked",
    intro: "The ChatGPT website or desktop app.",
    steps: [
      "The ChatGPT app locks its connection and can’t be redirected. For anything you build on the OpenAI API, use the “OpenAI / your app” tab. Full coverage of the ChatGPT app needs network-level interception — on our roadmap.",
    ],
  },
];

const STATUS: Record<Status, { label: string; bg: string; fg: string; border: string }> = {
  ready: { label: "Works now", bg: "#e8f6ee", fg: "#0f7a3d", border: "#b8e2c6" },
  coming: { label: "Coming soon", bg: "#fef4e2", fg: "#9a6206", border: "#f4dca6" },
  locked: { label: "Not yet possible", bg: "#f1f2f4", fg: "#5b6472", border: "#dfe3e8" },
};

function Copyable({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-bg2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line">
        <span className="text-[10.5px] text-ink3">{label}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-[10.5px] text-blue hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-[11.5px] text-ink2 overflow-x-auto"><code>{body}</code></pre>
    </div>
  );
}

export function ConnectGuide() {
  const [id, setId] = useState(TOOLS[0].id);
  const tool = TOOLS.find((t) => t.id === id) ?? TOOLS[0];
  const s = STATUS[tool.status];

  return (
    <section className="bg-card border border-line rounded-2xl p-6">
      <h3 className="font-sans font-bold text-[15px] text-ink">How to connect your AI</h3>
      <p className="text-[12px] text-ink2 mt-1 max-w-[720px]">
        StileAI gives you an endpoint that works like the AI’s normal API. Point your tool at it and every request is
        checked against your <Link href="/policies" className="text-blue hover:underline">policies</Link> first — nothing to install. Pick your tool:
      </p>

      {/* tool tabs */}
      <div className="mt-3 flex items-center gap-1 flex-wrap bg-bg2 border border-line rounded-xl p-1 self-start">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setId(t.id)}
            className={`text-[12px] rounded-lg px-2.5 py-1.5 transition-colors ${
              id === t.id ? "bg-card text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,.06)]" : "text-ink3 hover:text-ink"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-sans font-semibold text-[13.5px] text-ink">{tool.name}</span>
            <span
              className="text-[10px] font-medium rounded px-1.5 py-0.5"
              style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
            >
              {s.label}
            </span>
          </div>
          <p className="text-[11.5px] text-ink3 mb-2.5">{tool.intro}</p>
          <ol className="flex flex-col gap-2">
            {tool.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-none w-5 h-5 rounded-full bg-bg2 border border-line text-ink3 font-sans font-bold text-[10px] flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-[12px] text-ink2 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          {tool.notes?.map((n, i) => (
            <p key={i} className="mt-3 text-[11px] text-ink2 bg-bluedim border border-blue/20 rounded-lg px-3 py-2">💡 {n}</p>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {tool.code && <Copyable label={tool.code.label} body={tool.code.body} />}
          {tool.status !== "locked" && (
            <p className="text-[11px] text-ink4">
              Replace <span className="text-ink3">YOUR_KEY</span> with a key from{" "}
              <Link href="/keys" className="text-blue hover:underline">API keys</Link>, or an employee&apos;s personal key from{" "}
              <Link href="/team" className="text-blue hover:underline">Team &amp; seats</Link>, and use your own AI provider key as before.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
