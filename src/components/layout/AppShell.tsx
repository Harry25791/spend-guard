"use client";
import React, { useEffect, useState } from "react";
import LeftRail from "./LeftRail";
import Aurora from "@/components/ui/Aurora";
import RangePicker from "@/components/ui/RangePicker";
import { getViewScope, setViewScope, type ViewScope } from "@/lib/io";
import Background from "../layout/Background";

export default function AppShell({ children }: React.PropsWithChildren) {
  // Global scope in header (pages already read getViewScope on mount)
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => {
    try {
      setScopeState(getViewScope());
    } catch {}
  }, []);
  const setScope = (s: ViewScope) => {
    setScopeState(s);
    setViewScope(s);
    // broadcast so pages can react immediately if they want
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: s } }));
  };

  // Simple alerts badge check (month total)
  const [over, setOver] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("settings") || "{}");
      const limit = Number(s.monthlyLimitUsd) || 0;
      if (!limit) return setOver(false);
      const projs = JSON.parse(localStorage.getItem("projects") || "[]") as Array<{ id: string }>;
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      let total = 0;
      for (const p of projs) {
        const rows = JSON.parse(localStorage.getItem(`entries-${p.id}`) || "[]") as Array<{ date: string; cost: number }>;
        for (const r of rows) if ((r.date || "").startsWith(`${y}-${m}`)) total += Number(r.cost) || 0;
      }
      setOver(total > limit);
    } catch {
      setOver(false);
    }
  }, []);

  // Header subtle fade on scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-ink-900 text-slate-100">
      {/* Single fixed background = no seams */}
      <Background />
      <Aurora className="pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative z-10 grid grid-cols-[240px,1fr] md:grid-cols-[260px,1fr]">
        {/* Left rail */}
        <aside className="sticky top-0 z-30 hidden min-h-screen border-r border-white/10 sm:block">
          <LeftRail />
        </aside>

        <div className="min-h-screen">
          {/* STICKY header (centered) */}
          <header
            className={[
              "sticky top-0 z-20 border-b backdrop-blur transition-colors duration-300 supports-[backdrop-filter]:bg-white/0",
              scrolled ? "bg-white/[0.06] border-white/15" : "bg-white/[0.00] border-white/10",
            ].join(" ")}
          >
            <div className="sg-container flex items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <img
                  src="/brand/guardian-badge.svg"
                  alt=""
                  className="hidden h-6 w-6 opacity-90 md:block"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                />
                <span className="text-base font-semibold tracking-tight">SpendGuard</span>
                <span className="ml-2 text-xs text-slate-400">v0.2</span>
              </div>

              <div className="flex items-center gap-3">
                <RangePicker value={scope} onChange={setScope} />
                <button
                  type="button"
                  aria-label="Alerts"
                  className="btn btn-ghost btn-sm relative"
                  onClick={() => window.dispatchEvent(new CustomEvent("sg:open-alerts"))}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 2a6 6 0 00-6 6v2.268c0 .52-.214 1.018-.593 1.376L4 14h16l-1.407-2.356A1.94 1.94 0 0118 10.268V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  {over && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-ink-900" />}
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="sg-container py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
