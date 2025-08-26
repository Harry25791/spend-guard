"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type AlertsModalProps = {
  open: boolean;
  onClose: () => void;
};

type Entry = { date?: string; cost?: number };
type Project = { id: string | number };

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function readMonthlySpend(): number {
  if (typeof window === "undefined") return 0;
  try {
    const projs: Project[] = JSON.parse(localStorage.getItem("projects") || "[]");
    const ym = monthKey();
    let total = 0;
    for (const p of projs) {
      const pid = String((p as any).id ?? p);
      const rows: Entry[] = JSON.parse(localStorage.getItem(`entries-${pid}`) || "[]");
      for (const r of rows) {
        const ds = (r.date || "").trim();
        if (ds.startsWith(ym)) total += Number(r.cost || 0);
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function readMonthlyLimit(): number {
  if (typeof window === "undefined") return 0;
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    return Number(s?.monthlyLimitUsd || 0);
  } catch {
    return 0;
  }
}

/**
 * AlertsModal (controlled)
 * - Shows this month's spend
 * - Shows remaining or over-limit
 * - Links to /settings
 */
export default function AlertsModal({ open, onClose }: AlertsModalProps) {
  const [limit, setLimit] = useState<number>(0);
  const spend = useMemo(() => (open ? readMonthlySpend() : 0), [open]);

  useEffect(() => {
    if (!open) return;
    setLimit(readMonthlyLimit());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const over = limit > 0 && spend > limit;
  const remaining = Math.max(0, limit - spend);
  const overBy = Math.max(0, spend - limit);

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Alerts</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="text-slate-300">
            This month:&nbsp;
            <span className="font-medium text-slate-50">${spend.toFixed(2)}</span>
          </div>

          {limit > 0 ? (
            over ? (
              <div className="text-rose-400">
                Over by&nbsp;<span className="font-semibold">${overBy.toFixed(2)}</span>
              </div>
            ) : (
              <div className="text-emerald-400">
                Remaining:&nbsp;<span className="font-semibold">${remaining.toFixed(2)}</span>
              </div>
            )
          ) : (
            <div className="text-slate-400">No monthly limit set.</div>
          )}

          <div className="pt-2">
            <Link href="/settings" className="btn btn-outline btn-sm">
              Open Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * GlobalAlertsModal (optional)
 * - Drop this anywhere (e.g., in AppShell) to listen for:
 *   window.dispatchEvent(new CustomEvent("sg:open-alerts"))
 */
export function GlobalAlertsModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const openFn = () => setOpen(true);
    window.addEventListener("sg:open-alerts", openFn as EventListener);
    return () => window.removeEventListener("sg:open-alerts", openFn as EventListener);
  }, []);
  return <AlertsModal open={open} onClose={() => setOpen(false)} />;
}
