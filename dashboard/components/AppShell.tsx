"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { SignOutButton } from "@/components/SignOutButton";

type NavItem = { href: string; label: string; icon: string; desc: string };
type NavGroup = { key: string; label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "top",
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: "home", desc: "Live activity and health at a glance" },
      { href: "/guide", label: "Getting started", icon: "book", desc: "Connect the extension and your first policy" },
    ],
  },
  {
    key: "governance",
    label: "Governance",
    items: [
      { href: "/policies", label: "Policies", icon: "policies", desc: "Rules that allow, ask, or block a request" },
      { href: "/tester", label: "Policy tester", icon: "spark", desc: "Try a prompt against your live policies" },
      { href: "/audit", label: "Audit log", icon: "audit", desc: "Every decision, with the reason it was made" },
      { href: "/approvals", label: "Approvals", icon: "approvals", desc: "Pending requests waiting on a human" },
    ],
  },
  {
    key: "access",
    label: "Access & data",
    items: [
      { href: "/keys", label: "API keys", icon: "keys", desc: "Keys the extension and gateway authenticate with" },
      { href: "/team", label: "Team & seats", icon: "tenants", desc: "Invite users and track seats in use" },
      { href: "/trust", label: "Trust & security", icon: "check", desc: "Standards you map to and how data is handled" },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { href: "/billing", label: "Billing", icon: "payment", desc: "Plan, seats, and invoices" },
      { href: "/settings", label: "Settings", icon: "settings", desc: "Organization name and configuration" },
    ],
  },
];

const PLATFORM_GROUP: NavGroup = {
  key: "platform",
  label: "Platform owner",
  items: [{ href: "/admin", label: "All tenants", icon: "tenants", desc: "Every organization on the platform" }],
};

type Tip = { desc: string; top: number } | null;

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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const groups = useMemo(
    () => (isPlatformAdmin ? [...NAV_GROUPS, PLATFORM_GROUP] : NAV_GROUPS),
    [isPlatformAdmin],
  );

  // Collapsible sections. Default: every group open. Persisted per user.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("stile-nav-closed");
      if (raw) setClosed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Never leave the active item hidden inside a collapsed group.
  useEffect(() => {
    const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href)));
    if (activeGroup && closed[activeGroup.key]) {
      setClosed((c) => {
        const next = { ...c, [activeGroup.key]: false };
        try {
          localStorage.setItem("stile-nav-closed", JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(key: string) {
    setClosed((c) => {
      const next = { ...c, [key]: !c[key] };
      try {
        localStorage.setItem("stile-nav-closed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Dark rail — fixed full height; only the content column scrolls */}
      <aside className="w-[228px] flex-none bg-rail flex flex-col text-railink h-dvh relative">
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

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 flex flex-col gap-1 pb-3">
          {groups.map((group) => {
            const open = !closed[group.key];
            return (
              <div key={group.key} className="flex flex-col">
                {group.label && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="group/head flex items-center justify-between px-3 pt-3 pb-1.5 font-sans text-[9.5px] text-railmut hover:text-railink uppercase tracking-[0.14em] transition-colors"
                  >
                    <span>{group.label}</span>
                    <span
                      className={`text-railmut/70 group-hover/head:text-railink transition-transform duration-200 motion-reduce:transition-none ${
                        open ? "rotate-0" : "-rotate-90"
                      }`}
                    >
                      <Icon name="chevron" size={13} />
                    </span>
                  </button>
                )}
                <div
                  className="grid transition-all duration-200 ease-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => (
                        <NavRow
                          key={item.href}
                          item={item}
                          active={isActive(item.href)}
                          onTip={setTip}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mx-4 mt-1 py-4 border-t border-white/10">
          <div className="font-sans text-[12.5px] text-white/90 font-medium truncate">{orgName || "Your org"}</div>
          <div className="font-sans text-[10.5px] text-railmut truncate">{email}</div>
          <SignOutButton className="flex items-center gap-1.5 mt-3 font-sans text-[11px] text-railmut hover:text-white transition-colors">
            <Icon name="signout" size={13} /> Sign out
          </SignOutButton>
        </div>
      </aside>

      {/* Hover tooltip — fixed to the viewport so it never clips the scroll rail */}
      {tip && (
        <div
          className="fixed z-50 pointer-events-none -translate-y-1/2 rounded-lg border border-line bg-card px-2.5 py-1.5 font-sans text-[11.5px] text-ink2 shadow-[0_8px_24px_-10px_rgba(16,24,40,.4)] max-w-[220px] animate-[navtip_.12s_ease-out]"
          style={{ left: 236, top: tip.top }}
        >
          {tip.desc}
        </div>
      )}
      <style>{`@keyframes navtip{from{opacity:0;transform:translate(-4px,-50%)}to{opacity:1;transform:translate(0,-50%)}}`}</style>

      {/* Content — the only scrollable column */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-bg3">{children}</main>
    </div>
  );
}

function NavRow({
  item,
  active,
  onTip,
}: {
  item: NavItem;
  active: boolean;
  onTip: (t: Tip) => void;
}) {
  return (
    <Link
      href={item.href}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onTip({ desc: item.desc, top: r.top + r.height / 2 });
      }}
      onMouseLeave={() => onTip(null)}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-[13.5px] transition-all duration-150 motion-reduce:transition-none ${
        active
          ? "bg-white text-ink font-semibold"
          : "text-railink hover:bg-railhov hover:text-white hover:translate-x-0.5"
      }`}
    >
      {active && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue" />
      )}
      <span className={active ? "text-blue" : "text-railicon group-hover:text-white transition-colors"}>
        <Icon name={item.icon} size={19} />
      </span>
      {item.label}
    </Link>
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
          <p className="font-sans text-[12.5px] text-ink3 mt-1">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
