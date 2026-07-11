import type { MetadataRoute } from "next";

const SITE_URL = "https://stileai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api/",
        "/admin",
        "/settings",
        "/billing",
        "/team",
        "/keys",
        "/audit",
        "/approvals",
        "/policies",
        "/complete-setup",
        "/login",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
