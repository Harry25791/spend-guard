"use client";

import { useEffect, useMemo, useState } from "react";

type Settings = {
  alertsEnabled?: boolean;
  monthlyLimitUsd?: number;
  // optional record of per-project limits
  perProjectLimits?: Record<string, number>;
  viewScope?: string; // preserved if present
};

type Project = { id: string; name: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [projects, setProjects] = useState<Project[]>([]);

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("settings");
      setSettings(raw ? JSON.parse(raw) : {});
    } catch { setSettings({}); }

    try {
      const raw = localStorage.getItem("projects");
      const arr = raw ? JSON.parse(raw) : [];
      setProjects(Array.isArray(arr) ? arr.map((p: any) => ({ id: String(p.id), name: p.name })) : []);
    } catch { setProjects([]); }
  }, []);

  // save
  useEffect(() => {
    if (!settings) return;
    try {
      const prev = localStorage.getItem("settings");
      const base = prev ? JSON.parse(prev) : {};
      const merged = { ...base, ...settings };
      localStorage.setItem("settings", JSON.stringify(merged));
    } catch {}
  }, [settings]);

  const monthTotal = useMemo(() => {
    // simple month total to display current usage
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const prefix = `${yyyy}-${mm}`;
    let sum = 0;
    const rawP = localStorage.getItem("projects");
    const arr = rawP ? JSON.parse(rawP) : [];
    const list: Project[] = Array.isArray(arr) ? arr.map((p: any) => ({ id: String(p.id), name: p.name })) : [];
    for (const p of list) {
      const eraw = localStorage.getItem(`entries-${p.id}`);
      if (!eraw) continue;
      try {
        const entries: Array<{ date: string; cost: number }> = JSON.parse(eraw);
        for (const e of entries) if ((e.date || "").startsWith(prefix)) sum += Number(e.cost) || 0;
      } catch {}
    }
    return sum;
  }, [projects]);

  const updatePerProject = (pid: string, v: number) => {
    setSettings((s) => ({
      ...s,
      perProjectLimits: { ...(s.perProjectLimits || {}), [pid]: v },
    }));
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="sg-card p-5">
          <h2 className="text-base font-semibold mb-3">Notifications</h2>

          <label className="flex items-center gap-2 text-slate-300 mb-3">
            <input
              type="checkbox"
              checked={!!settings.alertsEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, alertsEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-white/10 bg-white/10"
            />
            Enable monthly spend alerts
          </label>

          <label className="block text-sm mb-1 text-slate-300">Global monthly limit (USD)</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-300">$</span>
            <input
              type="number"
              min={0}
              step="1"
              value={settings.monthlyLimitUsd ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, monthlyLimitUsd: Number(e.target.value) || 0 }))}
              placeholder="0"
              className="w-40 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            This month so far: <span className="text-slate-200">${monthTotal.toFixed(2)}</span>
          </p>
        </div>

        <div className="sg-card p-5">
          <h2 className="text-base font-semibold mb-3">Per‑project limits</h2>
          {projects.length === 0 ? (
            <p className="text-slate-400">No projects yet.</p>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => {
                const val = settings.perProjectLimits?.[p.id] ?? "";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-200">{p.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={val}
                        onChange={(e) => updatePerProject(p.id, Number(e.target.value) || 0)}
                        className="w-32 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Per‑project limits override the global limit for that project.
          </p>
        </div>
      </div>
    </main>
  );
}
