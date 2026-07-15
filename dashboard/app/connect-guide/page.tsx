import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Connect StileAI — step by step",
  description: "A picture guide to connecting your AI tools to StileAI in one line.",
};

// A small mac-style window frame used for the illustrations.
function Win({ title, children, dark = true }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden border shadow-[0_10px_30px_-12px_rgba(16,24,40,.35)]"
      style={{ borderColor: dark ? "#232a36" : "#e6e8ec", background: dark ? "#0c0f16" : "#ffffff" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: dark ? "#232a36" : "#eef0f3", background: dark ? "#151a23" : "#f7f8fa" }}>
        <span className="flex gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#ff5f57" }} />
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#febc2e" }} />
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#28c840" }} />
        </span>
        <span className="font-sans text-[11px]" style={{ color: dark ? "#8b93a1" : "#6b7280" }}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Step({ n, title, children, art }: { n: number; title: string; children: React.ReactNode; art: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-5 items-center">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex-none w-7 h-7 rounded-full bg-blue text-white font-sans font-bold text-[13px] flex items-center justify-center">{n}</span>
          <h2 className="font-sans font-bold text-[16px] text-ink tracking-[-0.01em]">{title}</h2>
        </div>
        <div className="mt-2 font-sans text-[13px] text-ink2 leading-relaxed pl-[38px]">{children}</div>
      </div>
      <div>{art}</div>
    </div>
  );
}

export default function ConnectGuidePage() {
  const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  return (
    <div className="min-h-full flex flex-col bg-bg">
      <header className="border-b border-line bg-card">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center"><Brand size={20} /></Link>
          <Link href="/guide" className="font-sans text-[13px] font-medium text-ink2 hover:text-ink">Back to setup</Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[860px] mx-auto px-6 py-12">
          <h1 className="font-sans font-extrabold text-[30px] text-ink tracking-[-0.02em]">Connect StileAI in one line</h1>
          <p className="font-sans text-[14px] text-ink2 mt-2 max-w-[620px] leading-relaxed">
            This takes about two minutes. You’ll copy one line, paste it into an app called <b>Terminal</b>, and press Enter.
            That’s it — StileAI then checks every request your AI tools make. No files to edit.
          </p>

          <div className="mt-10 flex flex-col gap-12">
            <Step n={1} title="Copy your key" art={
              <Win title="StileAI — API keys" dark={false}>
                <div className="font-sans text-[12px] text-ink2 mb-2">Your StileAI key</div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg2 px-3 py-2">
                  <span style={{ fontFamily: mono }} className="text-[12px] text-ink">stk_live_9f2a…c3d</span>
                  <span className="text-[11px] text-blue font-medium">Copy</span>
                </div>
              </Win>
            }>
              In StileAI, open <Link href="/keys" className="text-blue hover:underline">API keys</Link> and copy your key
              (or create one). You’ll paste it into the command in a moment.
            </Step>

            <Step n={2} title="Open Terminal" art={
              <Win title="Applications → Utilities">
                <div style={{ fontFamily: mono }} className="text-[12.5px] text-[#c8d1dc]">
                  <div className="text-[#8b93a1]"># Mac: press ⌘ + Space, type “Terminal”, hit Enter</div>
                  <div className="text-[#8b93a1]"># Windows: open “Command Prompt” or “PowerShell”</div>
                  <div className="mt-2"><span className="text-[#28c840]">you@mac</span> <span className="text-[#5b8cff]">~</span> %&nbsp;<span className="inline-block w-2 h-4 align-middle" style={{ background: "#c8d1dc" }} /></div>
                </div>
              </Win>
            }>
              Terminal is a plain text window that comes with your computer. It looks bare, but you only need to paste one line.
            </Step>

            <Step n={3} title="Paste the command and press Enter" art={
              <Win title="Terminal">
                <div style={{ fontFamily: mono }} className="text-[12px] leading-relaxed">
                  <div><span className="text-[#28c840]">you@mac</span> <span className="text-[#5b8cff]">~</span> %&nbsp;<span className="text-[#c8d1dc]">curl -fsSL https://stileai.com/connect.sh | sh -s -- </span><span className="text-[#febc2e]">YOUR_KEY</span></div>
                </div>
              </Win>
            }>
              Paste the line below, replace <b>YOUR_KEY</b> with the key you copied, and press <b>Enter</b>.
              <div className="mt-2.5 rounded-lg border border-line bg-bg2 px-3 py-2" style={{ fontFamily: mono }}>
                <span className="text-[11.5px] text-ink2 break-all">curl -fsSL https://stileai.com/connect.sh | sh -s -- YOUR_KEY</span>
              </div>
            </Step>

            <Step n={4} title="See the checkmark — you’re protected" art={
              <Win title="Terminal">
                <div style={{ fontFamily: mono }} className="text-[12px] leading-relaxed text-[#c8d1dc]">
                  <div className="text-[#28c840]">✓ StileAI is now protecting the AI agents you run from your terminal.</div>
                  <div className="text-[#8b93a1] mt-1">Set up in: ~/.zshrc</div>
                  <div className="text-[#8b93a1]">Open a new terminal window to start.</div>
                </div>
              </Win>
            }>
              When you see the green checkmark, it worked. Open a <b>new</b> Terminal window so the change takes effect.
              From now on, tools like Claude Code and your AI agents run through StileAI.
            </Step>

            <Step n={5} title="Test it (optional)" art={
              <Win title="StileAI — Audit log" dark={false}>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg2 px-3 py-2">
                  <span className="font-sans text-[12px] text-ink2">prompt with a fake key</span>
                  <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5" style={{ background: "#fdecec", color: "#b02a37" }}>BLOCKED</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg2 px-3 py-2 mt-2">
                  <span className="font-sans text-[12px] text-ink2">“write a unit test”</span>
                  <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5" style={{ background: "#e8f6ee", color: "#0f7a3d" }}>ALLOWED</span>
                </div>
              </Win>
            }>
              Ask your AI tool something normal — it answers as usual. Then paste a fake secret and ask it to use it.
              Open <Link href="/audit" className="text-blue hover:underline">Audit log</Link> in StileAI and you’ll see both decisions.
            </Step>
          </div>

          <div className="mt-12 rounded-xl border border-line bg-card p-5">
            <h3 className="font-sans font-bold text-[14px] text-ink">Good to know</h3>
            <ul className="mt-2 flex flex-col gap-1.5 font-sans text-[12.5px] text-ink2 leading-relaxed">
              <li>• It never asks for your AI provider keys — your existing keys are used as-is and pass straight through.</li>
              <li>• Everything it changes sits in one clearly-marked block in your shell profile, and it makes a backup.</li>
              <li>• Apps you open from the dock (like Cursor) need one setting in their own preferences — see the <Link href="/guide" className="text-blue hover:underline">setup page</Link>.</li>
              <li>• To undo any time, run: <span style={{ fontFamily: mono }} className="text-ink3">curl -fsSL https://stileai.com/connect.sh | sh -s -- --uninstall</span></li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-bg2">
        <div className="max-w-[900px] mx-auto px-6 py-8 flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3"><Brand size={16} /><span className="text-[12px] text-ink3">&copy; 2026 StileAI</span></div>
          <Link href="/guide" className="text-[12.5px] text-ink2 hover:text-ink">All connection options →</Link>
        </div>
      </footer>
    </div>
  );
}
