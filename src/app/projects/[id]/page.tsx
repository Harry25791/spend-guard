// src/app/projects/[id]/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

// UI
import SGCard from "@/components/ui/SGCard";
import PieByModel from "@/components/charts/PieByModel";
import MiniLine from "@/components/charts/MiniLine";
import { Button } from "@/components/ui/Buttons";
import TokenLimitUsage from "@/components/charts/TokenLimitUsage";

// Data
import { loadEntries, saveEntries, type EntryV2 } from "@/lib/storage";
import {
  downloadProjectCSV,
  downloadProjectJSON,
  getViewScope,
  setViewScope,
  type ViewScope,
  filterByScope,
  labelForScope,
  rangeForScope,
} from "@/lib/io";
import { PROVIDER_MODELS, normalizeProvider, getModelRate, type ProviderKey } from "@/lib/rates";
import { estimateTokens } from "@/lib/token";
import KPIRow from "@/components/dashboard/KPIRow";

type UsageEntry = EntryV2;

// ── Tunables
const REVEAL_ROOT_MARGIN = "-40%"; // More negative = later reveal; positive = earlier reveal
const ANALYSIS_TOP_GAP_PX = 100;    // Gap between token input card and the KPI row

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div suppressHydrationWarning>{mounted ? children : null}</div>;
}

