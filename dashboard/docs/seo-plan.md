# StileAI SEO plan

Plain-language record of what we did for search, and what comes next. No code needed to act on this.

## What is now live

**Structured data (JSON-LD)** on every page so Google understands what StileAI is:
- Organization + logo
- WebSite with a sitewide search box
- SoftwareApplication (product, category "SecurityApplication", price)
- FAQPage on every keyword page (these can win the expandable Q&A boxes in Google)

**Keyword landing pages** (crawlable, content-rich, server-rendered):
- `/ai-data-loss-prevention` - "AI DLP"
- `/prevent-chatgpt-data-leaks` - "ChatGPT data leak"
- `/shadow-ai` - "shadow AI"
- `/ai-governance` - "AI governance / acceptable use enforcement"
- `/enterprise-ai-security` - pillar page for "enterprise AI security"
- `/ai-compliance` - "AI compliance / SOC 2 / GDPR / HIPAA"
- `/prevent-source-code-leaks-ai` - "source code leaks in Copilot / Cursor"

They cross-link (hub and spoke) so ranking strength flows between them.

**Social share image** (`/og.png`, 1200x630) so a shared StileAI link shows a branded card, not a bare wordmark.

**Sitemap + robots** already in place; the new pages are in the sitemap at high priority.

## Honest expectations

We will not instantly rank #1 for a giant head term like "AI security." Those are owned by big vendors with years of backlinks. The winnable plays are the specific, high-intent phrases above (someone searching "prevent ChatGPT data leaks" is close to buying). New pages typically take a few weeks to months to climb as Google crawls and trust builds.

## Next steps (need the founder)

1. **Google Search Console** - the code side is wired (env var `GOOGLE_SITE_VERIFICATION`). Follow `docs/search-console-setup.md`: 5 minutes, you paste one value into Vercel and click Verify, then submit the sitemap.
2. **Backlinks** - the single biggest ranking lever. `docs/backlink-kit.md` has the exact directories to submit to and copy-paste descriptions, plus a Product Hunt launch checklist. Work it top to bottom.

## Recently added

- **Social image** - `/og.png` (1200x630) branded card for shared links.
- **3 more keyword pages** - enterprise-ai-security (pillar), ai-compliance, prevent-source-code-leaks-ai. Seven total now.
- **3 new blog posts** - "Does ChatGPT train on my data?", "SOC 2 and AI", "ChatGPT/Claude/Gemini/Copilot data handling."
- **Search Console wiring** - verification meta tag driven by env var, no code editing needed to verify.

## Next steps (I can do)

- Add more keyword pages as we spot winnable phrases in Search Console.
- Keep the blog cadence going (one post every week or two).
- Draft the Product Hunt copy and screenshot captions when you are ready to launch.
