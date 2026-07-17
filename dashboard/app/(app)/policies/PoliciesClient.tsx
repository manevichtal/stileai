"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EffectBadge, inputCls, labelCls } from "@/components/ui";
import {
  savePolicy,
  deletePolicy,
  deletePolicies,
  updateDefaults,
  updateFallbackMode,
  updateEnforcementMode,
  addPack,
  setCategoryEffect,
  applyProtectionLevel,
  applyCompliancePreset,
  addCustomTerm,
  type PolicyInput,
  type Condition,
} from "./actions";
import { POLICY_PACKS, PACK_CATEGORIES, type PolicyPack } from "@/lib/policyTemplates";
import { packAllowed } from "@/lib/tiers";
import { daysLeft } from "@/lib/enforcementMode";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  EFFECT_LABEL,
  PROTECTION_LEVELS,
  COMPLIANCE_PRESETS,
  effectsFromPolicies,
  activeLevelKey,
  activePresetKey,
  type Effect,
} from "@/lib/protection";
import type { Category } from "@/lib/promptCheck";

const OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "regex", "exists"];
const EFFECTS = ["allow", "deny", "require_approval"];

const blank = (): PolicyInput => ({
  policy_id: "",
  effect: "require_approval",
  priority: 100,
  actor: "*",
  action: "*",
  resource: "*",
  approvals_required: 1,
  conditions: [],
  description: "",
  enabled: true,
});

export function PoliciesClient({
  policies,
  defaultEffect,
  defaultReason,
  fallbackMode,
  enforcementMode,
  monitorUntil,
  existingIds,
  initialTab = "rules",
  plan,
}: {
  policies: PolicyInput[];
  defaultEffect: string;
  defaultReason: string;
  fallbackMode: "availability" | "hold" | "flag";
  enforcementMode: "enforce" | "monitor";
  monitorUntil: string | null;
  existingIds: string[];
  initialTab?: "rules" | "library";
  plan: string | null;
}) {
  const router = useRouter();
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="px-8 pb-10 w-full">
      {advanced ? (
        <AdvancedView
          policies={policies}
          defaultEffect={defaultEffect}
          defaultReason={defaultReason}
          fallbackMode={fallbackMode}
          enforcementMode={enforcementMode}
          monitorUntil={monitorUntil}
          existingIds={existingIds}
          initialTab={initialTab}
          plan={plan}
          router={router}
          onBack={() => setAdvanced(false)}
        />
      ) : (
        <SimpleProtection
          policies={policies}
          enforcementMode={enforcementMode}
          monitorUntil={monitorUntil}
          onAdvanced={() => setAdvanced(true)}
          router={router}
        />
      )}
    </div>
  );
}

// ===========================================================================
// SIMPLE VIEW: the default. Protection levels, a 7-category grid, compliance
// presets, and a live "what your team will experience" preview.
// ===========================================================================

