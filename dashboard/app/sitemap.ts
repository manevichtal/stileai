import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { SEO_PAGES } from "@/lib/seoContent";

const SITE_URL = "https://stileai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    // Keyword landing pages — high priority, these are the pages meant to rank.
    ...SEO_PAGES.map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
