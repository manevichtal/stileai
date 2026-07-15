import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLanding } from "@/components/SeoLanding";
import { SEO_PAGES, getSeoPage } from "@/lib/seoContent";

// One route serving every keyword landing page. Only the known slugs are built
// (dynamicParams = false), so any other single-segment path 404s as usual and
// explicit routes like /blog, /login, /guide always win.
export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ seoSlug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ seoSlug: string }> }): Promise<Metadata> {
  const { seoSlug } = await params;
  const page = getSeoPage(seoSlug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "article",
      url: `/${page.slug}`,
      title: page.metaTitle,
      description: page.metaDescription,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription, images: ["/og.png"] },
  };
}

export default async function Page({ params }: { params: Promise<{ seoSlug: string }> }) {
  const { seoSlug } = await params;
  const page = getSeoPage(seoSlug);
  if (!page) notFound();
  return <SeoLanding page={page} />;
}
