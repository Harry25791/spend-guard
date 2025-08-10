"use client";

import { useState, useEffect, useRef } from "react";
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
          <span className="text-xs md:text-sm text-slate-400">v0.2</span>
        </div>
      </header>

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
      </section>
    </main>
  );
}