function SimpleProtection({
  policies,
  enforcementMode,
  monitorUntil,
  onAdvanced,
  router,
}: {
  policies: PolicyInput[];
  enforcementMode: "enforce" | "monitor";
  monitorUntil: string | null;
  onAdvanced: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [effects, setEffects] = useState<Record<Category, Effect>>(() => effectsFromPolicies(policies));
  const [busy, setBusy] = useState<string | null>(null);

  const activeLevel = activeLevelKey(effects, enforcementMode);
  const activePreset = activePresetKey(effects);

  async function chooseCategory(cat: Category, eff: Effect) {
    setEffects((e) => ({ ...e, [cat]: eff }));
    await setCategoryEffect(cat, eff);
    router.refresh();
  }
  async function chooseLevel(key: string) {
    const level = PROTECTION_LEVELS.find((l) => l.key === key);
    if (!level) return;
    setBusy("level:" + key);
    setEffects({ ...level.map });
    await applyProtectionLevel(key);
    setBusy(null);
    router.refresh();
  }
  async function choosePreset(key: string) {
    const preset = COMPLIANCE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setBusy("preset:" + key);
    setEffects({ ...preset.map });
    await applyCompliancePreset(key);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="max-w-[940px] flex flex-col gap-7">
      <EnforcementBar mode={enforcementMode} monitorUntil={monitorUntil} onSaved={() => router.refresh()} />

      {/* Protection levels */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-sans font-bold text-[15px] text-ink">Pick a protection level</h2>
          <p className="font-sans text-[12px] text-ink3 mt-0.5">One click sets everything below. You can fine-tune afterward.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROTECTION_LEVELS.map((lvl) => {
            const active = activeLevel === lvl.key;
            return (
              <button
                key={lvl.key}
                onClick={() => chooseLevel(lvl.key)}
                disabled={busy === "level:" + lvl.key}
                className={`text-left rounded-2xl border p-4 transition-colors ${
                  active ? "border-blue bg-bluedim" : "border-line bg-card hover:border-line2"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-sans font-bold text-[14px] text-ink">{lvl.name}</span>
                  {lvl.recommended && (
                    <span className="font-sans text-[9px] uppercase tracking-wide text-blue bg-white border border-blue/30 rounded px-1.5 py-0.5">Recommended</span>
                  )}
                  {active && <span className="ml-auto font-sans text-[11px] text-blue font-semibold">Active</span>}
                </div>
                <p className="font-sans text-[11.5px] text-ink2 leading-relaxed mt-1.5">{lvl.tagline}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Category grid */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-sans font-bold text-[15px] text-ink">What should happen to each kind of sensitive content?</h2>
          <p className="font-sans text-[12px] text-ink3 mt-0.5">
            When your team sends one of these to an AI tool, StileAI can allow it, ask an admin first, or block it.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card divide-y divide-line overflow-hidden">
          {CATEGORY_ORDER.map((cat) => (
            <CategoryRow key={cat} cat={cat} value={effects[cat]} onChange={(e) => chooseCategory(cat, e)} />
          ))}
        </div>
      </section>

      {/* Compliance presets */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-sans font-bold text-[15px] text-ink">Need to match a compliance framework?</h2>
          <p className="font-sans text-[12px] text-ink3 mt-0.5">
            One click sets the protections the framework expects. You can still adjust any row after.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {COMPLIANCE_PRESETS.map((p) => (
            <CompliancePresetRow
              key={p.key}
              preset={p}
              active={activePreset === p.key}
              busy={busy === "preset:" + p.key}
              onApply={() => choosePreset(p.key)}
            />
          ))}
        </div>
      </section>

      {/* Custom terms */}
      <CustomTerms terms={policies.filter((p) => p.action === "custom_term")} router={router} />

      {/* Live preview */}
      <LivePreview effects={effects} monitor={enforcementMode === "monitor"} />

      <div className="pt-1">
        <button onClick={onAdvanced} className="font-sans text-[12.5px] text-ink3 hover:text-ink underline underline-offset-2">
          Advanced settings and rules
        </button>
      </div>
    </div>
  );
}

const SEG: { key: Effect; tone: string }[] = [
  { key: "allow", tone: "#0f7a3d" },
  { key: "require_approval", tone: "#b8791a" },
  { key: "deny", tone: "#b02a37" },
];

function CategoryRow({ cat, value, onChange }: { cat: Category; value: Effect; onChange: (e: Effect) => void }) {
  const meta = CATEGORY_META[cat];
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="font-sans font-semibold text-[13.5px] text-ink">{meta.label}</div>
        <div className="font-sans text-[11.5px] text-ink3 mt-0.5">
          {meta.short}. <span className="text-ink4">e.g. {meta.example}</span>
        </div>
      </div>
      <div className="flex-none flex rounded-lg border border-line overflow-hidden">
        {SEG.map((opt) => {
          const selected = value === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className="font-sans text-[12px] font-semibold px-3 py-1.5 border-l first:border-l-0 border-line transition-colors"
              style={
                selected
                  ? { background: opt.tone, color: "#fff" }
                  : { background: "transparent", color: "#5e656e" }
              }
            >
              {EFFECT_LABEL[opt.key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompliancePresetRow({
  preset,
  active,
  busy,
  onApply,
}: {
  preset: (typeof COMPLIANCE_PRESETS)[number];
  active: boolean;
  busy: boolean;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-4 ${active ? "border-blue bg-bluedim" : "border-line bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-[13.5px] text-ink">{preset.name}</span>
            <span className="font-sans text-[10.5px] text-ink3">{preset.framework}</span>
            {active && <span className="font-sans text-[10.5px] text-blue font-semibold">Applied</span>}
          </div>
          <p className="font-sans text-[11.5px] text-ink2 leading-relaxed mt-1">{preset.summary}</p>
        </div>
        <button
          onClick={onApply}
          disabled={busy}
          className={`flex-none font-sans font-semibold text-[12px] rounded-lg px-3.5 py-2 disabled:opacity-50 ${
            active ? "bg-bg2 border border-line text-ink2 hover:bg-bg3" : "bg-blue text-white hover:opacity-90"
          }`}
        >
          {busy ? "Applying…" : active ? "Re-apply" : "Apply"}
        </button>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="font-sans text-[11px] text-blue hover:underline mt-2">
        {open ? "Hide details" : "What this sets"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2.5">
          {CATEGORY_ORDER.map((cat) => (
            <li key={cat} className="flex items-center gap-2 font-sans text-[11.5px]">
              <span className="w-[190px] text-ink2">{CATEGORY_META[cat].label}</span>
              <EffectBadge effect={preset.map[cat] === "require_approval" ? "require_approval" : preset.map[cat]} />
              {preset.controls[cat] && <span className="text-ink4 text-[10.5px]">{preset.controls[cat]}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A handful of realistic prompts, pre-labeled with the categories they contain,
// so the preview shows the outcome of the CURRENT grid without running detection.
const PREVIEW_SAMPLES: { text: string; cats: Category[] }[] = [
  { text: "Use this to test the integration: sk_live_9f2a3c8b1d…", cats: ["secrets"] },
  { text: "Clean up our customer list: john@acme.com, +1 415 555 0148, …", cats: ["client_data", "pii"] },
  { text: "Draft a summary of our Q3 numbers: revenue $2.4M, margin 61%…", cats: ["financial"] },
  { text: "Refactor this module for me: export function auth(req){…}", cats: ["source_code"] },
  { text: "Explain how OAuth 2.0 refresh tokens work.", cats: [] },
];

const SEVERITY: Record<Effect, number> = { allow: 0, require_approval: 1, deny: 2 };

function outcomeFor(cats: Category[], effects: Record<Category, Effect>): Effect {
  let worst: Effect = "allow";
  for (const c of cats) if (SEVERITY[effects[c]] > SEVERITY[worst]) worst = effects[c];
  return worst;
}

function LivePreview({ effects, monitor }: { effects: Record<Category, Effect>; monitor: boolean }) {
  return (
    <section className="rounded-2xl border border-line bg-bg2 p-5">
      <h2 className="font-sans font-bold text-[14px] text-ink">What your team will experience</h2>
      <p className="font-sans text-[11.5px] text-ink3 mt-0.5">
        {monitor
          ? "You are in Watch mode, so nothing is blocked yet. This is what WOULD happen once you enforce."
          : "Based on your settings right now."}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {PREVIEW_SAMPLES.map((s, i) => {
          const eff = outcomeFor(s.cats, effects);
          const { label, color, bg } =
            eff === "deny"
              ? { label: "Blocked", color: "#b02a37", bg: "#fdecee" }
              : eff === "require_approval"
                ? { label: "Held for approval", color: "#8a5a12", bg: "#fff8ec" }
                : { label: "Allowed", color: "#0f7a3d", bg: "#e9f6ee" };
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-card border border-line px-3 py-2.5">
              <span className="font-mono text-[11px] text-ink2 truncate flex-1">{s.text}</span>
              <span
                className="flex-none font-sans text-[11px] font-semibold rounded-full px-2.5 py-1"
                style={{ color, background: monitor ? "#eef0f3" : bg }}
              >
                {monitor ? `Would be: ${label}` : label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Company-specific words to Block or Ask-an-admin on. Covers the sensitive things
// no generic category can know about: project codenames, internal domains, client
// names. Stored as policy rows (action "custom_term"); the term text is in resource.
function CustomTerms({ terms, router }: { terms: PolicyInput[]; router: ReturnType<typeof useRouter> }) {
  const [term, setTerm] = useState("");
  const [effect, setEffect] = useState<"deny" | "require_approval">("deny");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const clean = term.trim();
    if (clean.length < 2) { setError("Enter a term of at least 2 characters."); return; }
    setBusy(true); setError(null);
    const res = await addCustomTerm(clean, effect);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setTerm("");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-sans font-bold text-[15px] text-ink">Your own words to watch for</h2>
        <p className="font-sans text-[12px] text-ink3 mt-0.5">
          Add anything specific to your company that the categories above cannot know: project codenames,
          internal domains, client names. StileAI will act whenever a message contains one.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder='e.g. Project Titan, @internal.acme.com'
            className={inputCls("flex-1 min-w-[220px]")}
          />
          <select value={effect} onChange={(e) => setEffect(e.target.value as "deny" | "require_approval")} className={inputCls()}>
            <option value="deny">Block</option>
            <option value="require_approval">Ask an admin</option>
          </select>
          <button
            onClick={add}
            disabled={busy}
            className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-3.5 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add term"}
          </button>
        </div>
        {error && <div className="font-sans text-[11.5px]" style={{ color: "#b02a37" }}>{error}</div>}

        {terms.length === 0 ? (
          <p className="font-sans text-[11.5px] text-ink4">No custom terms yet. They are optional, but they are how you protect what is unique to you.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg2 pl-3 pr-2 py-1">
                <span className="font-mono text-[11.5px] text-ink">{t.resource}</span>
                <span
                  className="font-sans text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                  style={t.effect === "deny" ? { background: "#fdecee", color: "#b02a37" } : { background: "#fff8ec", color: "#8a5a12" }}
                >
                  {t.effect === "deny" ? "Block" : "Ask"}
                </span>
                <button
                  onClick={async () => { await deletePolicy(t.id!); router.refresh(); }}
                  aria-label={`Remove ${t.resource}`}
                  className="font-sans text-[13px] text-ink3 hover:text-slate leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ===========================================================================
// ADVANCED VIEW: the original power-user surface, unchanged: the raw rules
// table, defaults, fallback, and the full policy library.
// ===========================================================================

function AdvancedView({
  policies,
  defaultEffect,
  defaultReason,
  fallbackMode,
  enforcementMode,
  monitorUntil,
  existingIds,
  initialTab,
  plan,
  router,
  onBack,
}: {
  policies: PolicyInput[];
  defaultEffect: string;
  defaultReason: string;
  fallbackMode: "availability" | "hold" | "flag";
  enforcementMode: "enforce" | "monitor";
  monitorUntil: string | null;
  existingIds: string[];
  initialTab: "rules" | "library";
  plan: string | null;
  router: ReturnType<typeof useRouter>;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<PolicyInput | null>(null);
  const [tab, setTab] = useState<"rules" | "library">(initialTab);

  return (
    <div className={`flex flex-col gap-5 ${tab === "library" ? "w-full" : "max-w-[1000px]"}`}>
      <button onClick={onBack} className="self-start font-sans text-[12.5px] text-blue hover:underline">
        &larr; Back to simple view
      </button>
      <div className="flex gap-6 border-b border-line">
        {([["rules", "Your rules"], ["library", "Policy library"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`pb-2.5 -mb-px font-sans text-[13px] border-b-2 transition-colors ${
              tab === k ? "text-ink font-semibold border-blue" : "text-ink3 border-transparent hover:text-ink2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <PolicyLibrary existingIds={new Set(existingIds)} onChanged={() => router.refresh()} plan={plan} />
      ) : (
        <RulesTab
          policies={policies}
          defaultEffect={defaultEffect}
          defaultReason={defaultReason}
          fallbackMode={fallbackMode}
          enforcementMode={enforcementMode}
          monitorUntil={monitorUntil}
          editing={editing}
          setEditing={setEditing}
          router={router}
        />
      )}
    </div>
  );
}

function RulesTab({
  policies,
  defaultEffect,
  defaultReason,
  fallbackMode,
  enforcementMode,
  monitorUntil,
  editing,
  setEditing,
  router,
}: {
  policies: PolicyInput[];
  defaultEffect: string;
  defaultReason: string;
  fallbackMode: "availability" | "hold" | "flag";
  enforcementMode: "enforce" | "monitor";
  monitorUntil: string | null;
  editing: PolicyInput | null;
  setEditing: (p: PolicyInput | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const ids = policies.map((p) => p.id!).filter(Boolean);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(ids));
  async function bulkDelete() {
    setBulkBusy(true);
    await deletePolicies([...selected]);
    setBulkBusy(false);
    setSelected(new Set());
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-6">
      <EnforcementBar mode={enforcementMode} monitorUntil={monitorUntil} onSaved={() => router.refresh()} />
      <DefaultsBar defaultEffect={defaultEffect} defaultReason={defaultReason} onSaved={() => router.refresh()} />
      <FallbackBar mode={fallbackMode} onSaved={() => router.refresh()} />

      <div className="flex items-center justify-between">
        <p className="font-sans text-[12px] text-ink3">
          Rules are checked top-to-bottom by priority (lower number first). The
          first match wins; if nothing matches, the default above applies.
        </p>
        <button
          onClick={() => setEditing(blank())}
          className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-3.5 py-2 hover:opacity-90"
        >
          + Add rule
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-bluedim border border-blue/30 rounded-[12px] px-4 py-2.5">
          <span className="font-sans text-[12px] text-ink font-medium">{selected.size} selected</span>
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="font-sans text-[12px] font-semibold text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
            style={{ background: "#b02a37" }}
          >
            {bulkBusy ? "Deleting…" : `Delete ${selected.size} selected`}
          </button>
          <button onClick={() => setSelected(new Set())} className="font-sans text-[11.5px] text-ink3 hover:text-ink">Clear</button>
        </div>
      )}

      <div className="border border-line rounded-[14px] overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg2 border-b border-line">
              <th className="px-3.5 py-2.5 w-9">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all rules"
                  className="cursor-pointer align-middle"
                  disabled={ids.length === 0}
                />
              </th>
              {["Priority", "Rule", "Effect", "Matches", "", ""].map((h, i) => (
                <th key={i} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && (
              <tr>
                <td colSpan={7} className="font-sans text-[12.5px] text-ink3 text-center py-10">
                  No rules yet. Add one, or every request falls through to the default.
                </td>
              </tr>
            )}
            {policies.map((p) => (
              <tr key={p.id} className={`border-b border-line last:border-0 ${p.enabled ? "" : "opacity-45"} ${selected.has(p.id!) ? "bg-bluedim" : ""}`}>
                <td className="px-3.5 py-3 w-9">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id!)}
                    onChange={() => toggle(p.id!)}
                    aria-label={`Select ${p.policy_id}`}
                    className="cursor-pointer align-middle"
                  />
                </td>
                <td className="px-3.5 py-3 font-sans text-[12.5px] text-ink2">{p.priority}</td>
                <td className="px-3.5 py-3">
                  <div className="font-sans text-[12.5px] text-ink font-medium">{p.policy_id}</div>
                  {p.description && <div className="font-sans text-[11px] text-ink3 mt-0.5">{p.description}</div>}
                </td>
                <td className="px-3.5 py-3"><EffectBadge effect={p.effect} /></td>
                <td className="px-3.5 py-3 font-sans text-[11.5px] text-ink2">
                  <span className="text-ink3">actor</span> {p.actor}{"  "}
                  <span className="text-ink3">action</span> {p.action}{"  "}
                  <span className="text-ink3">on</span> {p.resource}
                  {p.conditions.length > 0 && (
                    <div className="text-ink3 mt-0.5">
                      {p.conditions.map((c, i) => (
                        <span key={i}>{c.field} {c.op} {String(Array.isArray(c.value) ? c.value.join(",") : c.value)}{i < p.conditions.length - 1 ? "; " : ""}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3">
                  {!p.enabled && <span className="font-sans text-[10px] text-ink3">disabled</span>}
                </td>
                <td className="px-3.5 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing({ ...p })} className="font-sans text-[11.5px] text-blue hover:underline mr-3">Edit</button>
                  <DeleteButton id={p.id!} label={p.policy_id} onDone={() => router.refresh()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PolicyModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function DefaultsBar({ defaultEffect, defaultReason, onSaved }: { defaultEffect: string; defaultReason: string; onSaved: () => void }) {
  const [effect, setEffect] = useState(defaultEffect);
  const [reason, setReason] = useState(defaultReason);
  const [busy, setBusy] = useState(false);
  const dirty = effect !== defaultEffect || reason !== defaultReason;
  return (
    <div className="bg-bg2 border border-line rounded-[14px] px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="font-sans text-[12px] text-ink2">When no rule matches,</span>
      <select value={effect} onChange={(e) => setEffect(e.target.value)} className={inputCls()}>
        {EFFECTS.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls("flex-1 min-w-[220px]")} placeholder="default reason shown in the audit trail" />
      <button
        disabled={!dirty || busy}
        onClick={async () => { setBusy(true); await updateDefaults(effect, reason); setBusy(false); onSaved(); }}
        className="font-sans text-[11.5px] text-blue disabled:text-ink4 hover:underline"
      >
        {busy ? "Saving…" : "Save default"}
      </button>
    </div>
  );
}

// Enforce vs monitor. Prominent and unambiguous: in monitor mode nothing is
// blocked, so the copy says so plainly (a security product must never let someone
// believe they're protected when they're only watching).
function EnforcementBar({
  mode,
  monitorUntil,
  onSaved,
}: {
  mode: "enforce" | "monitor";
  monitorUntil: string | null;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(14);
  const left = mode === "monitor" ? daysLeft(monitorUntil, Date.now()) : null;

  async function setMode(next: "enforce" | "monitor", d?: number) {
    setBusy(true);
    await updateEnforcementMode(next, d);
    setBusy(false);
    onSaved();
  }

  if (mode === "monitor") {
    return (
      <div className="rounded-[14px] border px-4 py-3.5 flex items-center gap-3 flex-wrap"
           style={{ borderColor: "#b8791a", background: "#fff8ec" }}>
        <div className="flex flex-col flex-1 min-w-[260px]">
          <span className="font-sans text-[12.5px] font-semibold" style={{ color: "#8a5a12" }}>
            👁️ Watch mode: reporting only, nothing is being blocked
          </span>
          <span className="font-sans text-[11px] text-ink3 mt-0.5">
            Every prompt is checked and logged with what <b>would</b> have happened, but requests pass through.
            {left != null && <> Ends in <b>{left} day{left === 1 ? "" : "s"}</b>, then enforcement turns on automatically.</>}
          </span>
        </div>
        <button
          disabled={busy}
          onClick={() => setMode("enforce")}
          className="bg-blue text-white font-sans font-semibold text-[12px] rounded-lg px-3.5 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Turn on enforcement now"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-bg2 border border-line rounded-[14px] px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex flex-col flex-1 min-w-[260px]">
        <span className="font-sans text-[12px] text-ink2">🛡️ Enforcing: restricted prompts are blocked or held for approval</span>
        <span className="font-sans text-[10.5px] text-ink4">
          New to StileAI? Run in Watch mode first to see what your team sends, without blocking anyone.
        </span>
      </div>
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls()} disabled={busy}>
        {[7, 14, 30].map((d) => (
          <option key={d} value={d}>{d} days</option>
        ))}
      </select>
      <button
        disabled={busy}
        onClick={() => setMode("monitor", days)}
        className="font-sans text-[11.5px] text-blue hover:underline disabled:text-ink4"
      >
        {busy ? "Saving…" : "Start Watch mode"}
      </button>
    </div>
  );
}

const FALLBACK_OPTS: { id: "availability" | "hold" | "flag"; label: string; hint: string }[] = [
  { id: "availability", label: "Stay available", hint: "Allow it (the local checks already cleared it)." },
  { id: "hold", label: "Hold for approval", hint: "Send it to an admin instead of allowing it. Most strict." },
  { id: "flag", label: "Allow but flag", hint: "Allow it, and mark it in the audit log as not AI-verified." },
];

function FallbackBar({ mode, onSaved }: { mode: "availability" | "hold" | "flag"; onSaved: () => void }) {
  const [val, setVal] = useState(mode);
  const [busy, setBusy] = useState(false);
  const dirty = val !== mode;
  return (
    <div className="bg-bg2 border border-line rounded-[14px] px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex flex-col">
        <span className="font-sans text-[12px] text-ink2">If the extra AI check ever cannot run, then</span>
        <span className="font-sans text-[10.5px] text-ink4">Your local checks always run first. This only covers the small allowed-but-unverified slice.</span>
      </div>
      <select value={val} onChange={(e) => setVal(e.target.value as typeof val)} className={inputCls()} title={FALLBACK_OPTS.find((o) => o.id === val)?.hint}>
        {FALLBACK_OPTS.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <span className="font-sans text-[10.5px] text-ink4 flex-1 min-w-[200px]">
        {FALLBACK_OPTS.find((o) => o.id === val)?.hint}
      </span>
      <button
        disabled={!dirty || busy}
        onClick={async () => { setBusy(true); await updateFallbackMode(val); setBusy(false); onSaved(); }}
        className="font-sans text-[11.5px] text-blue disabled:text-ink4 hover:underline"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function DeleteButton({ id, label, onDone }: { id: string; label: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return <button onClick={() => setConfirming(true)} className="font-sans text-[11.5px] text-ink3 hover:text-slate">Delete</button>;
  return (
    <span className="font-sans text-[11px]">
      <span className="text-ink3 mr-1">delete {label}?</span>
      <button onClick={async () => { await deletePolicy(id); onDone(); }} className="text-slate font-semibold mr-2">yes</button>
      <button onClick={() => setConfirming(false)} className="text-ink3">no</button>
    </span>
  );
}

function PolicyModal({ initial, onClose, onSaved }: { initial: PolicyInput; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<PolicyInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PolicyInput>) => setP((prev) => ({ ...prev, ...patch }));

  const setCond = (i: number, patch: Partial<Condition>) =>
    set({ conditions: p.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  async function submit() {
    setError(null); setBusy(true);
    const res = await savePolicy(p);
    setBusy(false);
    if (res.ok) onSaved(); else setError(res.error);
  }

  return (
    <div className="fixed inset-0 bg-[rgba(24,27,30,.35)] flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div className="bg-card border border-line rounded-[14px] w-full max-w-[560px] max-h-[88vh] overflow-y-auto shadow-[0_30px_60px_-24px_rgba(16,24,40,.4)]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-sans font-bold text-[15px] text-ink">{initial.id ? "Edit rule" : "New rule"}</h2>
        </div>
        <div className="p-5 flex flex-col gap-3.5">
          <Row label="Rule id" hint="Short, unique. e.g. approve-large-payments">
            <input value={p.policy_id} onChange={(e) => set({ policy_id: e.target.value })} className={inputCls("w-full")} placeholder="approve-large-payments" />
          </Row>
          <Row label="Description" hint="Plain-language note shown in the audit trail">
            <input value={p.description} onChange={(e) => set({ description: e.target.value })} className={inputCls("w-full")} placeholder="Charges over $100 require one human approval." />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Effect">
              <select value={p.effect} onChange={(e) => set({ effect: e.target.value })} className={inputCls("w-full")}>
                {EFFECTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Row>
            <Row label="Priority" hint="Lower = checked first">
              <input type="number" value={p.priority} onChange={(e) => set({ priority: Number(e.target.value) })} className={inputCls("w-full")} />
            </Row>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Row label="Actor"><input value={p.actor} onChange={(e) => set({ actor: e.target.value })} className={inputCls("w-full")} placeholder="*" /></Row>
            <Row label="Action"><input value={p.action} onChange={(e) => set({ action: e.target.value })} className={inputCls("w-full")} placeholder="payment.charge" /></Row>
            <Row label="Resource"><input value={p.resource} onChange={(e) => set({ resource: e.target.value })} className={inputCls("w-full")} placeholder="*" /></Row>
          </div>
          {p.effect === "require_approval" && (
            <Row label="Approvals required" hint="How many humans must sign off">
              <input type="number" min={1} value={p.approvals_required} onChange={(e) => set({ approvals_required: Number(e.target.value) })} className={inputCls("w-24")} />
            </Row>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={labelCls()}>Conditions <span className="text-ink4">(all must hold)</span></span>
              <button onClick={() => set({ conditions: [...p.conditions, { field: "", op: "eq", value: "" }] })} className="font-sans text-[11px] text-blue hover:underline">+ add condition</button>
            </div>
            <div className="flex flex-col gap-2">
              {p.conditions.length === 0 && <span className="font-sans text-[11px] text-ink4">No conditions. The rule matches on actor/action/resource alone.</span>}
              {p.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c.field} onChange={(e) => setCond(i, { field: e.target.value })} className={inputCls("flex-1")} placeholder="amount" />
                  <select value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} className={inputCls()}>
                    {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={String(c.value ?? "")} onChange={(e) => setCond(i, { value: e.target.value })} className={inputCls("flex-1")} placeholder="100" disabled={c.op === "exists"} />
                  <button onClick={() => set({ conditions: p.conditions.filter((_, idx) => idx !== i) })} className="font-sans text-[13px] text-ink3 hover:text-slate px-1">×</button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={p.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span className="font-sans text-[12px] text-ink2">Enabled (the checkpoint uses this rule)</span>
          </label>

          {error && <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-line flex justify-end gap-2.5">
          <button onClick={onClose} className="font-sans text-[12px] text-ink3 hover:text-ink px-3 py-2">Cancel</button>
          <button onClick={submit} disabled={busy} className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : "Save rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls()}>{label}{hint && <span className="text-ink4 font-normal">: {hint}</span>}</span>
      {children}
    </label>
  );
}

function PolicyLibrary({ existingIds, onChanged, plan }: { existingIds: Set<string>; onChanged: () => void; plan: string | null }) {
  const byKey = new Map(POLICY_PACKS.map((p) => [p.key, p]));
  const total = POLICY_PACKS.reduce((n, p) => n + p.templates.length, 0);

  const grouped = PACK_CATEGORIES.map((cat) => ({
    name: cat.name,
    packs: cat.keys.map((k) => byKey.get(k)).filter((p): p is PolicyPack => Boolean(p)),
  })).filter((g) => g.packs.length > 0);
  const categorized = new Set(PACK_CATEGORIES.flatMap((c) => c.keys));
  const leftover = POLICY_PACKS.filter((p) => !categorized.has(p.key));
  if (leftover.length) grouped.push({ name: "More", packs: leftover });

  return (
    <div className="flex flex-col gap-8">
      <p className="font-sans text-[12px] text-ink3 max-w-[680px]">
        {total} ready-made policies across {POLICY_PACKS.length} packs, including agent-action controls for
        teams governing AI agents. Enabling one adds its policies to yours, which you can then edit or disable
        individually under <span className="text-ink2">Your rules</span>.
      </p>
      {grouped.map((group) => (
        <div key={group.name} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2 border-b border-line pb-2">
            <h2 className="font-sans font-semibold text-[13px] text-ink">{group.name}</h2>
            <span className="font-sans text-[11px] text-ink4">
              {group.packs.length} {group.packs.length === 1 ? "pack" : "packs"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.packs.map((pack) => (
              <PackCard key={pack.key} pack={pack} existingIds={existingIds} onChanged={onChanged} plan={plan} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PackCard({ pack, existingIds, onChanged, plan }: { pack: PolicyPack; existingIds: Set<string>; onChanged: () => void; plan: string | null }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const addedCount = pack.templates.filter((t) => existingIds.has(t.policy_id)).length;
  const fullyAdded = addedCount === pack.templates.length;
  const locked = !packAllowed(plan, pack.key);

  async function add() {
    setBusy(true);
    await addPack(pack.key);
    setBusy(false);
    onChanged();
  }

  return (
    <div className={`border rounded-2xl bg-card p-5 flex flex-col h-full ${pack.recommended ? "border-blue/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans font-bold text-[15px] text-ink">{pack.name}</h3>
            {pack.recommended && (
              <span className="font-sans text-[9.5px] uppercase tracking-wide text-blue bg-bluedim border border-blue/30 rounded px-1.5 py-0.5">
                Recommended
              </span>
            )}
            {locked && (
              <span className="font-sans text-[9.5px] uppercase tracking-wide text-ink3 bg-bg2 border border-line2 rounded px-1.5 py-0.5">
                Business
              </span>
            )}
          </div>
          <div className="font-sans text-[10.5px] text-ink3 mt-0.5">{pack.framework}</div>
        </div>
        <span className="font-sans text-[10.5px] text-ink3 whitespace-nowrap">{pack.templates.length} rules</span>
      </div>

      <p className="font-sans text-[11.5px] text-ink2 leading-relaxed mt-2.5">{pack.blurb}</p>

      <button onClick={() => setOpen((o) => !o)} className="self-start font-sans text-[11px] text-blue hover:underline mt-2.5">
        {open ? "Hide rules" : "What it adds"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2.5">
          {pack.templates.map((t) => (
            <li key={t.policy_id} className="flex items-start gap-2">
              <span className="mt-[3px]"><EffectBadge effect={t.effect} /></span>
              <div className="min-w-0">
                <div className="font-sans text-[11px] text-ink2">{t.description}</div>
                {t.control && <div className="font-sans text-[10px] text-ink4">{t.control}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4 border-t border-line flex items-center justify-between">
        <span className="font-sans text-[10.5px] text-ink3">
          {addedCount > 0 ? `${addedCount}/${pack.templates.length} enabled` : "not enabled"}
        </span>
        {locked ? (
          <a
            href="/billing"
            className="font-sans font-semibold text-[12px] rounded-xl px-4 py-2 transition-colors bg-bg2 border border-line text-ink3 hover:bg-bg3"
          >
            Business plan
          </a>
        ) : (
          <button
            onClick={add}
            disabled={busy}
            className={`font-sans font-semibold text-[12px] rounded-xl px-4 py-2 transition-colors disabled:opacity-50 ${
              fullyAdded ? "bg-bg2 border border-line text-ink2 hover:bg-bg3" : "bg-blue text-white hover:opacity-90"
            }`}
          >
            {busy ? "Adding…" : fullyAdded ? "Re-apply" : addedCount > 0 ? "Add the rest" : "Add pack"}
          </button>
        )}
      </div>
    </div>
  );
}
