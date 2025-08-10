"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadEntries, saveEntries, type EntryV2, type Project } from "@/lib/storage";
import { PROVIDER_MODELS, normalizeProvider, getModelRate, type ProviderKey } from "@/lib/rates";

type UsageEntry = EntryV2;

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Unnamed Project";
  const provider = searchParams.get("provider") ?? "Unknown Provider";

  const [entries, setEntries] = useState<UsageEntry[]>(() => {
    if (typeof window === "undefined" || !projectId) return [];
    // Fill provider from project (via query) for legacy rows
    const projectProvider = (typeof window !== "undefined" ? (new URLSearchParams(window.location.search)).get("provider") : null) || undefined;
    return loadEntries(projectId, projectProvider ?? undefined);
  });

  const [date, setDate] = useState("");

  // Provider/model state for the Add form (linked dropdowns)
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  useEffect(() => {
    // If a valid provider key came via query, set it; ignore values like "Claude"
    const key = normalizeProvider(provider || "");
    if (key) setSelectedProvider(key);
  }, [provider]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Autofill date to today on mount and after add
  useEffect(() => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);
  const [tokens, setTokens] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTokens, setEditTokens] = useState("");
  const [editCost, setEditCost] = useState("");
  const [saved, setSaved] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // ✅ Fetch project rate for auto-calculation
  const [projectRate, setProjectRate] = useState<number | undefined>(undefined);
  useEffect(() => {
    const raw = localStorage.getItem("projects");
    if (!raw || !projectId) return;
    const list = JSON.parse(raw) as { id: number; rateUsdPer1k?: number }[];
    const p = list.find((x) => String(x.id) === String(projectId));
    setProjectRate(p?.rateUsdPer1k);
  }, [projectId]);

  const providerKey: ProviderKey | null = normalizeProvider(selectedProvider);
  const modelOptions = providerKey ? PROVIDER_MODELS[providerKey] : [];
  const [customRate, setCustomRate] = useState<number | undefined>(undefined);
  const effectiveRate = customRate ?? getModelRate(selectedProvider, selectedModel, projectRate);

  const computedCost = (() => {
    if (!effectiveRate || !tokens || tokens <= 0) return 0;
    return (tokens / 1000) * effectiveRate;
  })();

  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  // Reload entries if project changes
  useEffect(() => {
    if (!projectId) return;
    setEntries(loadEntries(projectId));
  }, [projectId]);

  // Persist entries + touch projects so Home totals recalc
  useEffect(() => {
    if (!projectId) return;
    saveEntries(projectId, entries);
    const projectsRaw = localStorage.getItem("projects");
    if (projectsRaw) localStorage.setItem("projects", projectsRaw);
  }, [entries, projectId]);

  // Add entry with optional auto-cost
  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !tokens || tokens <= 0) return;

    const newEntry: UsageEntry = {
      id: crypto.randomUUID(),
      date,
      tokens,
      cost: Number((computedCost || 0).toFixed(6)),
      provider: selectedProvider || provider,   // store per-entry
      model: selectedModel || undefined,        // store per-entry
      rateUsdPer1k: effectiveRate,              // snapshot used for this entry
    };

    const next = [newEntry, ...entries];
    setEntries(next);

    // reset: keep provider, reset model; date -> today
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

  // Edit entry
  const startEdit = (row: UsageEntry) => {
    setEditingId(row.id as string);
    setEditDate(row.date);
    setEditTokens(String(row.tokens));
    setEditCost(String(row.cost));
  };

  const saveEdit = () => {
    if (!editingId) return;
    setEntries(entries.map((e) => {
      if (e.id === editingId) {
        const tokensNum = Number(editTokens);
        const costNum = editCost.trim() !== ""
          ? Number(editCost)
          : (e.rateUsdPer1k ?? projectRate)
            ? (tokensNum / 1000) * (e.rateUsdPer1k ?? projectRate!)
            : 0;
        return { ...e, date: editDate, tokens: tokensNum, cost: Number(costNum.toFixed(6)) };
      }
      return e;
    }));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const deleteEntry = (id: string) => setEntries(entries.filter((e) => e.id !== id));

  // Clear all entries
  const clearAllEntries = () => {
    if (window.confirm("Are you sure you want to clear all entries?")) setEntries([]);
  };

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);

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
        {projectRate !== undefined && (
          <p className="text-slate-400 mb-2">
            Rate in use: <span className="text-cyan-300">${projectRate.toFixed(4)}</span> per 1k tokens
          </p>
        )}

        {/* Add Entry Card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
          <form onSubmit={addEntry} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />

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
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            >
              {provider && <option value={provider}>{provider}</option>}
              {["openai","anthropic","mistral","google","deepseek","other"].map(p => (
                <option key={p} value={p}>{p === "other" ? "Other…" : p}</option>
              ))}
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!providerKey && customRate === undefined}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            >
              <option value="">Select model</option>
              {modelOptions.map(m => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Tokens"
              value={tokens ? String(tokens) : ""}
              onChange={(e) => setTokens(Number(e.target.value))}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />

            <p className="text-xs text-slate-400 mt-1">
              {customRate
                ? `Custom rate: $${customRate}/1k tokens`
                : effectiveRate
                  ? `Rate: $${effectiveRate}/1k tokens`
                  : "Pick a provider and model to enable tokens → cost"}
            </p>

            <button
              type="submit"
              className="rounded-lg px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 transition shadow shadow-cyan-900/30"
            >
              Add
            </button>
          </form>
          {saved && <p className="text-emerald-400 text-sm mt-2">✅ Saved</p>}
        </div>

        {/* Table */}
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
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No usage entries yet
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-t border-white/10 ${i % 2 === 0 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.06] transition`}
                  >
                    {editingId === e.id ? (
                      <>
                        {/* Date */}
                        <td className="px-5 py-3">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(ev) => setEditDate(ev.target.value)}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1"
                          />
                        </td>

                        {/* Provider (read-only for now) */}
                        <td className="px-5 py-3">{e.provider ?? "—"}</td>

                        {/* Model (read-only for now) */}
                        <td className="px-5 py-3">{e.model ?? "—"}</td>

                        {/* Tokens */}
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            value={editTokens}
                            onChange={(ev) => { setEditTokens(ev.target.value); setEditCost(""); }}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1 text-right"
                          />
                        </td>

                        {/* Rate ($/1k) */}
                        <td className="px-5 py-3 text-right">
                          {typeof e.rateUsdPer1k === "number" ? e.rateUsdPer1k : (projectRate ?? "—")}
                        </td>

                        {/* Cost ($) – preview computed unless user typed one */}
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            step="0.000001"
                            value={
                              editCost !== ""
                                ? editCost
                                : (() => {
                                    const r = (typeof e.rateUsdPer1k === "number" ? e.rateUsdPer1k : projectRate) ?? 0;
                                    const t = Number(editTokens || 0);
                                    if (!r || !t) return "0";
                                    return ((t / 1000) * r).toFixed(6);
                                  })()
                            }
                            onChange={(ev) => setEditCost(ev.target.value)}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1 text-right"
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3 text-center space-x-2">
                          <button onClick={saveEdit} className="rounded-md px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500">Save</button>
                          <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 bg-slate-600 hover:bg-slate-500">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3">{e.date}</td>
                        <td className="px-5 py-3">{e.provider ?? provider ?? "—"}</td>
                        <td className="px-5 py-3">{e.model ?? "—"}</td>
                        <td className="px-5 py-3 text-right">{e.tokens.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">{typeof e.rateUsdPer1k === "number" ? e.rateUsdPer1k : "—"}</td>
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
                      </>
                    )}
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
          Total Cost: ${totalCost.toFixed(6)}
        </p>
      </div>
    </main>
  );
}
