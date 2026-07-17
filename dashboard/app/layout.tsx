import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteStructuredData } from "@/components/StructuredData";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stileai.com"),
  title: {
    default: "StileAI: the policy checkpoint between your team and AI",
    template: "%s · StileAI",
  },
  description:
    "StileAI checks every AI request your team sends and blocks secrets, customer data, and source code before they reach ChatGPT, Claude, Gemini, or Copilot.",
  openGraph: {
    type: "website",
    siteName: "StileAI",
    url: "https://stileai.com",
    title: "StileAI: the policy checkpoint between your team and AI",
    description:
      "Check every AI request against your policies before it reaches ChatGPT, Claude, Gemini, or Copilot.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "StileAI: the policy checkpoint between your team and the AI they use" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StileAI",
    description: "The policy checkpoint between your team and the AI they use.",
    images: ["/og.png"],
  },
  // Favicons live at versioned /public paths (not the app/icon.svg convention)
  // so a filename change forces every browser to refetch instead of showing a
  // stale cached icon. PNGs cover clients that render SVG favicons poorly.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  // Google Search Console verification. Set GOOGLE_SITE_VERIFICATION in Vercel
  // to the content value Google gives you; the meta tag then renders itself.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <SiteStructuredData />
        {children}
      </body>
    </html>
  );
}
