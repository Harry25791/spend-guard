"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadEntries, saveEntries, type EntryV2 } from "@/lib/storage";
import {
  downloadProjectCSV, downloadProjectJSON,
  getViewScope, setViewScope, type ViewScope,
  filterByScope, labelForScope, SCOPE_OPTIONS,
} from "@/lib/io";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PROVIDER_MODELS, normalizeProvider, getModelRate, type ProviderKey } from "@/lib/rates";
import { estimateTokens } from "@/lib/token";

type UsageEntry = EntryV2;

export default function ProjectDetail() {
  // ── Routing / Query
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Unnamed Project";
  const provider = searchParams.get("provider") ?? "Unknown Provider";

  // ── Data
  const [entries, setEntries] = useState<UsageEntry[]>(() => {
    if (typeof window === "undefined" || !projectId) return [];
    const projectProvider =
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("provider")
        : null) || undefined;
    return loadEntries(projectId, projectProvider ?? undefined);
  });

  // ── Add form state
  const [date, setDate] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Fallbacks: from URL and from existing entries
  const queryProviderKey: ProviderKey | null = normalizeProvider(provider || "");
  const [lastProviderKey, setLastProviderKey] = useState<ProviderKey | null>(null);

  useEffect(() => {
    // derive last used provider from entries (newest-first or first non-empty)
    let found: ProviderKey | null = null;
    for (const e of entries) {
      if (e?.provider) {
        const k = normalizeProvider(e.provider);
        if (k) { found = k; break; }
      }
    }
    setLastProviderKey(found);
  }, [entries]);

  // If no explicit selection yet, adopt last-used or query provider
  useEffect(() => {
    if (!selectedProvider) {
      if (lastProviderKey) setSelectedProvider(lastProviderKey);
      else if (queryProviderKey) setSelectedProvider(queryProviderKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastProviderKey, queryProviderKey]);

  const [tokens, setTokens] = useState<number>(0);
  // Entry mode: false = Text Counter (default), true = Manual Tokens
  const [manualTokens, setManualTokens] = useState(false);

  // If a valid provider key came via query, set it (ignore values like "Claude")
  useEffect(() => {
    const key = normalizeProvider(provider || "");
    if (key) setSelectedProvider(key);
  }, [provider]);

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

  // Active provider key prefers explicit selection, then last-used, then query
  const activeProviderKey: ProviderKey | null =
    normalizeProvider(selectedProvider) || lastProviderKey || queryProviderKey;

  const modelOptions = activeProviderKey ? PROVIDER_MODELS[activeProviderKey] : [];
  const [customRate, setCustomRate] = useState<number | undefined>(undefined);
  const effectiveRate =
    customRate ??
    getModelRate((selectedProvider || activeProviderKey || "") as string, selectedModel, projectRate);

  // ✔ Ensure model select is ready as soon as provider is known — clear invalid model
  useEffect(() => {
    if (!activeProviderKey) return;
    const models = PROVIDER_MODELS[activeProviderKey] ?? [];
    if (selectedModel && !models.some((m) => m.model === selectedModel || (m as any).id === selectedModel)) {
      setSelectedModel("");
    }
  }, [activeProviderKey, selectedModel]);

  // Token Counter (paste text -> tokens/cost)
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

  // Draft-derived with fallback to selected/last-used/query (must be after projectRate)
  const draftFallbackProvider =
    draftProvider || selectedProvider || (lastProviderKey || "") || (queryProviderKey || "") || "";

  const activeDraftProviderKey: ProviderKey | null = normalizeProvider(draftFallbackProvider);
  const draftModelOptions = activeDraftProviderKey ? PROVIDER_MODELS[activeDraftProviderKey] : [];
  const draftEffectiveRate = draftCustomRate ?? getModelRate(draftFallbackProvider, draftModel, projectRate);

  // ✔ Same guard for Edit modal
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
  useEffect(() => { dateRef.current?.focus(); }, []);

  // ── Load / Save
  useEffect(() => {
    if (!projectId) return;
    setEntries(loadEntries(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    saveEntries(projectId, entries);
    const projectsRaw = localStorage.getItem("projects");
    if (projectsRaw) localStorage.setItem("projects", projectsRaw);
  }, [entries, projectId]);

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

  // Add entry directly from the counter
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
    setCounterText(""); // keep date/provider/model
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const startEdit = (row: UsageEntry) => {
    setEditingId(row.id as string);
    setDraftDate(row.date);

    // Prefer entry provider; fall back to current selection or query
    const baseProv = row.provider || selectedProvider || provider || "";
    setDraftProvider(baseProv);
    setDraftModel(row.model ?? "");
    setDraftTokens(Number(row.tokens) || 0);

    // If stored rate differs from catalog, treat as custom
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

  // ── View scope (hydration-safe: "month" on first render)
  const [scope, setScope] = useState<ViewScope>("month");
  useEffect(() => { try { setScope(getViewScope()); } catch {} }, []);
  useEffect(() => { setViewScope(scope); }, [scope]);

  // ── Derived filtered entries (all ranges supported)
  const viewEntries = entries.filter((e) => filterByScope(e?.date || "", scope));

  // ── Totals
  const totalCost = viewEntries.reduce((sum, e) => sum + e.cost, 0);

  // ── Render
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#0b1023] via-[#0e1330] to-[#111827] text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4">
          <Link href="/" className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40">
            ← Back to Projects
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-slate-400 mb-6">{provider} — Usage Tracker</p>

        {/* Scope controls + exports */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setScope("month")}
              className={scope === "month" ? "px-3 py-1.5 text-sm bg-white/10 text-white" : "px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"}
            >
              This Month
            </button>
            <button
              onClick={() => setScope("lifetime")}
              className={scope === "lifetime" ? "px-3 py-1.5 text-sm bg-white/10 text-white" : "px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"}
            >
              Lifetime
            </button>
          </div>

          {/* Quick functional range selector (UI polish later) */}
          <label className="text-sm text-slate-300 ml-1">
            Range:&nbsp;
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ViewScope)}
              className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-slate-100"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => downloadProjectCSV(String(projectId), name, provider, projectRate, viewEntries)}
            className="rounded-lg px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-sm"
          >
            Export CSV — {labelForScope(scope)}
          </button>
          <button
            onClick={() => downloadProjectJSON(String(projectId), name, provider, projectRate, viewEntries)}
            className="rounded-lg px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-sm"
          >
            Export JSON — {labelForScope(scope)}
          </button>
        </div>

        {/* Per-model breakdown (project, filtered) */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Per-model breakdown — {labelForScope(scope)}
            </h3>
            <span className="text-xs text-slate-400">by cost</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(function () {
                      const m: Record<string, { name: string; value: number; tokens: number }> = {};
                      for (const e of viewEntries) {
                        const prov = e.provider ?? "unknown";
                        const model = e.model ?? "unknown";
                        const key = prov + "/" + model;
                        const v = m[key] || { name: key, value: 0, tokens: 0 };
                        v.value += Number(e.cost) || 0;
                        v.tokens += Number(e.tokens) || 0;
                        m[key] = v;
                      }
                      return Object.values(m).map((r) => ({ name: r.name, value: Number(r.value.toFixed(2)) }));
                    })()}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {((function () {
                      const m: Record<string, { name: string; value: number }> = {};
                      for (const e of viewEntries) {
                        const prov = e.provider ?? "unknown";
                        const model = e.model ?? "unknown";
                        const key = prov + "/" + model;
                        const v = m[key] || { name: key, value: 0 };
                        v.value += Number(e.cost) || 0;
                        m[key] = v;
                      }
                      return Object.values(m);
                    })()).map((_, i) => <Cell key={`c-${i}`} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

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
        </div>

        <p className="text-slate-400 mb-2">
          {customRate
            ? <>Custom rate: <span className="text-cyan-300">${customRate.toFixed(4)}</span> per 1k tokens</>
            : effectiveRate
              ? <>Rate: <span className="text-cyan-300">${effectiveRate.toFixed(4)}</span> per 1k tokens</>
              : projectRate !== undefined
                ? <>Project default: <span className="text-cyan-300">${projectRate.toFixed(4)}</span> per 1k tokens</>
                : <>Select a provider/model to compute cost</>}
        </p>

        {/* Add Entry Card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-slate-400">Entry mode:</span>
            <button
              type="button"
              onClick={() => setManualTokens(false)}
              className={`rounded-md px-2.5 py-1 ${!manualTokens ? "bg-cyan-600 text-white" : "bg-slate-800/60 text-slate-200"} border border-white/10`}
            >
              Token Counter
            </button>
            <button
              type="button"
              onClick={() => setManualTokens(true)}
              className={`rounded-md px-2.5 py-1 ${manualTokens ? "bg-cyan-600 text-white" : "bg-slate-800/60 text-slate-200"} border border-white/10`}
            >
              Manual Tokens
            </button>
          </div>
          <form onSubmit={addEntry} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />

            {/* Provider */}
            <div className="relative flex-1">
              <select
                value={selectedProvider || (activeProviderKey || "")}
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
            <div className="relative flex-1">
              {/* Key forces a remount when provider becomes available */}
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

            {/* Tokens */}
            {manualTokens && (
              <input
                type="number"
                placeholder="Token Count"
                value={tokens ? String(tokens) : ""}
                onChange={(e) => setTokens(Number(e.target.value))}
                className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />
            )}

            {manualTokens && (
              <button
                type="submit"
                className="rounded-lg px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 transition shadow shadow-cyan-900/30"
              >
                Add
              </button>
            )}
          </form>

          <p className="text-xs text-slate-400 mt-2">
            {customRate
              ? `Custom rate: $${customRate}/1k tokens`
              : effectiveRate
                ? `Rate: $${effectiveRate}/1k tokens`
                : "Pick a provider and model to enable tokens → cost"}
          </p>

          {saved && <p className="text-emerald-400 text-sm mt-2">✅ Saved</p>}
        </div>

        {!manualTokens && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-2 00">Token Counter</h3>
              <span className="text-xs text-slate-400">
                {effectiveRate ? `@ $${effectiveRate}/1k` : projectRate ? `@ project $${projectRate}/1k` : "select provider+model"}
              </span>
            </div>
            <textarea
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              placeholder="Paste prompt or output here to estimate tokens & cost..."
              className="w-full min-h-[120px] rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                Tokens: <span className="font-medium">{counterTokens.toLocaleString()}</span>
                <span className="mx-2">•</span>
                Est. Cost: <span className="font-semibold text-cyan-300">${counterCost.toFixed(6)}</span>
              </div>
              <button
                onClick={addEntryFromCounter}
                disabled={counterTokens <= 0 || !effectiveRate}
                className="rounded-lg px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Add Entry from Text
              </button>
            </div>
          </div>
        )}

        {/* Table (mirrors scope) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 overflow-hidden">
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
                      <button
                        onClick={() => startEdit(e)}
                        className="rounded-md px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEntry(e.id as string)}
                        className="rounded-md px-3 py-1.5 bg-rose-500 hover:bg-rose-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {entries.length > 0 && (
          <div className="flex justify-end pt-4">
            <button
              onClick={clearAllEntries}
              className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 transition"
            >
              Clear All Entries
            </button>
          </div>
        )}

        <p className="mt-4 text-lg font-semibold">
          Total Cost — {labelForScope(scope)}: ${totalCost.toFixed(6)}
        </p>

        {/* Edit Modal */}
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
                <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 bg-slate-600 hover:bg-slate-500">
                  Cancel
                </button>
                <button onClick={saveEdit} className="rounded-md px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
