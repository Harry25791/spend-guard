"use client";
import { useEffect, useState } from "react";

export default function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState<number>(0);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("settings") || "{}");
      setEnabled(!!s.alertsEnabled);
      setLimit(Number(s.monthlyLimitUsd) || 0);
    } catch {}
  }, []);
  useEffect(() => {
    const raw = localStorage.getItem("settings");
    let merged: any = {};
    try { merged = raw ? JSON.parse(raw) : {}; } catch {}
    merged.alertsEnabled = enabled;
    merged.monthlyLimitUsd = limit;
    localStorage.setItem("settings", JSON.stringify(merged));
  }, [enabled, limit]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="sg-card p-4">
        <h2 className="font-medium mb-3">Notifications</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
          Enable monthly limit alerts
        </label>
        <div className="mt-3 flex items-center gap-2">
          <span>$</span>
          <input
            type="number"
            min={0}
            value={limit || ""}
            onChange={(e)=>setLimit(Number(e.target.value)||0)}
            className="w-40 rounded-lg bg-white/10 border border-white/10 px-3 py-2"
          />
        </div>
      </div>
    </div>
  );
}
