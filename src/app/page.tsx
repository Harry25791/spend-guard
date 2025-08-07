"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Project {
  id: number;
  name: string;
  provider: string;
  rateUsdPer1k?: number; // ADD: rate field
}

function getProjectTotals(projectId: number) {
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

// ADD: provider → rate defaults
const PROVIDER_DEFAULTS: Record<string, number> = {
  OpenAI: 0.5,
  Claude: 0.8,
  "Google Gemini": 0.2,
};

// Normalize provider names
function normalizeProvider(p: string) {
  return p.trim().toLowerCase();
}

// Case/space-insensitive lookup
function getDefaultRate(providerInput: string): number | undefined {
  const key = normalizeProvider(providerInput);
  const map: Record<string, number> = Object.fromEntries(
    Object.entries(PROVIDER_DEFAULTS).map(([k, v]) => [k.toLowerCase(), v])
  );
  return map[key];
}

// ADD: export type
type ExportShape = {
  projects: Project[];
  entries: Record<string, any[]>;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("projects");
    return stored ? JSON.parse(stored) : [];
  });

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [rate, setRate] = useState<string>(""); // ADD: rate state
  const [totals, setTotals] = useState<Record<number, { total: number; lastDate: string | null }>>({});
  const [saved, setSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));
    const map: Record<number, { total: number; lastDate: string | null }> = {};
    projects.forEach((p) => (map[p.id] = getProjectTotals(p.id)));
    setTotals(map);
  }, [projects]);

  useEffect(() => {
    const resync = () => {
      const stored = localStorage.getItem("projects");
      const parsed = stored ? JSON.parse(stored) : [];
      if (JSON.stringify(parsed) !== JSON.stringify(projects)) setProjects(parsed);
    };
    window.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [projects]);

  // ADD: export handler
  const exportData = () => {
    const entries: Record<string, any[]> = {};
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("entries-")) {
        const v = localStorage.getItem(k);
        entries[k] = v ? JSON.parse(v) : [];
      }
    });
    const payload: ExportShape = { projects, entries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spend-guard-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ADD: import handler
  const importData = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ExportShape;
        localStorage.setItem("projects", JSON.stringify(parsed.projects ?? []));
        Object.keys(parsed.entries ?? {}).forEach((k) => {
          localStorage.setItem(k, JSON.stringify(parsed.entries[k]));
        });
        setProjects(parsed.projects ?? []);
        alert("Import complete ✅");
      } catch {
        alert("Import failed ❌ Invalid file.");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  };

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;

    const fallback = getDefaultRate(provider); // case/space‑insensitive
    let chosen = rate ? Number(rate) : fallback;

    // Clamp obviously-wrong values (e.g., 1000)
    if (chosen !== undefined) {
      if (Number.isNaN(chosen) || chosen < 0) chosen = 0;
      if (chosen > 10) chosen = 10; // providers are typically << $10 / 1k tokens
    } // ✅ this closing brace was missing

    setProjects([
      ...projects,
      {
        id: Date.now(),
        name: name.trim(),
        provider: provider.trim(),
        rateUsdPer1k: chosen, // may be undefined; that’s fine
      },
    ]);

    setName("");
    setProvider("");
    setRate("");
    nameRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };


  const deleteProject = (id: number) => {
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
            <input
              type="text"
              placeholder="Provider (OpenAI, Claude, etc.)"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            {/* ADD: Rate input */}
            <input
              type="number"
              step="0.01"
              placeholder="Rate $/1k tokens (optional)"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
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
                        href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}&provider=${encodeURIComponent(p.provider)}`}
                        className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40"
                      >
                        {p.name}
                      </Link>
                      {totals[p.id]?.lastDate && (
                        <div className="text-xs text-slate-400 mt-1">Last: {totals[p.id].lastDate}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-200">{p.provider}</td>
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

          {projects.length > 0 && (
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
