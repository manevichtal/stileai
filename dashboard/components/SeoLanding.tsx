import Link from "next/link";
import { Brand } from "@/components/Brand";
import { FaqStructuredData } from "@/components/StructuredData";
import type { SeoPage } from "@/lib/seoContent";
import { SEO_PAGES } from "@/lib/seoContent";

// A crawlable, content-rich marketing page for one keyword cluster. Server-rendered
// so all the copy is in the initial HTML (unlike the JS console on the homepage).
export function SeoLanding({ page }: { page: SeoPage }) {
  const related = page.related
    .map((slug) => SEO_PAGES.find((p) => p.slug === slug))
    .filter((p): p is SeoPage => Boolean(p));

  return (
    <div className="min-h-full flex flex-col bg-bg">
      <FaqStructuredData faqs={page.faqs} />

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
          <p className="font-sans text-[12px] font-semibold tracking-[0.18em] uppercase text-blue">{page.eyebrow}</p>
          <h1 className="font-sans font-extrabold text-[38px] leading-[1.08] tracking-[-0.02em] text-ink mt-2">{page.h1}</h1>
          <p className="font-sans text-[16px] text-ink2 leading-relaxed mt-4">{page.intro}</p>

          <div className="mt-6 flex gap-3">
            <Link href="/login?mode=signup" className="font-sans text-[13.5px] font-semibold text-white bg-blue rounded-lg px-4 py-2.5 hover:bg-blue2">Start protecting your team</Link>
            <Link href="/#demo" className="font-sans text-[13.5px] font-semibold text-ink2 border border-line rounded-lg px-4 py-2.5 hover:text-ink">Book a demo</Link>
          </div>

          {page.sections.map((s, i) => (
            <section key={i} className="mt-11">
              <h2 className="font-sans font-bold text-[22px] tracking-[-0.01em] text-ink">{s.h2}</h2>
              {s.body.map((p, j) => (
                <p key={j} className="font-sans text-[15px] text-ink2 leading-relaxed mt-3">{p}</p>
              ))}
              {s.bullets && (
                <ul className="mt-3 flex flex-col gap-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="font-sans text-[14.5px] text-ink2 leading-relaxed flex gap-2.5">
                      <span className="text-blue mt-0.5">▸</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-12">
            <h2 className="font-sans font-bold text-[22px] tracking-[-0.01em] text-ink">Frequently asked questions</h2>
            <div className="mt-4 flex flex-col divide-y divide-line border-t border-line">
              {page.faqs.map((f, i) => (
                <div key={i} className="py-4">
                  <h3 className="font-sans font-semibold text-[15px] text-ink">{f.q}</h3>
                  <p className="font-sans text-[14.5px] text-ink2 leading-relaxed mt-1.5">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-line bg-card p-6">
            <h2 className="font-sans font-bold text-[19px] text-ink">{page.ctaTitle}</h2>
            <p className="font-sans text-[14px] text-ink2 mt-1.5">{page.ctaBody}</p>
            <Link href="/login?mode=signup" className="inline-block mt-4 font-sans text-[13.5px] font-semibold text-white bg-blue rounded-lg px-4 py-2.5 hover:bg-blue2">Get started</Link>
          </section>

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="font-sans font-bold text-[16px] text-ink">Related</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/${r.slug}`} className="font-sans text-[14px] text-blue hover:underline">{r.linkLabel}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

      <footer className="border-t border-line bg-bg2">
        <div className="max-w-[900px] mx-auto px-6 py-8 flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3"><Brand size={16} /><span className="text-[12px] text-ink3">&copy; 2026 StileAI</span></div>
          <nav className="flex items-center gap-4 text-[12.5px] text-ink2">
            <Link href="/" className="hover:text-ink">Home</Link>
            <Link href="/blog" className="hover:text-ink">Blog</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
