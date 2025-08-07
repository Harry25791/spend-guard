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
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  // Reload entries if project changes
  useEffect(() => {
    if (!projectId) return;
    const stored = localStorage.getItem(`entries-${projectId}`);
    if (stored) setEntries(JSON.parse(stored));
  }, [projectId]);

  // Persist entries + touch projects so totals update on Home
  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(`entries-${projectId}`, JSON.stringify(entries));
    const projectsRaw = localStorage.getItem("projects");
    if (projectsRaw) localStorage.setItem("projects", projectsRaw);
  }, [entries, projectId]);

  // Add entry with optional auto-cost
  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !tokens) return;
    const tokensNum = Number(tokens);
    const costNum = cost
      ? Number(cost)
      : projectRate
      ? (tokensNum / 1000) * projectRate
      : 0;
    setEntries([...entries, { id: Date.now(), date, tokens: tokensNum, cost: costNum }]);
    setDate("");
    setTokens("");
    setCost("");
    dateRef.current?.focus();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  // Edit entry
  const startEdit = (e: UsageEntry) => {
    setEditingId(e.id);
    setEditDate(e.date);
    setEditTokens(String(e.tokens));
    setEditCost(String(e.cost));
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setEntries(entries.map((e) => {
      if (e.id === editingId) {
        const tokensNum = Number(editTokens);
        const costNum = editCost
          ? Number(editCost)
          : projectRate
            ? (tokensNum / 1000) * projectRate
            : 0;
        return { ...e, date: editDate, tokens: tokensNum, cost: costNum };
      }
      return e;
    }));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  // Delete entry
  const deleteEntry = (id: number) => setEntries(entries.filter((e) => e.id !== id));

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
            <input
              type="number"
              placeholder="Tokens"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <input
              type="number"
              step="0.01"
              placeholder={`Cost ($) ${projectRate ? "(auto if blank)" : ""}`}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
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

        {/* Table */}
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
                        <td className="px-5 py-3">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(ev) => setEditDate(ev.target.value)}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            value={editTokens}
                            onChange={(ev) => { setEditTokens(ev.target.value); setEditCost(""); }}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={editCost}
                            onChange={(ev) => setEditCost(ev.target.value)}
                            className="w-full rounded bg-white/10 border border-white/10 px-2 py-1"
                          />
                        </td>
                        <td className="px-5 py-3 text-center space-x-2">
                          <button onClick={saveEdit} className="rounded-md px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500">Save</button>
                          <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 bg-slate-600 hover:bg-slate-500">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3">{e.date}</td>
                        <td className="px-5 py-3">{e.tokens}</td>
                        <td className="px-5 py-3">${e.cost.toFixed(2)}</td>
                        <td className="px-5 py-3 text-center space-x-2">
                          <button onClick={() => startEdit(e)} className="rounded-md px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500">Edit</button>
                          <button onClick={() => deleteEntry(e.id)} className="rounded-md px-3 py-1.5 bg-rose-500 hover:bg-rose-400">Delete</button>
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
          Total Cost: ${totalCost.toFixed(2)}
        </p>
      </div>
    </main>
  );
}
