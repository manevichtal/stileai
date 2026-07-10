import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical writing on AI security, data leakage, and safe AI adoption from StileAI.",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <main>
      <h1 className="font-sans text-[26px] font-extrabold tracking-tight text-ink mb-2">
        Blog
      </h1>
      <p className="font-sans text-[14px] text-ink2 mb-8">
        Practical writing on AI security, data leakage, and safe AI adoption.
      </p>

      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="bg-card border border-line rounded-2xl p-6 hover:border-line2 transition-colors"
          >
            <h2 className="font-sans text-[17px] font-bold text-ink mb-1.5">
              <Link href={`/blog/${post.slug}`} className="hover:text-blue transition-colors">
                {post.title}
              </Link>
            </h2>
            <div className="font-sans text-[12px] text-ink3 mb-3 flex items-center gap-2">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span aria-hidden>&middot;</span>
              <span>{post.readingMinutes} min read</span>
            </div>
            <p className="font-sans text-[13.5px] text-ink2 leading-relaxed mb-3">
              {post.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-sans text-[11px] font-medium text-ink2 bg-bg2 border border-line rounded-full px-2.5 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
