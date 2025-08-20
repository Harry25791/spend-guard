"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import Aurora from "@/components/ui/Aurora";

// Types
import type { Project as ProjectType } from "@/lib/storage";

// Import/export + scope + filtered helpers
import {
  downloadExport,
  importAll,
  downloadFilteredCSV,
  downloadFilteredJSON,
  getFilteredEntriesForAll,
  getViewScope,
  setViewScope,
  type ViewScope,
  labelForScope,
  filterByScope,
  SCOPE_OPTIONS,
} from "@/lib/io";

// Optional provider utils (kept for future use)
import { PROVIDER_DEFAULTS, normalizeProvider } from "@/lib/rates";

// Aggregation helper for timeline charts
import { groupEntriesByPeriod } from "@/lib/aggregate";

// Charts
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

type Project = ProjectType;

/** Client-only wrapper to avoid SSR/CSR markup mismatches for insights UI */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div suppressHydrationWarning>{mounted ? children : null}</div>;
}

// present but unused right now (kept so imports aren’t removed)
function getDefaultRate(providerInput: string): number | undefined {
  const key = normalizeProvider(providerInput);
  if (!key) return undefined;
  return (PROVIDER_DEFAULTS as Record<string, number>)[key];
}

export default function Home() {
  // Persisted scope — hydration-safe: start as "month" on BOTH server and first client render.
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => {
    try {
      setScopeState(getViewScope());
    } catch {}
  }, []);
  const setScope = (s: ViewScope) => {
    setScopeState(s);
    if (typeof window !== "undefined") setViewScope(s);
  };

  // Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("projects");
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.map((p: any) => ({ ...p, id: String(p.id) })) : [];
  });

  // UI state
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);
  const hasProjects = hydrated && projects.length > 0;

  // Alerts settings
  type AlertSettings = { alertsEnabled: boolean; monthlyLimitUsd: number };
  const [settings, setSettings] = useState<AlertSettings>(() => {
    if (typeof window === "undefined") return { alertsEnabled: true, monthlyLimitUsd: 0 };
    const raw = localStorage.getItem("settings");
    if (!raw) return { alertsEnabled: true, monthlyLimitUsd: 0 };
    try {
      const parsed = JSON.parse(raw);
      return {
        alertsEnabled: !!parsed.alertsEnabled,
        monthlyLimitUsd: Number(parsed.monthlyLimitUsd) || 0,
      };
    } catch {
      return { alertsEnabled: true, monthlyLimitUsd: 0 };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = localStorage.getItem("settings");
    let merged: any = {};
    try {
      merged = prev ? JSON.parse(prev) : {};
    } catch {}
    merged.alertsEnabled = settings.alertsEnabled;
    merged.monthlyLimitUsd = settings.monthlyLimitUsd;
    localStorage.setItem("settings", JSON.stringify(merged));
  }, [settings]);

  // Provider labels per project (lifetime)
  const [providerLabels, setProviderLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));

    const providerMap: Record<string, string> = {};
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) {
        providerMap[p.id] = "—";
        continue;
      }
      try {
        const entries: { provider?: string }[] = JSON.parse(raw);
        const set = new Set(
          entries
            .map((e) => (e.provider || "").trim())
            .filter((v) => v.length > 0)
            .map((v) => v.toLowerCase())
        );
        providerMap[p.id] = set.size === 0 ? "—" : set.size === 1 ? Array.from(set)[0] : "Multiple Providers";
      } catch {
        providerMap[p.id] = "—";
      }
    }

    setProviderLabels(providerMap);
  }, [projects]);

  // Cross-tab resync
  useEffect(() => {
    const resync = () => {
      const stored = localStorage.getItem("projects");
      const parsed = stored ? JSON.parse(stored) : [];
      const normalized = Array.isArray(parsed) ? parsed.map((p: any) => ({ ...p, id: String(p.id) })) : [];
      if (JSON.stringify(normalized) !== JSON.stringify(projects)) setProjects(normalized);
    };
    window.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [projects]);

  // This-month total (for alerts only)
  const monthTotal = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const prefix = `${yyyy}-${mm}`;
    let sum = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        for (const e of arr) {
          if ((e?.date || "").startsWith(prefix)) sum += Number(e.cost) || 0;
        }
      } catch {}
    }
    return sum;
  }, [projects, hydrated]);

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const isOverLimit =
    hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && (monthTotal ?? 0) > settings.monthlyLimitUsd;

  // -------- Insights data (client-only) --------
  const [insightsReady, setInsightsReady] = useState(false);
  useEffect(() => setInsightsReady(true), []);

  // Build filtered entries across all projects for the current scope (client only)
  const filteredAll = useMemo(() => {
    if (!insightsReady) return { projects: [] as Project[], entries: {} as Record<string, any[]> };
    return getFilteredEntriesForAll(scope);
  }, [insightsReady, scope, projects]);

  // Per-model breakdown (provider/model → tokens, cost)
  const modelBreakdown = useMemo(() => {
    const agg: Record<string, { provider: string; tokens: number; cost: number }> = {};
    for (const p of filteredAll.projects) {
      const rows = filteredAll.entries[p.id] ?? [];
      for (const e of rows) {
        const key = `${(e.provider ?? "unknown").toLowerCase()}::${e.model ?? "unknown"}`;
        if (!agg[key]) agg[key] = { provider: e.provider ?? "unknown", tokens: 0, cost: 0 };
        agg[key].tokens += Number(e.tokens) || 0;
        agg[key].cost += Number(e.cost) || 0;
      }
    }
    return agg;
  }, [filteredAll]);

  // Top-8 by cost for the bar chart
  const barData = useMemo(() => {
    const rows = Object.entries(modelBreakdown).map(([k, v]) => ({
      name: `${v.provider}/${k.split("::")[1]}`,
      cost: Number(v.cost.toFixed(2)),
    }));
    rows.sort((a, b) => b.cost - a.cost);
    return rows.slice(0, 8);
  }, [modelBreakdown]);

  // Show-all toggle for the table
  const [modelExpanded, setModelExpanded] = useState(false);
  useEffect(() => setModelExpanded(false), [scope]); // reset on scope change

  // Timeline: day for all non-lifetime scopes; month for lifetime
  const timeline = useMemo(() => {
    const flat: Array<{ date: string; cost: number; tokens?: number }> = [];
    for (const p of filteredAll.projects) {
      for (const e of filteredAll.entries[p.id] ?? []) {
        flat.push({ date: e.date, cost: Number(e.cost) || 0, tokens: Number(e.tokens) || 0 });
      }
    }
    const period = scope === "lifetime" ? "month" : "day";
    return groupEntriesByPeriod(flat, period);
  }, [filteredAll, scope]);

  // Per-project totals for the CURRENT scope (drives the table)
  const scopedTotals = useMemo(() => {
    const map: Record<string, { total: number; lastDate: string | null }> = {};
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) {
        map[p.id] = { total: 0, lastDate: null };
        continue;
      }
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        const filtered = arr.filter((e) => filterByScope(e?.date || "", scope));
        const total = filtered.reduce((s, e) => s + (Number(e.cost) || 0), 0);
        const lastDate =
          filtered.length > 0
            ? filtered.map((e) => e.date).reduce((a, b) => (a > b ? a : b))
            : null;
        map[p.id] = { total, lastDate };
      } catch {
        map[p.id] = { total: 0, lastDate: null };
      }
    }
    return map;
  }, [projects, scope, hydrated]);

  // -------- actions --------
  const exportData = () => {
    downloadExport(); // full backup (JSON v2)
  };

  const importData = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importAll(text, "merge"); // or "replace"
      alert(
        `Import complete.\nProjects: ${res.projects}\nEntries: ${res.entries}${
          res.warnings.length ? `\nWarnings:\n- ${res.warnings.join("\n- ")}` : ""
        }`
      );
      location.reload();
    } catch (err: any) {
      alert(`Import failed: ${err?.message || String(err)}`);
    } finally {
      ev.target.value = "";
    }
  };

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setProjects((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: name.trim(), provider: "", rateUsdPer1k: undefined },
    ]);

    setName("");
    nameRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    localStorage.removeItem(`entries-${id}`);
  };

  const clearAllProjects = () => {
    if (window.confirm("Are you sure you want to clear all projects?")) {
      setProjects([]);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("entries-")) localStorage.removeItem(key);
      });
      localStorage.removeItem("projects");
    }
  };

  // -------- render --------
  const timelineTitle =
    scope === "lifetime" ? "Totals — By Month (Lifetime)" : `Totals — By Day (${labelForScope(scope)})`;

  return (
    <AppShell>
      <Aurora />

      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/0">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            <span className="mr-2">🛡️</span>Spend Guard
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAlertsOpen(true)}
              aria-label="Alerts"
              className="relative rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-200 hover:bg-white/10"
              title="Alerts"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2a6 6 0 00-6 6v2.268c0 .52-.214 1.018-.593 1.376L4 14h16l-1.407-2.356A1.94 1.94 0 0118 10.268V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {isOverLimit && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#0e1330]" />
              )}
            </button>
            <span className="text-xs md:text-sm text-slate-400">v0.2</span>
          </div>
        </div>
      </header>

      {/* Over-limit banner */}
      {hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && monthTotal > settings.monthlyLimitUsd && (
        <div className="mx-auto max-w-5xl px-6">
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                Monthly spend alert: You’ve used <span className="font-semibold">${monthTotal.toFixed(2)}</span> this month,
                over your limit of <span className="font-semibold">${settings.monthlyLimitUsd.toFixed(2)}</span>.
              </p>
              <button
                onClick={() => setSettings((s) => ({ ...s, alertsEnabled: false }))}
                className="text-xs underline decoration-amber-300/50 hover:opacity-80"
              >
                Dismiss alerts
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-6 py-8">
        {/* Add Project Card */}
        <div className="sg-card p-4 mb-6">
          <form onSubmit={addProject} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={nameRef}
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <button
              type="submit"
              className="rounded-lg px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 transition shadow shadow-cyan-900/30"
            >
              Add
            </button>
          </form>
          {saved && <p className="text-emerald-400 text-sm mt-2">✅ Saved</p>}
        </div>

        {/* Per-model breakdown (global, filtered) */}
        <ClientOnly>
          <div className="sg-card p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Per-model breakdown — {labelForScope(scope)}
              </h3>
              <span className="text-xs text-slate-400">Top 8 by cost</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={50} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-300">
                  <tr>
                    <th className="text-left py-2 pr-4">Provider/Model</th>
                    <th className="text-right py-2 pr-4">Tokens</th>
                    <th className="text-right py-2">Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(modelBreakdown).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No data
                      </td>
                    </tr>
                  ) : (
                    (modelExpanded ? Object.entries(modelBreakdown) : Object.entries(modelBreakdown).slice(0, 12))
                      .sort(([, a], [, b]) => b.cost - a.cost)
                      .map(([k, v]) => (
                        <tr key={k} className="border-t border-white/10">
                          <td className="py-2 pr-4">{`${v.provider}/${k.split("::")[1]}`}</td>
                          <td className="py-2 pr-4 text-right">{v.tokens.toLocaleString()}</td>
                          <td className="py-2 text-right">{v.cost.toFixed(2)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
              {Object.entries(modelBreakdown).length > 12 && (
                <div className="mt-2">
                  <button
                    onClick={() => setModelExpanded((v) => !v)}
                    className="text-xs text-cyan-300 hover:text-cyan-200 underline"
                  >
                    {modelExpanded ? "Show top 12" : "Show all"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ClientOnly>

        {/* Monthly/Daily totals line chart */}
        <ClientOnly>
          <div className="sg-card p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">{timelineTitle}</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cost" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ClientOnly>

        {/* Projects Table Card (mirrors selected scope) */}
        <div className="sg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-slate-300 text-sm">
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3 text-right">Total ($) — {labelForScope(scope)}</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {!hydrated ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No projects yet. Add one above
                  </td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-t border-white/10 ${i % 2 === 0 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.06] transition`}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}`}
                        className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40"
                      >
                        {p.name}
                      </Link>
                      {scopedTotals[p.id]?.lastDate && (
                        <div className="text-xs text-slate-400 mt-1">Last: {scopedTotals[p.id].lastDate}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-200">{hydrated ? providerLabels[p.id] ?? "—" : "—"}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      ${(scopedTotals[p.id]?.total ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="rounded-md px-3 py-1.5 bg-rose-500 hover:bg-rose-400 active:bg-rose-600 transition"
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

        {/* Controls: scope, filtered exports, full backup, import, clear */}
        <div className="flex flex-wrap items-center gap-3 justify-between pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">View:</span>
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

            {/* Expanded ranges — functional now, pretty later */}
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ViewScope)}
              className="ml-2 rounded-md bg-white/10 border border-white/10 px-2 py-1 text-slate-100"
              title="Select time range"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => downloadFilteredCSV(scope)}
              className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 transition"
            >
              Export CSV — {labelForScope(scope)}
            </button>
            <button
              onClick={() => downloadFilteredJSON(scope)}
              className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 transition"
            >
              Export JSON — {labelForScope(scope)}
            </button>
            <button
              onClick={exportData}
              className="rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition"
              title="Full backup (all data, versioned JSON)"
            >
              Full Backup (JSON v2)
            </button>

            <label className="rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer">
              Import JSON
              <input type="file" accept="application/json" onChange={importData} className="hidden" />
            </label>
          </div>

          {hasProjects && (
            <button onClick={clearAllProjects} className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 transition">
              Clear All Projects
            </button>
          )}
        </div>

        {/* Alerts Settings Modal */}
        {isAlertsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAlertsOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Alerts</h3>
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/10"
                  aria-label="Close alerts settings"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.alertsEnabled}
                    onChange={(e) => setSettings((s) => ({ ...s, alertsEnabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/10 bg-white/10"
                  />
                  Enable alerts
                </label>

                <div>
                  <label className="block text-sm mb-1 text-slate-300">Monthly limit (USD)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">$</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={settings.monthlyLimitUsd || ""}
                      onChange={(e) => setSettings((s) => ({ ...s, monthlyLimitUsd: Number(e.target.value) || 0 }))}
                      placeholder="Monthly limit"
                      className="w-40 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    This month so far: <span className="text-slate-200">${(monthTotal ?? 0).toFixed(2)}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setIsAlertsOpen(false)} className="rounded-md px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500">
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
