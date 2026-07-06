"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { inputCls } from "@/components/ui";

export function AuditFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/audit?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <input
        defaultValue={sp.get("actor") ?? ""}
        onKeyDown={(e) => { if (e.key === "Enter") update("actor", (e.target as HTMLInputElement).value); }}
        onBlur={(e) => update("actor", e.target.value)}
        className={inputCls("w-[200px]")}
        placeholder="filter by actor (e.g. agent:bot)"
      />
      <select value={sp.get("effect") ?? ""} onChange={(e) => update("effect", e.target.value)} className={inputCls()}>
        <option value="">any effect</option>
        <option value="allow">allow</option>
        <option value="deny">deny</option>
        <option value="require_approval">require_approval</option>
      </select>
      <input type="date" defaultValue={sp.get("since") ?? ""} onChange={(e) => update("since", e.target.value)} className={inputCls()} title="on or after this date" />
      {(sp.get("actor") || sp.get("effect") || sp.get("since")) && (
        <button onClick={() => router.push("/audit")} className="font-mono text-[11.5px] text-ink3 hover:text-slate">clear</button>
      )}
    </div>
  );
}
