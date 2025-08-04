"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: number;
  name: string;
  provider: string;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");

  // Load projects from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("projects");
    if (stored) {
      setProjects(JSON.parse(stored));
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));
  }, [projects]);

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    setProjects([...projects, { id: Date.now(), name, provider }]);
    setName("");
    setProvider("");
  };

  const deleteProject = (id: number) => {
    // Remove from projects list
    setProjects(projects.filter((p) => p.id !== id));

    // Remove its usage entries from localStorage
    localStorage.removeItem(`entries-${id}`);
  };

  const clearAllProjects = () => {
    if (window.confirm("Are you sure you want to clear all projects?")) {
      // Clear all projects
      setProjects([]);

      // Also clear all usage entries tied to projects
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("entries-")) {
          localStorage.removeItem(key);
        }
      });

      // Clear stored projects list
      localStorage.removeItem("projects");
    }
  };



  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      {/* Navbar */}
      <nav className="w-full flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-2xl font-bold">Spend Guard</h1>
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
            <th className="border px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={2} className="text-center py-4 text-gray-500">
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
                </td>
                <td className="border px-4 py-2">{p.provider}</td>
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
      {/* Clear All Projects */}
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
