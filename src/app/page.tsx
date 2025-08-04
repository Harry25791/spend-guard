"use client";

import { useState } from "react";

export default function Home() {
  const [projects, setProjects] = useState<{ id: number; name: string; provider: string }[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    setProjects([...projects, { id: Date.now(), name, provider }]);
    setName("");
    setProvider("");
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      {/* Navbar */}
      <nav className="w-full flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-2xl font-bold">Spend Guard 🛡️</h1>
        <span className="text-sm text-gray-500">v0.1 MVP</span>
      </nav>

      {/* Add Project Form */}
      <form onSubmit={addProject} className="flex gap-2 mb-6">
        <input
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

      {/* Projects Table */}
      <table className="border-collapse w-full max-w-md bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Project</th>
            <th className="border px-4 py-2 text-left">Provider</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={2} className="text-center py-4 text-gray-500">
                No projects yet. Add one above 👆
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <tr key={p.id}>
                <td className="border px-4 py-2">{p.name}</td>
                <td className="border px-4 py-2">{p.provider}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
