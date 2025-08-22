// src/app/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";

// UI
import SGCard from "@/components/ui/SGCard";
import KPIRow from "@/components/dashboard/KPIRow";

// Charts (Free tier)
import Timeline from "@/components/charts/Timeline";
import TopModelsBar from "@/components/charts/TopModelsBar";
import ProviderStackArea from "@/components/charts/ProviderStackArea";
import PieByModel from "@/components/charts/PieByModel";
import EntryHistogram from "@/components/charts/EntryHistogram";

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
  rangeForScope,
} from "@/lib/io";

type Project = ProjectType;

/** Client-only wrapper to avoid SSR/CSR markup mismatches for insights UI */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div suppressHydrationWarning>{mounted ? children : null}</div>;
}

export default function Home() {
  // Persisted scope — synced with AppShell header RangePicker
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => {
    try {
      setScopeState(getViewScope());
    } catch {}
  }, []);
  useEffect(() => {
    // react to header control
    const onScope = (e: any) => {
      const v = e?.detail?.scope as ViewScope | undefined;
      if (v) setScopeState(v);
    };
    window.addEventListener("sg:scope-change", onScope as EventListener);
    return () => window.removeEventListener("sg:scope-change", onScope as EventListener);
  }, []);
  const setScope = useCallback((s: ViewScope) => {
    // only used if you add a local control; AppShell already dispatches event
    setScopeState(s);
    setViewScope(s);
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: s } }));
  }, []);

  // Alerts modal open relay from AppShell bell
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  useEffect(() => {
    const open = () => setIsAlertsOpen(true);
    window.addEventListener("sg:open-alerts", open as EventListener);
    return () => window.removeEventListener("sg:open-alerts", open as EventListener);
  }, []);

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
  type AlertSettings = { alertsEnabled: boolean; monthlyLimitUsd: number; overLimit?: boolean };
  const [settings, setSettings] = useState<AlertSettings>(() => {
    if (typeof window === "undefined") return { alertsEnabled: true, monthlyLimitUsd: 0 };
    const raw = localStorage.getItem("settings");
    if (!raw) return { alertsEnabled: true, monthlyLimitUsd: 0 };
    try {
      const parsed = JSON.parse(raw);
      return {
        alertsEnabled: !!parsed.alertsEnabled,
        monthlyLimitUsd: Number(parsed.monthlyLimitUsd) || 0,
        overLimit: !!parsed.overLimit,
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
    merged.overLimit = settings.overLimit;
    localStorage.setItem("settings", JSON.stringify(merged));
  }, [settings]);

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

  // -------- Insights data (client-only) --------
  const [insightsReady, setInsightsReady] = useState(false);
  useEffect(() => setInsightsReady(true), []);

  // Build filtered entries across all projects for the current scope (client only)
  const filteredAll = useMemo(() => {
    if (!insightsReady) return { projects: [] as Project[], entries: {} as Record<string, any[]> };
    return getFilteredEntriesForAll(scope);
  }, [insightsReady, scope, projects]);

  // Flatten entries for charts
  const flatEntries = useMemo(() => {
    const out: Array<{ date: string; cost: number; tokens?: number; model?: string; provider?: string }> = [];
    for (const p of filteredAll.projects) {
      for (const e of filteredAll.entries[p.id] ?? []) {
        out.push({
          date: e.date,
          cost: Number(e.cost) || 0,
          tokens: Number(e.tokens) || 0,
          model: e.model,
          provider: e.provider,
        });
      }
    }
    return out;
  }, [filteredAll]);

  // Compute from/to based on scope (for gap-filling, cumulative, etc.)
  const { from, to } = useMemo(() => rangeForScope(scope, new Date()), [scope]);

  // KPI totals
  const lifetimeTotals = useMemo(() => {
    // lifetime from *all* entries regardless of scope
    let total = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ cost: number }> = JSON.parse(raw);
        for (const e of arr) total += Number(e.cost) || 0;
      } catch {}
    }
    return Number(total.toFixed(2));
  }, [projects]);

  const monthTotal = useMemo(() => {
    // use filterByScope("month") for local-month correctness
    let sum = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        for (const e of arr) {
          if (filterByScope(e.date, "month")) sum += Number(e.cost) || 0;
        }
      } catch {}
    }
    return Number(sum.toFixed(2));
  }, [projects, hydrated]);

  const projectsCount = projects.length;

  const overLimitActive =
    hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && monthTotal > settings.monthlyLimitUsd;

  useEffect(() => {
    // Keep an over-limit flag for the bell dot if you like
    setSettings((s) => ({ ...s, overLimit: overLimitActive }));
  }, [overLimitActive]);

  const limitText = settings.monthlyLimitUsd > 0
    ? overLimitActive
      ? `Over by $${(monthTotal - settings.monthlyLimitUsd).toFixed(2)}`
      : `Remaining $${(settings.monthlyLimitUsd - monthTotal).toFixed(2)}`
    : "No limit set";

  // Per-project totals for CURRENT scope (drives the table)
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
        map[p.id] = { total: Number(total.toFixed(2)), lastDate };
      } catch {
        map[p.id] = { total: 0, lastDate: null };
      }
    }
    return map;
  }, [projects, scope, hydrated]);

  // -------- actions --------
  const exportData = () => downloadExport();

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
  return (
    <div className="space-y-6">
      {/* Add Project */}
      <SGCard className="p-4">
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
      </SGCard>

      {/* KPI Row */}
      <ClientOnly>
        <KPIRow
          items={[
            { label: "This Month Spend", value: `$${monthTotal.toFixed(2)}` },
            { label: "Lifetime Spend", value: `$${lifetimeTotals.toFixed(2)}` },
            { label: "Projects", value: String(projectsCount) },
            { label: "Limit Status", value: limitText, warn: overLimitActive },
          ]}
        />
      </ClientOnly>

      {/* Charts */}
      <ClientOnly>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SGCard>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Spend over time — {labelForScope(scope)}
            </h3>
            <Timeline
              entries={flatEntries}
              from={from}
              to={to}
              cumulative
              valueKey="cumCost"
              ariaLabel="Cumulative spend"
            />
          </SGCard>

          <SGCard>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Top models — {labelForScope(scope)}
            </h3>
            <TopModelsBar entries={flatEntries} topN={6} />
          </SGCard>

          <SGCard>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Spend by provider — {labelForScope(scope)}
            </h3>
            <ProviderStackArea entries={flatEntries} from={from} to={to} />
          </SGCard>

          <SGCard>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Model share — {labelForScope(scope)}
            </h3>
            <PieByModel entries={flatEntries} />
          </SGCard>

          <SGCard className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Entry size distribution — {labelForScope(scope)}
            </h3>
            <EntryHistogram entries={flatEntries} metric="tokens" />
          </SGCard>
        </div>
      </ClientOnly>

      {/* Projects Table */}
      <SGCard className="overflow-hidden">
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
      </SGCard>

      {/* Controls: filtered exports, full backup, import, clear */}
      <div className="flex flex-wrap items-center gap-3 justify-between pt-2">
        <div className="text-sm text-slate-400">
          Scope: <span className="text-slate-200">{labelForScope(scope)}</span> (set in header)
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => downloadFilteredCSV(scope)}
            className="btn btn-emerald"
          >
            Export CSV — {labelForScope(scope)}
          </button>
          <button
            onClick={() => downloadFilteredJSON(scope)}
            className="btn btn-emerald"
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

          {hasProjects && (
            <button onClick={clearAllProjects} className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 transition">
              Clear All Projects
            </button>
          )}
        </div>
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
    </div>
  );
}
