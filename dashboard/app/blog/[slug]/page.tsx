import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPosts, getAllSlugs, getPostBySlug } from "@/lib/blog";

const SITE_URL = "https://stileai.vercel.app";

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const { meta } = post;
  const url = `${SITE_URL}/blog/${slug}`;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      url,
      siteName: "StileAI",
      publishedTime: meta.date,
      authors: [meta.author],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { meta, html } = post;
  const url = `${SITE_URL}/blog/${slug}`;
  const relatedPosts = getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    dateModified: meta.date,
    author: { "@type": "Organization", name: "StileAI" },
    publisher: {
      "@type": "Organization",
      name: "StileAI",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/brandmark.png` },
    },
    mainEntityOfPage: url,
    keywords: meta.keywords.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/blog"
        className="font-sans text-[13px] font-medium text-ink2 hover:text-ink transition-colors inline-flex items-center gap-1 mb-6"
      >
        &larr; Back to blog
      </Link>

      <article>
        <h1 className="font-sans text-[28px] font-extrabold tracking-tight text-ink mb-3 leading-tight">
          {meta.title}
        </h1>
        <div className="font-sans text-[12.5px] text-ink3 mb-8">
          <time dateTime={meta.date}>{formatDate(meta.date)}</time>
          {" · "}
          {meta.author}
          {" · "}
          {meta.readingMinutes} min read
        </div>

        <div className="blogprose" dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      {relatedPosts.length > 0 && (
        <div className="mt-12">
          <h2 className="font-sans text-[15px] font-bold text-ink mb-4">
            More from the blog
          </h2>
          <div className="flex flex-col gap-4">
            {relatedPosts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block bg-card border border-line rounded-2xl p-6 hover:border-line2 transition-colors"
              >
                <h3 className="font-sans text-[15px] font-bold text-ink mb-1.5 hover:text-blue transition-colors">
                  {p.title}
                </h3>
                <time
                  dateTime={p.date}
                  className="font-sans text-[12px] text-ink3"
                >
                  {formatDate(p.date)}
                </time>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 bg-card border border-line rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="font-sans text-[14.5px] font-semibold text-ink">
          Stop sensitive data reaching AI tools before it leaves.
        </p>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/"
            className="font-sans text-[13px] font-medium text-ink2 hover:text-ink transition-colors"
          >
            See how it works
          </Link>
          <Link
            href="/login?mode=signup"
            className="font-sans text-[13px] font-semibold text-white bg-blue rounded-lg px-3.5 py-2 hover:bg-blue2 transition-colors whitespace-nowrap"
          >
            Get started
          </Link>
        </div>
      </div>
    </>
  );
}
