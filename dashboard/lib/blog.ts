import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  keywords: string[];
  tags: string[];
  readingMinutes: number;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function readPostFile(slug: string): { meta: PostMeta; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  const meta: PostMeta = {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    author: data.author,
    keywords: data.keywords ?? [],
    tags: data.tags ?? [],
    readingMinutes,
  };

  return { meta, content };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getAllPosts(): PostMeta[] {
  return getAllSlugs()
    .map((slug) => readPostFile(slug)?.meta)
    .filter((meta): meta is PostMeta => Boolean(meta))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getPostBySlug(slug: string): { meta: PostMeta; html: string } | null {
  const post = readPostFile(slug);
  if (!post) return null;
  const html = marked.parse(post.content) as string;
  return { meta: post.meta, html };
}
