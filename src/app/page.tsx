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
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [totals, setTotals] = useState<Record<number, { total: number; lastDate: string | null }>>({});
  const [saved, setSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Autofocus on first load
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Load projects
  useEffect(() => {
    const stored = localStorage.getItem("projects");
    if (stored) setProjects(JSON.parse(stored));
  }, []);

  // Save projects
  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));
    const map: Record<number, { total: number; lastDate: string | null }> = {};
    projects.forEach((p) => (map[p.id] = getProjectTotals(p.id)));
    setTotals(map);
  }, [projects]);

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    setProjects([...projects, { id: Date.now(), name, provider }]);
    setName("");
    setProvider("");
    nameRef.current?.focus();
    flashSaved();
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

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setName("");
      setProvider("");
      nameRef.current?.focus();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50" onKeyDown={handleKeyDown}>
      <nav className="w-full flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-2xl font-bold">Spend Guard</h1>
        <span className="text-sm text-gray-500">v0.1 MVP</span>
      </nav>

      <form onSubmit={addProject} className="flex gap-2 mb-6">
        <input
          ref={nameRef}
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Provider (OpenAI, Claude, etc.)"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Add
        </button>
      </form>

      {saved && <p className="text-green-600 mb-4">✅ Saved</p>}

      <table className="border-collapse w-full max-w-md bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Project</th>
            <th className="border px-4 py-2 text-left">Provider</th>
            <th className="border px-4 py-2 text-right">Total ($)</th>
            <th className="border px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                No projects yet. Add one above
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <tr key={p.id}>
                <td className="border px-4 py-2">
                  <Link
                    href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}&provider=${encodeURIComponent(p.provider)}`}
                    className="text-blue-600 underline"
                  >
                    {p.name}
                  </Link>
                  {totals[p.id]?.lastDate && (
                    <div className="text-xs text-gray-500">Last: {totals[p.id].lastDate}</div>
                  )}
                </td>
                <td className="border px-4 py-2">{p.provider}</td>
                <td className="border px-4 py-2 text-right">
                  ${(totals[p.id]?.total ?? 0).toFixed(2)}
                </td>
                <td className="border px-4 py-2 text-center">
                  <button
                    onClick={() => deleteProject(p.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {projects.length > 0 && (
        <button
          onClick={clearAllProjects}
          className="mt-6 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Clear All Projects
        </button>
      )}
    </main>
  );
}
