import type { NextConfig } from "next";

// Security response headers applied to every route. These are the low-risk,
// high-signal controls a pen test / SOC 2 review expects. CSP intentionally
// allows 'unsafe-inline' because the marketing landing (public/landing.html)
// ships inline <script>/<style>; it still blocks object/base/frame-ancestor
// abuse and pins connect/img/font sources. Tighten script-src to nonces once
// the inline landing is refactored.
const SUPABASE = "https://*.supabase.co wss://*.supabase.co";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE} https://api.stripe.com`,
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // StileAI dashboard. Deployed on Vercel with Root Directory = "dashboard".
  // Serve the public marketing landing at "/"; the portal lives at "/dashboard".
  async rewrites() {
    return [{ source: "/", destination: "/landing.html" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

// build: framework preset = Next.js
