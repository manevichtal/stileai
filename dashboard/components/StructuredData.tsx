// JSON-LD structured data. Helps Google understand StileAI as an entity (the
// Organization + product), enables the sitelinks search box, and lets keyword
// pages emit FAQ rich results. Rendered as <script type="application/ld+json">.
//
// Kept as plain server components (no client JS) so the markup is in the initial
// HTML that crawlers read.

const SITE = "https://stileai.com";

function Json({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not user input; safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Site-wide: who StileAI is, the website, and the product. Put once in the root layout.
export function SiteStructuredData() {
  return (
    <>
      <Json
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "StileAI",
          url: SITE,
          logo: `${SITE}/apple-icon.png`,
          description:
            "StileAI is the security checkpoint between a company's team and the AI tools they use, checking every prompt against policy before secrets, PII, or source code can leave.",
          sameAs: [] as string[],
        }}
      />
      <Json
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "StileAI",
          url: SITE,
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${SITE}/blog?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <Json
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "StileAI",
          applicationCategory: "SecurityApplication",
          operatingSystem: "Web, Chrome, macOS, Windows",
          description:
            "AI data-loss prevention. StileAI checks every request your team sends to ChatGPT, Claude, Gemini, Cursor and Copilot against your policies and blocks or holds anything sensitive before it leaves.",
          offers: {
            "@type": "Offer",
            price: "25",
            priceCurrency: "USD",
            description: "Per seat, per month. Starter plan.",
          },
        }}
      />
    </>
  );
}

// Per-page FAQ rich-result markup.
export function FaqStructuredData({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <Json
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}
