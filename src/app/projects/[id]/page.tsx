"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

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

  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [date, setDate] = useState("");
  const [tokens, setTokens] = useState("");
  const [cost, setCost] = useState("");

  // Load entries from localStorage
  useEffect(() => {
    if (!projectId) return;
    const stored = localStorage.getItem(`entries-${projectId}`);
    if (stored) {
      setEntries(JSON.parse(stored));
    }
  }, [projectId]);

  // Save entries whenever they change
  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(`entries-${projectId}`, JSON.stringify(entries));
  }, [entries, projectId]);

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !tokens || !cost) return;
    setEntries([
      ...entries,
      { id: Date.now(), date, tokens: Number(tokens), cost: Number(cost) },
    ]);
    setDate("");
    setTokens("");
    setCost("");
  };

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);

  const deleteEntry = (id: number) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const clearAllEntries = () => {
    if (window.confirm("Are you sure you want to clear all entries?")) {
      setEntries([]);
    }
  };



  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="text-gray-600 mb-6">{provider} – Usage Tracker</p>

      {/* Add Usage Form */}
      <form onSubmit={addEntry} className="flex gap-2 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Tokens"
          value={tokens}
          onChange={(e) => setTokens(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Cost ($)"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </form>

      {/* Usage Table */}
      <table className="border-collapse w-full max-w-lg bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Tokens</th>
            <th className="border px-4 py-2">Cost ($)</th>
            <th className="border px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center py-4 text-gray-500">
                No usage entries yet
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id}>
                <td className="border px-4 py-2">{e.date}</td>
                <td className="border px-4 py-2">{e.tokens}</td>
                <td className="border px-4 py-2">${e.cost.toFixed(2)}</td>
                <td className="border px-4 py-2 text-center">
                    <button
                        onClick={() => deleteEntry(e.id)}
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

      {/* Clear All Entries */}
      {entries.length > 0 && (
      <button
          onClick={clearAllEntries}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
          Clear All Entries
      </button>
      )}


      {/* Total */}
      <p className="mt-4 text-lg font-semibold">
        Total Cost: ${totalCost.toFixed(2)}
      </p>
    </main>
  );
}
