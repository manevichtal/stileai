import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StileAI dashboard. Deployed on Vercel with Root Directory = "dashboard".
  // Serve the public marketing landing at "/"; the portal lives at "/dashboard".
  async rewrites() {
    return [{ source: "/", destination: "/landing.html" }];
  },
};

export default nextConfig;

// build: framework preset = Next.js
