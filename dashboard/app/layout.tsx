import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stileai.vercel.app"),
  title: {
    default: "StileAI — the policy checkpoint between your team and AI",
    template: "%s · StileAI",
  },
  description:
    "StileAI checks every AI request your team sends and blocks secrets, customer data, and source code before they reach ChatGPT, Claude, Gemini, or Copilot.",
  openGraph: {
    type: "website",
    siteName: "StileAI",
    url: "https://stileai.vercel.app",
    title: "StileAI — the policy checkpoint between your team and AI",
    description:
      "Check every AI request against your policies before it reaches ChatGPT, Claude, Gemini, or Copilot.",
    images: ["/brandmark.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "StileAI",
    description: "The policy checkpoint between your team and the AI they use.",
    images: ["/brandmark.png"],
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
