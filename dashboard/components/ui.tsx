import React from "react";

// Small shared UI primitives in the StileAI console aesthetic. Kept dependency-free.

export function EffectBadge({ effect }: { effect: string }) {
  const map: Record<string, string> = {
    allow: "text-blue bg-[rgba(25,83,240,.09)] border-[rgba(25,83,240,.26)]",
    require_approval:
      "text-ink3 bg-[rgba(145,151,161,.12)] border-[rgba(145,151,161,.3)]",
    deny: "text-slate bg-[rgba(24,27,30,.07)] border-[rgba(24,27,30,.24)]",
  };
  const label: Record<string, string> = {
    allow: "ALLOW",
    require_approval: "APPROVAL",
    deny: "DENY",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[5px] text-[10.5px] font-semibold tracking-wide border font-sans ${
        map[effect] ?? map.require_approval
      }`}
    >
      {label[effect] ?? effect.toUpperCase()}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "text-blue bg-[rgba(25,83,240,.09)] border-[rgba(25,83,240,.26)]",
    pending: "text-ink3 bg-[rgba(145,151,161,.12)] border-[rgba(145,151,161,.3)]",
    denied: "text-slate bg-[rgba(24,27,30,.07)] border-[rgba(24,27,30,.24)]",
    allowed: "text-blue bg-[rgba(25,83,240,.09)] border-[rgba(25,83,240,.26)]",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[5px] text-[10.5px] font-semibold tracking-wide border font-sans ${
        map[status] ?? map.pending
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border border-line rounded-[14px] ${className}`}
    >
      {children}
    </div>
  );
}

export function inputCls(extra = "") {
  return `font-sans text-[12.5px] text-ink bg-bg2 border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-blue focus:bg-card transition-colors ${extra}`;
}

export function labelCls() {
  return "font-sans text-[11px] text-ink2 font-medium";
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans text-[12.5px] text-ink3 py-10 text-center">
      {children}
    </div>
  );
}
