"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

interface UsageEntry {
  id: number;
  date: string;
  tokens: number;
  cost: number;
}

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params?.id;
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Unnamed Project";
  const provider = searchParams.get("provider") ?? "Unknown Provider";

  const [entries, setEntries] = useState<UsageEntry[]>(() => {
    if (typeof window === "undefined" || !projectId) return [];
    const raw = localStorage.getItem(`entries-${projectId}`);
    return raw ? JSON.parse(raw) : [];
  });
  const [date, setDate] = useState("");
  const [tokens, setTokens] = useState("");
  const [cost, setCost] = useState("");
  const [saved, setSaved] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  // Load on ID change (safety)
  useEffect(() => {
    if (!projectId) return;
    const stored = localStorage.getItem(`entries-${projectId}`);
    if (stored) setEntries(JSON.parse(stored));
  }, [projectId]);

  // Persist entries and “touch” projects so Home recomputes totals
  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(`entries-${projectId}`, JSON.stringify(entries));
    const projectsRaw = localStorage.getItem("projects");
    if (projectsRaw) localStorage.setItem("projects", projectsRaw);
  }, [entries, projectId]);

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !tokens || !cost) return;
    setEntries([...entries, { id: Date.now(), date, tokens: Number(tokens), cost: Number(cost) }]);
    setDate("");
    setTokens("");
    setCost("");
    dateRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const deleteEntry = (id: number) => setEntries(entries.filter((e) => e.id !== id));

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

        {/* Add Entry Card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 p-4">
          <form onSubmit={addEntry} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <input
              type="number"
              placeholder="Tokens"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Cost ($)"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
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

        {/* Table Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg shadow-cyan-900/20 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-slate-300 text-sm">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Tokens</th>
                <th className="px-5 py-3">Cost ($)</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
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
                    <td className="px-5 py-3">{e.date}</td>
                    <td className="px-5 py-3">{e.tokens}</td>
                    <td className="px-5 py-3">${e.cost.toFixed(2)}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => deleteEntry(e.id)}
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

        {entries.length > 0 && (
          <div className="flex justify-end pt-4">
            <button
              onClick={clearAllEntries}
              className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition shadow shadow-rose-900/30"
            >
              Clear All Entries
            </button>
          </div>
        )}

        <p className="mt-4 text-lg font-semibold">
          Total Cost: ${totalCost.toFixed(2)}
        </p>
      </div>
    </main>
  );
}
