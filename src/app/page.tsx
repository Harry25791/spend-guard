"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Project {
  id: number;
  name: string;
  provider: string;
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

export default function Home() {
  // ✅ Initialize from localStorage (no flicker + reliable back nav)
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("projects");
    return stored ? JSON.parse(stored) : [];
  });

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [totals, setTotals] = useState<Record<number, { total: number; lastDate: string | null }>>({});
  const [saved, setSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Autofocus
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Persist + recompute totals whenever projects change
  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));
    const map: Record<number, { total: number; lastDate: string | null }> = {};
    projects.forEach((p) => (map[p.id] = getProjectTotals(p.id)));
    setTotals(map);
  }, [projects]);

  // ✅ Resync on tab focus / visibility (covers client back/forward etc.)
  useEffect(() => {
    const resync = () => {
      const stored = localStorage.getItem("projects");
      const parsed = stored ? JSON.parse(stored) : [];
      // only set if changed to avoid loops
      if (JSON.stringify(parsed) !== JSON.stringify(projects)) setProjects(parsed);
    };
    window.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [projects]);

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    setProjects([...projects, { id: Date.now(), name, provider }]);
    setName("");
    setProvider("");
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

  // 🎨 quick theme: dark gradient bg + glass cards + neon accents
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#0b1023] via-[#0e1330] to-[#111827] text-slate-100">
      {/* Header */}
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
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No projects yet. Add one above
                  </td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-t border-white/10 ${
                      i % 2 === 0 ? "bg-white/[0.02]" : ""
                    } hover:bg-white/[0.06] transition`}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}&provider=${encodeURIComponent(
                          p.provider
                        )}`}
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

        {projects.length > 0 && (
          <div className="flex justify-end pt-4">
            <button
              onClick={clearAllProjects}
              className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition shadow shadow-rose-900/30"
            >
              Clear All Projects
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
