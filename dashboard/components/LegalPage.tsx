import Link from "next/link";
import { Brand } from "@/components/Brand";

export type LegalSection = { heading: string; body: string[]; bullets?: string[] };

// Shared chrome for the public legal pages (/terms, /privacy). Server-rendered so
// the full text is in the initial HTML. Same header/footer as the marketing pages.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-full flex flex-col bg-bg">
      <header className="border-b border-line bg-card">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center"><Brand size={20} /></Link>
          <nav className="flex items-center gap-5 font-sans">
            <Link href="/blog" className="text-[13px] font-medium text-ink2 hover:text-ink">Blog</Link>
            <Link href="/login" className="text-[13px] font-medium text-ink2 hover:text-ink">Log in</Link>
            <Link href="/login?mode=signup" className="text-[13px] font-semibold text-white bg-blue rounded-lg px-3.5 py-2 hover:bg-blue2">Get started</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-[760px] mx-auto px-6 py-14">
          <h1 className="font-sans font-extrabold text-[34px] leading-[1.1] tracking-[-0.02em] text-ink">{title}</h1>
          <p className="font-sans text-[12.5px] text-ink3 mt-2">Last updated: {updated}</p>
          <p className="font-sans text-[15px] text-ink2 leading-relaxed mt-5">{intro}</p>

          {sections.map((s, i) => (
            <section key={i} className="mt-9">
              <h2 className="font-sans font-bold text-[19px] tracking-[-0.01em] text-ink">{i + 1}. {s.heading}</h2>
              {s.body.map((p, j) => (
                <p key={j} className="font-sans text-[14.5px] text-ink2 leading-relaxed mt-3">{p}</p>
              ))}
              {s.bullets && (
                <ul className="mt-3 flex flex-col gap-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="font-sans text-[14px] text-ink2 leading-relaxed flex gap-2.5">
                      <span className="text-blue mt-0.5">▸</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-12 pt-6 border-t border-line font-sans text-[13px] text-ink2">
            Questions? Email{" "}
            <a href="mailto:legal@stileai.com" className="text-blue hover:underline">legal@stileai.com</a>.
            {" "}See also our{" "}
            <Link href="/terms" className="text-blue hover:underline">Terms of Service</Link>{" and "}
            <Link href="/privacy" className="text-blue hover:underline">Privacy Policy</Link>.
          </div>
        </article>
      </main>

      <footer className="border-t border-line bg-bg2">
        <div className="max-w-[900px] mx-auto px-6 py-8 flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3"><Brand size={16} /><span className="text-[12px] text-ink3">&copy; 2026 StileAI</span></div>
          <nav className="flex items-center gap-4 text-[12.5px] text-ink2">
            <Link href="/" className="hover:text-ink">Home</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
