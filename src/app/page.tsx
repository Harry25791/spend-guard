"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { downloadExport, importAll } from "@/lib/io";
import { PROVIDER_DEFAULTS, normalizeProvider } from "@/lib/rates";
import type { Project as ProjectType } from "@/lib/storage";

type Project = ProjectType;

function getProjectTotals(projectId: string) {
  try {
    const raw = localStorage.getItem(`entries-${projectId}`);
    if (!raw) return { total: 0, lastDate: null as string | null };
    const entries: { date: string; tokens: number; cost: number }[] = JSON.parse(raw);
    const total = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const lastDate = entries.length ? entries[entries.length - 1].date : null;
    return { total, lastDate };
  } catch {
    return { total: 0, lastDate: null };
  }
}

// Case/space-insensitive lookup using shared catalog
function getDefaultRate(providerInput: string): number | undefined {
  const key = normalizeProvider(providerInput); // returns provider key or null
  if (!key) return undefined;
  // PROVIDER_DEFAULTS is keyed by normalized provider keys (e.g., "openai")
  return (PROVIDER_DEFAULTS as Record<string, number>)[key];
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("projects");
    const parsed = stored ? JSON.parse(stored) : [];
    // normalize id to string to match lib/storage types
    return Array.isArray(parsed)
      ? parsed.map((p: any) => ({ ...p, id: String(p.id) }))
      : [];
  });

  const [name, setName] = useState("");
  const [totals, setTotals] = useState<Record<string, { total: number; lastDate: string | null }>>({});
  const [providerLabels, setProviderLabels] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

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
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);    

  const nameRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(false);
  const hasProjects = hydrated && projects.length > 0;
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));

    const totalsMap: Record<string, { total: number; lastDate: string | null }> = {};
    const providerMap: Record<string, string> = {};

    for (const p of projects) {
      totalsMap[p.id] = getProjectTotals(p.id);

      // compute provider label from entries
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) {
        providerMap[p.id] = "—";
        continue;
      }
      try {
        const entries: { provider?: string }[] = JSON.parse(raw);
        const set = new Set(
          entries
            .map(e => (e.provider || "").trim())
            .filter(v => v.length > 0)
            .map(v => v.toLowerCase())
        );
        providerMap[p.id] =
          set.size === 0 ? "—" :
          set.size === 1 ? Array.from(set)[0] :
          "Multiple Providers";
      } catch {
        providerMap[p.id] = "—";
      }
    }

    setTotals(totalsMap);
    setProviderLabels(providerMap);
  }, [projects]);

  function isSameMonthISO(iso: string, base: Date) {
    const d = new Date(iso);
    return d.getUTCFullYear() === base.getUTCFullYear() && d.getUTCMonth() === base.getUTCMonth();
  }

  const monthTotal = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const now = new Date();
    let sum = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        for (const e of arr) {
          if (e?.date && isSameMonthISO(e.date, now)) sum += Number(e.cost) || 0;
        }
      } catch {}
    }
    return sum;
  }, [projects, hydrated]);

  useEffect(() => {
    const resync = () => {
      const stored = localStorage.getItem("projects");
      const parsed = stored ? JSON.parse(stored) : [];
      const normalized = Array.isArray(parsed)
        ? parsed.map((p: any) => ({ ...p, id: String(p.id) }))
        : [];
      if (JSON.stringify(normalized) !== JSON.stringify(projects)) setProjects(normalized);
    };
    window.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [projects]);

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const isOverLimit =
    hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && (monthTotal ?? 0) > settings.monthlyLimitUsd;

  // ADD: export handler (uses versioned exporter)
  const exportData = () => {
    downloadExport(); // creates a v2 export and downloads it
  };

  // ADD: import handler (accepts v1 or v2; auto‑upgrades v1)
  const importData = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importAll(text, "merge"); // or "replace" to overwrite
      alert(
        `Import complete.\nProjects: ${res.projects}\nEntries: ${res.entries}${
          res.warnings.length ? `\nWarnings:\n- ${res.warnings.join("\n- ")}` : ""
        }`
      );
      location.reload(); // refresh list/totals
    } catch (err: any) {
      alert(`Import failed: ${err?.message || String(err)}`);
    } finally {
      ev.target.value = "";
    }
  };

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setProjects([
      ...projects,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        provider: "",
        rateUsdPer1k: undefined, // may be undefined; that’s fine
      },
    ]);

    setName("");
    nameRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };


  const deleteProject = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id));
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

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#0b1023] via-[#0e1330] to-[#111827] text-slate-100">
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
              {/* Bell icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2a6 6 0 00-6 6v2.268c0 .52-.214 1.018-.593 1.376L4 14h16l-1.407-2.356A1.94 1.94 0 0118 10.268V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
              </svg>
              {/* Red dot when over limit */}
              {isOverLimit && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#0e1330]"></span>
              )}
            </button>
            <span className="text-xs md:text-sm text-slate-400">v0.2</span>
          </div>
        </div>
      </header>

      {hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && monthTotal > settings.monthlyLimitUsd && (
      <div className="mx-auto max-w-5xl px-6">
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Monthly spend alert: You’ve used <span className="font-semibold">${monthTotal.toFixed(2)}</span> this month,
              over your limit of <span className="font-semibold">${settings.monthlyLimitUsd.toFixed(2)}</span>.
            </p>
            <button
              onClick={() => setSettings(s => ({ ...s, alertsEnabled: false }))}
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
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
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

        {/* Projects Table Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-slate-300 text-sm">
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3 text-right">Total ($)</th>
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
                      {totals[p.id]?.lastDate && (
                        <div className="text-xs text-slate-400 mt-1">Last: {totals[p.id].lastDate}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-200">
                      {hydrated ? providerLabels[p.id] ?? "—" : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      ${(totals[p.id]?.total ?? 0).toFixed(2)}
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

        {/* ADD: Import/Export + Clear buttons */}
        <div className="flex flex-wrap items-center gap-3 justify-between pt-4">
          <div className="flex gap-3">
            <button
              onClick={exportData}
              className="rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition"
            >
              Export JSON
            </button>

            <label className="rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer">
              Import JSON
              <input type="file" accept="application/json" onChange={importData} className="hidden" />
            </label>
          </div>

          {hasProjects && (
            <button
              onClick={clearAllProjects}
              className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 transition"
            >
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
                    onChange={(e) => setSettings(s => ({ ...s, alertsEnabled: e.target.checked }))}
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
                      onChange={(e) => setSettings(s => ({ ...s, monthlyLimitUsd: Number(e.target.value) || 0 }))}
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
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  className="rounded-md px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