export default function ProjectDetail() {
  // ── Routing / Query
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Unnamed Project";
  const provider = searchParams.get("provider") ?? "Unknown Provider";

  // ── Data (SSR safe: start empty, load after mount to avoid hydration mismatch)
  const [entries, setEntries] = useState<UsageEntry[]>([]);

  // ⬇️ SAVE GATE: prevent saving while (re)loading entries for this project
  const hasLoadedRef = useRef(false);

  // ── Add form state
  const [date, setDate] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Fallbacks: from URL and from existing entries
  const queryProviderKey: ProviderKey | null = normalizeProvider(provider || "");
  const [lastProviderKey, setLastProviderKey] = useState<ProviderKey | null>(null);

  useEffect(() => {
    let found: ProviderKey | null = null;
    for (const e of entries) {
      if (e?.provider) {
        const k = normalizeProvider(e.provider);
        if (k) { found = k; break; }
      }
    }
    setLastProviderKey(found);
  }, [entries]);

  // NOTE: intentionally NOT auto-selecting provider from last/query to keep "Select provider" default.

  const [tokens, setTokens] = useState<number>(0);
  const [manualTokens, setManualTokens] = useState(false);

  // NOTE: intentionally NOT auto-selecting provider from URL param anymore.

  // ── Project default rate (declare before any derived usage)
  const [projectRate, setProjectRate] = useState<number | undefined>(undefined);
  useEffect(() => {
    const raw = localStorage.getItem("projects");
    if (!raw || !projectId) return;
    try {
      const list: Array<{ id: string | number; rateUsdPer1k?: number }> = JSON.parse(raw);
      const p = list.find((x) => String(x.id) === String(projectId));
      setProjectRate(p?.rateUsdPer1k);
    } catch {
      setProjectRate(undefined);
    }
  }, [projectId]);

  // Active provider key ONLY follows explicit selection now
  const activeProviderKey: ProviderKey | null = normalizeProvider(selectedProvider);

  const modelOptions = activeProviderKey ? PROVIDER_MODELS[activeProviderKey] : [];
  const [customRate, setCustomRate] = useState<number | undefined>(undefined);
  const effectiveRate =
    customRate ?? getModelRate((selectedProvider || activeProviderKey || "") as string, selectedModel, projectRate);

  // Keep only the "clear invalid model if provider changes" behavior (no auto-default model)
  useEffect(() => {
    if (!activeProviderKey) return;
    const models = PROVIDER_MODELS[activeProviderKey] ?? [];
    if (selectedModel && !models.some((m) => m.model === selectedModel || (m as any).id === selectedModel)) {
      setSelectedModel("");
    }
  }, [activeProviderKey, selectedModel]);

  // Token Counter
  const [counterText, setCounterText] = useState("");
  const counterTokens = estimateTokens(counterText, selectedModel || undefined);
  const counterCost = effectiveRate ? (counterTokens / 1000) * effectiveRate : 0;

  const computedCost = (!effectiveRate || !tokens || tokens <= 0) ? 0 : (tokens / 1000) * effectiveRate;

  // ── Edit modal state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftProvider, setDraftProvider] = useState<string>("");
  const [draftModel, setDraftModel] = useState<string>("");
  const [draftTokens, setDraftTokens] = useState<number>(0);
  const [draftCustomRate, setDraftCustomRate] = useState<number | undefined>(undefined);

  const draftFallbackProvider =
    draftProvider || selectedProvider || (lastProviderKey || "") || (queryProviderKey || "") || "";

  const activeDraftProviderKey: ProviderKey | null = normalizeProvider(draftFallbackProvider);
  const draftModelOptions = activeDraftProviderKey ? PROVIDER_MODELS[activeDraftProviderKey] : [];
  const draftEffectiveRate = draftCustomRate ?? getModelRate(draftFallbackProvider, draftModel, projectRate);

  // Keep only the "clear invalid model" behavior in edit modal (no auto-default model)
  useEffect(() => {
    if (!activeDraftProviderKey) return;
    const models = PROVIDER_MODELS[activeDraftProviderKey] ?? [];
    if (draftModel && !models.some((m) => m.model === draftModel || (m as any).id === draftModel)) {
      setDraftModel("");
    }
  }, [activeDraftProviderKey, draftModel]);

  // ── Misc
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Autofill date to today on mount
  useEffect(() => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const dateRef = useRef<HTMLInputElement>(null);

  // ── Load / Save
  useEffect(() => {
    if (!projectId) return;
    hasLoadedRef.current = false;                 // block saves
    setEntries(loadEntries(projectId));
    // Do NOT flip the flag here; wait for the first entries change to enable saving.
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    // First entries change after a (re)load: mark loaded and skip saving this pass.
    if (!hasLoadedRef.current) { hasLoadedRef.current = true; return; }
    // Subsequent changes: persist normally.
    saveEntries(projectId, entries);
    const projectsRaw = localStorage.getItem("projects");
    if (projectsRaw) localStorage.setItem("projects", projectsRaw);
  }, [entries, projectId]);

  // 🔑 Force a remount of charts when entries change so they initialize with loaded data
  const chartsKey = useMemo(() => entries.map(e => String(e.id)).join("|"), [entries]);

  // ── Handlers
  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !tokens || tokens <= 0) return;

    const newEntry: UsageEntry = {
      id: crypto.randomUUID(),
      date,
      tokens,
      cost: Number((computedCost || 0).toFixed(6)),
      provider: selectedProvider || provider,
      model: selectedModel || undefined,
      rateUsdPer1k: effectiveRate,
    };

    setEntries((prev) => [newEntry, ...prev]);

    // reset minimal: keep provider; reset model; date -> today
    setTokens(0);
    setSelectedModel("");
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);

    dateRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const addEntryFromCounter = () => {
    if (!date || counterTokens <= 0 || !effectiveRate) return;
    const newEntry: UsageEntry = {
      id: crypto.randomUUID(),
      date,
      tokens: counterTokens,
      cost: Number((counterCost || 0).toFixed(6)),
      provider: selectedProvider || provider,
      model: selectedModel || undefined,
      rateUsdPer1k: effectiveRate,
    };
    setEntries((prev) => [newEntry, ...prev]);
    setCounterText("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const startEdit = (row: UsageEntry) => {
    setEditingId(row.id as string);
    setDraftDate(row.date);
    const baseProv = row.provider || selectedProvider || provider || "";
    setDraftProvider(baseProv);
    setDraftModel(row.model ?? "");
    setDraftTokens(Number(row.tokens) || 0);
    const catRate = getModelRate(baseProv, row.model ?? "", projectRate);
    if (typeof row.rateUsdPer1k === "number" && row.rateUsdPer1k !== catRate) {
      setDraftCustomRate(row.rateUsdPer1k);
    } else {
      setDraftCustomRate(undefined);
    }
    setIsEditOpen(true);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const effRate = draftEffectiveRate ?? 0;
    const newCost = effRate > 0 ? (draftTokens / 1000) * effRate : 0;

    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingId
          ? {
              ...e,
              date: draftDate,
              provider: draftProvider || e.provider,
              model: draftModel || e.model,
              tokens: draftTokens,
              rateUsdPer1k: effRate || e.rateUsdPer1k,
              cost: Number(newCost.toFixed(6)),
            }
          : e
      )
    );

    setIsEditOpen(false);
    setEditingId(null);
  };

  const cancelEdit = () => { setIsEditOpen(false); setEditingId(null); };
  const deleteEntry = (id: string) => setEntries(entries.filter((e) => e.id !== id));
  const clearAllEntries = () => { if (window.confirm("Are you sure you want to clear all entries?")) setEntries([]); };

  // ── View scope (global)
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => { try { setScopeState(getViewScope()); } catch {} }, []);
  useEffect(() => {
    const onScope = (e: any) => {
      const v = e?.detail?.scope as ViewScope | undefined;
      if (v) setScopeState(v);
    };
    window.addEventListener("sg:scope-change", onScope as EventListener);
    return () => window.removeEventListener("sg:scope-change", onScope as EventListener);
  }, []);
  const setScope = useCallback((v: ViewScope) => {
    setScopeState(v);
    setViewScope(v);
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: v } }));
  }, []);

  // ── Derived filtered entries
  const viewEntries = useMemo(
    () => entries.filter((e) => filterByScope(e?.date || "", scope)),
    [entries, scope]
  );

  // ── Timeline support
  const { from, to } = useMemo(() => rangeForScope(scope, new Date()), [scope]);

  // ── Totals / KPIs
  const totalCost = useMemo(
    () => Number(viewEntries.reduce((sum, e) => sum + (Number(e.cost) || 0), 0).toFixed(6)),
    [viewEntries]
  );
  const entriesCount = viewEntries.length;

  const avgCost = useMemo(() => {
    if (entriesCount === 0) return 0;
    return Number((totalCost / entriesCount).toFixed(6));
  }, [totalCost, entriesCount]);

  const totalTokens = useMemo(
    () => viewEntries.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0),
    [viewEntries]
  );

  const avgTokens = useMemo(() => {
    if (entriesCount === 0) return 0;
    return Math.round(totalTokens / entriesCount);
  }, [totalTokens, entriesCount]);

  const lastEntryDate = useMemo(() => {
    if (viewEntries.length === 0) return undefined;
    return viewEntries
      .map((e) => e.date)
      .reduce((a, b) => (a > b ? a : b));
  }, [viewEntries]);

  // ── Staggered reveal for insights
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setReveal(true); io.disconnect(); } },
      { root: null, threshold: 0, rootMargin: `0px 0px ${REVEAL_ROOT_MARGIN} 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const revealClass = (idx: number) =>
    `transition-all duration-[800ms] ease-out will-change-transform ${
      reveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    } [transition-delay:${Math.min(200 + idx * 120, 800)}ms]`;

  // ── Render
  return (
    <div className="space-y-6">
      <div>
        {/* Back to Projects goes to /projects */}
        <Link href="/projects" className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40">
          ← Back to Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-slate-400">{provider} — Usage Tracker</p>
        <p className="text-slate-400 text-sm mt-1">
          Scope: <span className="text-slate-200">{labelForScope(scope)}</span> (set in header)
        </p>
      </div>

      {/* TOP: Full-width token input first */}
      <div className="md:sticky md:top-24">
        <SGCard className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-slate-400">Entry mode:</span>
          <Button
            type="button"
            size="sm"
            variant={!manualTokens ? "primary" : "ghost"}
            aria-pressed={!manualTokens}
            onClick={() => setManualTokens(false)}
          >
            Token Counter
          </Button>
          <Button
            type="button"
            size="sm"
            variant={manualTokens ? "primary" : "ghost"}
            aria-pressed={manualTokens}
            onClick={() => setManualTokens(true)}
          >
            Manual Tokens
          </Button>
        </div>

        <form onSubmit={addEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          />

          {/* Provider */}
          <div className="relative">
            <select
              value={selectedProvider}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "other") {
                  const prov = window.prompt("Provider name?");
                  const model = window.prompt("Model name?");
                  const rateStr = window.prompt("Rate in $ per 1k tokens?");
                  const rateNum = rateStr ? Number(rateStr) : undefined;
                  if (!prov || !model || !rateNum || rateNum <= 0 || Number.isNaN(rateNum)) {
                    alert("Invalid custom provider/model/rate. Please try again.");
                    return;
                  }
                  setSelectedProvider(prov.trim());
                  setSelectedModel(model.trim());
                  setCustomRate(rateNum);
                } else {
                  setSelectedProvider(v);
                  setSelectedModel("");
                  setCustomRate(undefined);
                }
              }}
              className="w-full appearance-none rounded-lg bg-slate-800/60 border border-white/10 text-slate-100 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:bg-slate-700/40 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {/* Placeholder to force explicit selection */}
              <option value="">Select provider</option>
              {["openai","anthropic","mistral","google","deepseek","other"].map(p => (
                <option key={p} value={p}>{p === "other" ? "Other…" : p}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300"
                 viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01-1.06z"/>
            </svg>
          </div>

          {/* Model */}
          <div className="relative">
            <select
              key={activeProviderKey || (customRate !== undefined ? "custom" : "none")}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!activeProviderKey && customRate === undefined}
              className={`w-full appearance-none rounded-lg bg-slate-800/60 border border-white/10 text-slate-100 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:bg-slate-700/40 disabled:text-slate-400 ${
                !activeProviderKey && customRate === undefined ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <option value="">{activeProviderKey ? "Select model" : "Choose a provider first"}</option>
              {activeProviderKey &&
                modelOptions.map(m => (
                  <option key={m.model} value={m.model}>{m.model}</option>
                ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300"
                 viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01-1.06z"/>
            </svg>
          </div>
        </form>

        {/* Manual tokens input */}
        {manualTokens && (
          <div className="mt-3 flex items-end gap-3">
            <input
              type="number"
              placeholder="Token Count"
              value={tokens ? String(tokens) : ""}
              onChange={(e) => setTokens(Number(e.target.value))}
              className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <Button onClick={addEntry}>Add</Button>
          </div>
        )}

        {/* Token Counter */}
        {!manualTokens && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200">Token Counter</h3>
              <span className="text-xs text-slate-400">
                {effectiveRate ? `@ $${effectiveRate}/1k` : projectRate ? `@ project $${projectRate}/1k` : "select provider+model"}
              </span>
            </div>
            <textarea
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              placeholder="Paste prompt or output to estimate tokens & cost..."
              className="w-full min-h-[120px] rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                Tokens: <span className="font-medium">{counterTokens.toLocaleString()}</span>
                <span className="mx-2">•</span>
                Est. Cost: <span className="font-semibold text-cyan-300">${counterCost.toFixed(6)}</span>
              </div>
              <Button onClick={addEntryFromCounter} disabled={counterTokens <= 0 || !effectiveRate}>
                Add Entry from Text
              </Button>
            </div>
          </div>
        )}

        {/* Rate hint + Save blip */}
        <p className="text-xs text-slate-400 mt-2">
          {customRate
            ? `Custom rate: $${customRate}/1k tokens`
            : effectiveRate
              ? `Rate: $${effectiveRate}/1k tokens`
              : projectRate !== undefined
                ? `Project default: $${projectRate}/1k tokens`
                : "Pick a provider/model to compute cost"}
        </p>
        {saved && <p className="text-emerald-400 text-sm mt-2">✅ Saved</p>}
      </SGCard>
      </div>

      {/* Sentinel for staggered reveals below */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* INSIGHTS: appear on scroll (lighter initial paint) */}
      {/* KPI Row now reveals AFTER token input; gap is adjustable */}
      <div className={revealClass(0)} style={{ marginTop: ANALYSIS_TOP_GAP_PX }}>
        <ClientOnly>
          <KPIRow
            className=""
            items={[
              { label: "Scope Total", value: `$${totalCost.toFixed(2)} • ${totalTokens.toLocaleString()} tok` },
              { label: "Entries", value: String(entriesCount) },
              { label: "Avg/Entry", value: `$${avgCost.toFixed(2)} • ${avgTokens} tok` },
              { label: "Last Entry", value: lastEntryDate ?? "—" },
            ]}
          />
        </ClientOnly>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* NEW: Token limit usage */}
        <SGCard className={revealClass(1)}>
          <TokenLimitUsage
            key={`${chartsKey}-limit`}
            projectId={String(projectId)}
            tokensUsed={totalTokens}
            defaultRateUsdPer1k={projectRate}
            modelRateUsdPer1k={effectiveRate ?? (totalTokens > 0 ? (totalCost / totalTokens) * 1000 : projectRate)}
            barHeightPx={120}
          />
        </SGCard>

        {/* Per-model breakdown */}
        <SGCard className={["p-4", revealClass(2)].join(" ")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Per-model breakdown — {labelForScope(scope)}
            </h3>
            <span className="text-xs text-slate-400">by cost</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <PieByModel key={`${chartsKey}-pie`} entries={viewEntries} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-300">
                  <tr>
                    <th className="text-left py-2 pr-4">Provider/Model</th>
                    <th className="text-right py-2 pr-4">Tokens</th>
                    <th className="text-right py-2">Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const m: Record<string, { name: string; tokens: number; cost: number }> = {};
                    for (const e of viewEntries) {
                      const prov = e.provider ?? "unknown";
                      const model = e.model ?? "unknown";
                      const key = prov + "/" + model;
                      const v = m[key] || { name: key, tokens: 0, cost: 0 };
                      v.tokens += Number(e.tokens) || 0;
                      v.cost += Number(e.cost) || 0;
                      m[key] = v;
                    }
                    const rows = Object.values(m).sort((a, b) => b.cost - a.cost);
                    if (rows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-slate-400">
                            {entries.length === 0 ? "No usage entries yet" : "No entries in this range"}
                          </td>
                        </tr>
                      );
                    }
                    return rows.map((r, idx) => (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4 text-right">{r.tokens.toLocaleString()}</td>
                        <td className="py-2 text-right">{r.cost.toFixed(2)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </SGCard>

        {/* Timeline */}
        <SGCard className={["p-4 lg:col-span-2", revealClass(3)].join(" ")}>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            Timeline — {labelForScope(scope)}
          </h3>
          <MiniLine key={`${chartsKey}-line`} entries={viewEntries} from={from} to={to} valueKey="cost" />
        </SGCard>
      </div>

      {/* Table (mirrors scope) */}
      <SGCard className={["overflow-hidden", revealClass(4)].join(" ")}>
        <table className="w-full">
          <thead className="bg-white/5">
            <tr className="text-left text-slate-300 text-sm">
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Provider</th>
              <th className="px-5 py-3">Model</th>
              <th className="px-5 py-3 text-right">Tokens</th>
              <th className="px-5 py-3 text-right">Rate ($/1k)</th>
              <th className="px-5 py-3 text-right">Cost ($)</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Loading…</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">No usage entries yet</td>
              </tr>
            ) : viewEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">No entries in this range</td>
              </tr>
            ) : (
              viewEntries.map((e, i) => (
                <tr
                  key={e.id}
                  className={`border-t border-white/10 ${i % 2 === 0 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.06] transition`}
                >
                  <td className="px-5 py-3">{e.date}</td>
                  <td className="px-5 py-3">{e.provider ?? "—"}</td>
                  <td className="px-5 py-3">{e.model ?? "—"}</td>
                  <td className="px-5 py-3 text-right">{e.tokens.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    {typeof e.rateUsdPer1k === "number" ? e.rateUsdPer1k : (projectRate ?? "—")}
                  </td>
                  <td className="px-5 py-3 text-right">${e.cost.toFixed(6)}</td>
                  <td className="px-5 py-3 text-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => deleteEntry(e.id as string)}>Delete</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SGCard>

      {/* Bottom actions — Total aligned with buttons, no extra gap */}
      <div className={["flex flex-wrap items-center justify-between gap-3", revealClass(5)].join(" ")}>
        <p className="text-lg font-semibold m-0">
          Total Cost — {labelForScope(scope)}: ${totalCost.toFixed(6)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProjectCSV(String(projectId), name, provider, projectRate, viewEntries)}
          >
            Export CSV — {labelForScope(scope)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProjectJSON(String(projectId), name, provider, projectRate, viewEntries)}
          >
            Export JSON — {labelForScope(scope)}
          </Button>
          {entries.length > 0 && (
            <Button variant="danger" size="sm" onClick={clearAllEntries}>
              Clear All Entries
            </Button>
          )}
        </div>
      </div>

      {/* Edit Modal (intact) */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={cancelEdit} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Edit Entry</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Date</label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Tokens</label>
                <input
                  type="number"
                  value={draftTokens ? String(draftTokens) : ""}
                  onChange={(e) => setDraftTokens(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Provider</label>
                <div className="relative">
                  <select
                    value={draftProvider || (activeDraftProviderKey || "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "other") {
                        const prov = window.prompt("Provider name?");
                        const model = window.prompt("Model name?");
                        const rateStr = window.prompt("Rate in $ per 1k tokens?");
                        const rateNum = rateStr ? Number(rateStr) : undefined;
                        if (!prov || !model || !rateNum || rateNum <= 0 || Number.isNaN(rateNum)) {
                          alert("Invalid custom provider/model/rate. Please try again.");
                          return;
                        }
                        setDraftProvider(prov.trim());
                        setDraftModel(model.trim());
                        setDraftCustomRate(rateNum);
                      } else {
                        setDraftProvider(v);
                        setDraftModel("");
                        setDraftCustomRate(undefined);
                      }
                    }}
                    className="w-full appearance-none rounded-lg bg-slate-800/60 border border-white/10 text-slate-100 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                  >
                    {/* Add placeholder for consistency; existing rows will still show their value */}
                    {!draftProvider && <option value="">Select provider</option>}
                    {draftProvider &&
                      !["openai","anthropic","mistral","google","deepseek"].includes((normalizeProvider(draftProvider)||"")) && (
                        <option value={draftProvider}>{draftProvider}</option>
                      )}
                    {["openai","anthropic","mistral","google","deepseek","other"].map(p => (
                      <option key={p} value={p}>{p === "other" ? "Other…" : p}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300"
                       viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01-1.06z"/>
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Model</label>
                <div className="relative">
                  <select
                    key={activeDraftProviderKey || (draftCustomRate !== undefined ? "custom" : "none")}
                    value={draftModel}
                    onChange={(e) => setDraftModel(e.target.value)}
                    disabled={!activeDraftProviderKey && draftCustomRate === undefined}
                    className={`w-full appearance-none rounded-lg bg-slate-800/60 border border-white/10 text-slate-100 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:bg-slate-700/40 disabled:text-slate-400 ${
                      !activeDraftProviderKey && draftCustomRate === undefined ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <option value="">{activeDraftProviderKey ? "Select model" : "Choose a provider first"}</option>
                    {activeDraftProviderKey &&
                      draftModelOptions.map(m => (
                        <option key={m.model} value={m.model}>{m.model}</option>
                      ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300"
                       viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01-1.06z"/>
                  </svg>
                </div>
              </div>

              <div className="md:col-span-2 text-xs text-slate-400">
                {draftCustomRate
                  ? <>Custom rate: <span className="text-cyan-300">${draftCustomRate}</span> / 1k</>
                  : draftEffectiveRate
                    ? <>Rate: <span className="text-cyan-300">${draftEffectiveRate}</span> / 1k</>
                    : <>Select provider & model to compute cost</>}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
