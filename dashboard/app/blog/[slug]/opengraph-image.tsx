import { ImageResponse } from "next/og";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "StileAI";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.meta.title ?? "StileAI";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#1953F0",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 26,
              height: 26,
              border: "4px solid #1953F0",
              transform: "rotate(45deg)",
            }}
          />
          <span>StileAI</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 62,
            fontWeight: 800,
            color: "#181B1E",
            lineHeight: 1.12,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            color: "#5E656E",
          }}
        >
          <span style={{ color: "#9197A1" }}>stileai.com</span>
          <span style={{ color: "#C0C4CB" }}>·</span>
          <span>The policy checkpoint between your team and AI</span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "#1953F0",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
