"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RangePicker from "@/components/ui/RangePicker";
import { getViewScope, labelForScope, type ViewScope } from "@/lib/io";

type Project = {
  id: string;
  name: string;
  provider?: string;
  rateUsdPer1k?: number;
};

export default function ProjectsPage() {
  // scope is global (in header), but we mirror it read‑only to show labels
  const [scope, setScope] = useState<ViewScope>("month");
  useEffect(() => {
    try { setScope(getViewScope()); } catch {}
    const onFocus = () => { try { setScope(getViewScope()); } catch {} };
    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("projects");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((p: any) => ({ ...p, id: String(p.id) })) : [];
  });

  // keep projects in sync across tabs
  useEffect(() => {
    const resync = () => {
      const raw = localStorage.getItem("projects");
      const arr = raw ? JSON.parse(raw) : [];
      const norm = Array.isArray(arr) ? arr.map((p: any) => ({ ...p, id: String(p.id) })) : [];
      if (JSON.stringify(norm) !== JSON.stringify(projects)) setProjects(norm);
    };
    window.addEventListener("focus", resync);
    window.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("visibilitychange", resync);
    };
  }, [projects]);

  // Add project
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const next = [...projects, { id: crypto.randomUUID(), name: n }];
    setProjects(next);
    localStorage.setItem("projects", JSON.stringify(next));
    setName("");
    nameRef.current?.focus();
  };

  const deleteProject = (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    localStorage.setItem("projects", JSON.stringify(next));
    localStorage.removeItem(`entries-${id}`);
  };

  // scoped totals (read quickly just for table)
  const totalsByProject = useMemo(() => {
    const map: Record<string, { total: number; lastDate: string | null }> = {};
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) { map[p.id] = { total: 0, lastDate: null }; continue; }
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        // cheap re-use of label only; scope filtering is done elsewhere in app
        // here we just show lifetime last date + total (keeps this page light)
        const total = arr.reduce((s, e) => s + (Number(e.cost) || 0), 0);
        const lastDate = arr.length ? arr.map(e => e.date).reduce((a,b)=>a>b?a:b) : null;
        map[p.id] = { total, lastDate };
      } catch {
        map[p.id] = { total: 0, lastDate: null };
      }
    }
    return map;
  }, [projects]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Top intro + scope indicator (scope is set in header) */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Projects</h1>
        <span className="text-xs md:text-sm text-slate-400">Scope: {labelForScope(scope)} (set in header)</span>
      </div>

      {/* Add Project */}
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
            className="rounded-lg px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15 active:bg-white/20 transition"
          >
            Add Project
          </button>
        </form>
      </div>

      {/* Projects table */}
      <div className="sg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr className="text-left text-slate-300 text-sm">
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Last Entry</th>
              <th className="px-5 py-3 text-right">Lifetime Total ($)</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  No projects yet. Add one above.
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
                      href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}${p.provider ? `&provider=${encodeURIComponent(p.provider)}` : ""}`}
                      className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{totalsByProject[p.id]?.lastDate ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    ${(totalsByProject[p.id]?.total ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="rounded-md px-3 py-1.5 bg-white/10 border border-white/10 hover:bg-white/15 transition"
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

      <p className="mt-3 text-xs text-slate-500">
        Inline project view (expand below the table) will be added in a following step.
      </p>
    </main>
  );
}
