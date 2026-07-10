import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-col bg-bg">
      <header className="border-b border-line bg-card">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Brand size={20} />
          </Link>
          <nav className="flex items-center gap-5 font-sans">
            <span className="text-[13px] font-semibold text-ink">Blog</span>
            <Link
              href="/login"
              className="text-[13px] font-medium text-ink2 hover:text-ink transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="text-[13px] font-semibold text-white bg-blue rounded-lg px-3.5 py-2 hover:bg-blue2 transition-colors"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[760px] mx-auto px-6 py-12">{children}</div>
      </main>

      <footer className="border-t border-line bg-bg2">
        <div className="max-w-[900px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3">
            <Brand size={16} />
            <span className="text-[12px] text-ink3">&copy; 2026 StileAI</span>
          </div>
          <nav className="flex items-center gap-4 text-[12.5px] text-ink2">
            <Link href="/" className="hover:text-ink transition-colors">
              Home
            </Link>
            <Link href="/blog" className="hover:text-ink transition-colors">
              Blog
            </Link>
            <Link href="/login" className="hover:text-ink transition-colors">
              Log in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
