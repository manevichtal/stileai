"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/policies", label: "Policies" },
  { href: "/audit", label: "Audit log" },
  { href: "/approvals", label: "Approvals" },
  { href: "/keys", label: "API keys" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  orgName,
  email,
  children,
}: {
  orgName: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex-1 flex min-h-full">
      {/* Sidebar */}
      <aside className="w-[216px] flex-none border-r border-line bg-bg2 flex flex-col">
        <div className="px-4 py-4 border-b border-line flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="font-sans font-extrabold text-[17px] tracking-tight text-ink">
            StileAI
          </span>
        </div>

        <nav className="flex-1 p-2.5 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-mono text-[12.5px] rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-bluedim text-blue font-semibold"
                    : "text-ink2 hover:bg-bg3 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-line">
          <div className="font-mono text-[11px] text-ink3 truncate">{email}</div>
          <div className="font-mono text-[10.5px] text-ink4 truncate mb-2">
            {orgName}
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-line bg-bg2">
      <div>
        <h1 className="font-sans font-bold text-[18px] tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-[12px] text-ink3 mt-1">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
