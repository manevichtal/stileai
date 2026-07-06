"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/policies", label: "Policies", icon: "policies" },
  { href: "/audit", label: "Audit log", icon: "audit" },
  { href: "/approvals", label: "Approvals", icon: "approvals" },
  { href: "/keys", label: "API keys", icon: "keys" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppShell({
  orgName,
  email,
  isPlatformAdmin = false,
  children,
}: {
  orgName: string;
  email: string | null;
  isPlatformAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex-1 flex min-h-full">
      {/* Dark rail */}
      <aside className="w-[228px] flex-none bg-rail flex flex-col text-railink">
        <div className="px-5 pt-6 pb-5">
          <Image
            src="/brandmark.png"
            alt="StileAI"
            width={112}
            height={32}
            priority
            className="h-[26px] w-auto"
          />
        </div>

        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-[13.5px] transition-colors ${
                  active
                    ? "bg-white text-ink font-semibold"
                    : "text-railink hover:bg-railhov hover:text-white"
                }`}
              >
                <span className={active ? "text-blue" : "text-railicon group-hover:text-white"}>
                  <Icon name={item.icon} size={19} />
                </span>
                {item.label}
              </Link>
            );
          })}

          {isPlatformAdmin && (
            <>
              <div className="mt-4 mb-1.5 px-3 font-mono text-[9.5px] text-railmut uppercase tracking-[0.14em]">
                Platform owner
              </div>
              <Link
                href="/admin"
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-[13.5px] transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-white text-ink font-semibold"
                    : "text-railink hover:bg-railhov hover:text-white"
                }`}
              >
                <span className={pathname.startsWith("/admin") ? "text-blue" : "text-railicon group-hover:text-white"}>
                  <Icon name="tenants" size={19} />
                </span>
                All tenants
              </Link>
            </>
          )}
        </nav>

        <div className="p-3 m-3 mt-0 rounded-xl bg-railhov">
          <div className="font-sans text-[12.5px] text-white truncate">{orgName || "Your org"}</div>
          <div className="font-mono text-[10.5px] text-railmut truncate mb-2.5">{email}</div>
          <SignOutButton className="flex items-center gap-1.5 font-mono text-[11px] text-railicon hover:text-white transition-colors">
            <Icon name="signout" size={14} /> Sign out
          </SignOutButton>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 flex flex-col bg-bg3">{children}</main>
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
    <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-5">
      <div>
        <h1 className="font-sans font-bold text-[22px] tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-[12.5px] text-ink3 mt-1">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
