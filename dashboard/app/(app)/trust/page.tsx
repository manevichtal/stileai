import { PageHeader } from "@/components/AppShell";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

// A plain-language trust note for the admin (and anyone they forward it to during
// a security review). Every claim here reflects how the product actually works —
// data minimization is enforced in lib/aiGate.ts, key pass-through in the proxy
// routes. Do not add claims (certifications, regions) that aren't true.

export default function TrustPage() {
  return (
    <>
      <PageHeader
        title="Trust & security"
        subtitle="How StileAI handles your company's data — in plain language."
      />
      <div className="px-6 lg:px-8 pb-12 flex flex-col gap-6 max-w-[860px]">
        {/* Core guarantee */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex-none w-10 h-10 rounded-xl bg-bluedim text-blue flex items-center justify-center">
              <Icon name="check" size={20} />
            </span>
            <div>
              <h2 className="font-sans font-bold text-[17px] text-ink tracking-[-0.01em]">
                StileAI is built to see less, not more.
              </h2>
              <p className="font-sans text-[12.5px] text-ink2 leading-relaxed mt-2">
                We sit in the path of your team&apos;s AI requests to enforce your policies — but the
                whole design minimizes what we keep. When a request is blocked or held, its content is
                <span className="text-ink font-medium"> never stored</span>. We record only the decision,
                the policy category, and a short preview of requests you explicitly allow. We don&apos;t
                train on your data, and we don&apos;t sell it.
              </p>
            </div>
          </div>
        </section>

        {/* What we store vs never store */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border border-line rounded-2xl p-5">
            <div className="font-sans font-bold text-[13px] text-ink mb-3">What we store</div>
            <ul className="flex flex-col gap-2.5">
              {[
                "The decision (approved, blocked, or sent for approval) and the reason.",
                "The policy category that matched — e.g. “secrets”, “customer PII” — not the sensitive value itself.",
                "A short preview only of requests you explicitly allow, so you can review activity.",
                "Standard account data: your org, admins, and API keys (hashed).",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 font-sans text-[12px] text-ink2 leading-relaxed">
                  <span className="flex-none text-blue mt-0.5"><Icon name="check" size={14} /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card border border-line rounded-2xl p-5">
            <div className="font-sans font-bold text-[13px] text-ink mb-3">What we never store</div>
            <ul className="flex flex-col gap-2.5">
              {[
                "The content of any blocked or held request — it is replaced with “(restricted content hidden)”.",
                "The secrets, passwords, source code, or customer data our checks detect.",
                "Your AI provider keys — they pass through to the AI and are never saved.",
                "Anything used to train a model. Ever.",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 font-sans text-[12px] text-ink2 leading-relaxed">
                  <span className="flex-none text-ink3 mt-0.5"><Icon name="circle" size={14} /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How a request flows */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <h3 className="font-sans font-bold text-[14px] text-ink mb-3">What happens to a request</h3>
          <ol className="flex flex-col gap-3">
            {[
              ["It reaches StileAI over an encrypted (TLS) connection.", "Same as talking to the AI directly — nothing runs on your employees' machines."],
              ["We check it against your policies in memory.", "Detection runs on the request as it passes through — we look for secrets, PII, source code, and the other categories you enable."],
              ["Safe requests are forwarded to the AI unchanged.", "Your own provider key is used to complete the request; we don't alter the prompt or the response."],
              ["Risky requests are stopped before they leave.", "The content never reaches the AI, and it isn't written to our records — only the decision and category are."],
            ].map(([h, b], i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-bg2 border border-line text-ink3 font-sans font-bold text-[11px] flex items-center justify-center mt-0.5">{i + 1}</span>
                <div>
                  <div className="font-sans font-semibold text-[12.5px] text-ink">{h}</div>
                  <p className="font-sans text-[11.5px] text-ink2 leading-relaxed mt-0.5">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Isolation */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <h3 className="font-sans font-bold text-[14px] text-ink mb-2">Your data is isolated from every other company</h3>
          <p className="font-sans text-[12px] text-ink2 leading-relaxed">
            Every organization&apos;s policies, decisions, and keys live behind row-level security in the
            database. One company&apos;s account can never read another&apos;s data — the isolation is
            enforced at the data layer, not just in the app.
          </p>
        </section>

        {/* Subprocessors */}
        <section className="bg-card border border-line rounded-2xl p-6">
          <h3 className="font-sans font-bold text-[14px] text-ink mb-1">Who we rely on</h3>
          <p className="font-sans text-[11.5px] text-ink3 mb-4">The services that run StileAI. We add nothing beyond these to handle your data.</p>
          <div className="flex flex-col divide-y divide-line">
            {[
              ["Vercel", "Runs the StileAI application and the policy checkpoint."],
              ["Supabase (PostgreSQL)", "Stores your account, policies, and the redacted audit trail."],
              ["Stripe", "Processes subscription billing. Sees your billing details, never your AI requests or audit data."],
              ["Your AI providers (OpenAI, Anthropic, and others you connect)", "Receive only the requests your policies approve — using your own keys, exactly as they do today."],
            ].map(([name, role], i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3">
                <div className="font-sans font-semibold text-[12.5px] text-ink">{name}</div>
                <div className="font-sans text-[11.5px] text-ink2 text-right max-w-[440px]">{role}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Enterprise / review */}
        <section className="bg-bluedim border border-blue/20 rounded-2xl p-6">
          <h3 className="font-sans font-bold text-[14px] text-ink mb-2">For your security review</h3>
          <p className="font-sans text-[12px] text-ink2 leading-relaxed">
            Enterprise plans include a signed Data Processing Agreement, support for your vendor security
            questionnaire, single sign-on, and the option to run StileAI inside your own environment so
            requests never leave your infrastructure. Reach us at{" "}
            <a href="mailto:security@stileai.com" className="text-blue hover:underline font-medium">security@stileai.com</a>.
          </p>
        </section>

        <p className="font-sans text-[11px] text-ink4">Last reviewed: July 2026.</p>
      </div>
    </>
  );
}
