// src/components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import Aurora from "@/components/ui/Aurora";
import LeftRail from "@/components/layout/LeftRail";
import RangePicker from "@/components/ui/RangePicker";
import { getViewScope, setViewScope, type ViewScope } from "@/lib/io";

function Brand() {
  // Non-blocking badge: hide <img> if the asset isn't present.
  return (
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/brand/guardian-badge.svg"
        alt=""
        className="h-5 w-5"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="text-sm md:text-base font-semibold tracking-tight">SpendGuard</span>
    </Link>
  );
}

function AlertsBell() {
  const [hasDot, setHasDot] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("settings");
      const s = raw ? JSON.parse(raw) : {};
      // Show dot when an over-limit flag is persisted (customize as needed)
      setHasDot(Boolean(s?.alertsEnabled && s?.monthlyLimitUsd > 0 && s?.overLimit));
    } catch {
      setHasDot(false);
    }
  }, []);

  const openAlerts = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sg:open-alerts"));
  }, []);

  return (
    <button
      type="button"
      onClick={openAlerts}
      aria-label="Open alerts and monthly limit settings"
      className="relative inline-flex items-center justify-center rounded-lg border border-white/10 px-2 py-1.5 text-sm hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    >
      <span aria-hidden>🔔</span>
      {hasDot && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 shadow"
        />
      )}
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [scope, setScope] = useState<ViewScope>("month");

  useEffect(() => {
    setMounted(true);
    try {
      setScope(getViewScope());
    } catch {
      setScope("month");
    }
  }, []);

  const handleScopeChange = useCallback((v: ViewScope) => {
    setScope(v);
    setViewScope(v);
    // Let charts/tables refresh if they listen for this
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: v } }));
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0b1023] via-[#0e1330] to-[#111827] text-slate-100 relative">
      {/* Background aurora spans rail + content */}
      <Aurora />

      <div className="relative z-10 mx-auto flex">
        {/* Left navigation rail (collapsible) */}
        <LeftRail />

        {/* Right content column */}
        <div className="flex-1 min-h-[100dvh]">
          {/* Top header bar */}
          <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/0 border-b border-white/10">
            <div className="mx-auto max-w-5xl px-4 md:px-6 py-3 flex items-center justify-between gap-3">
              <Brand />

              {/* Header controls */}
              <div className="flex items-center gap-2 md:gap-3">
                {/* Global RangePicker (uses internal SCOPE_OPTIONS) */}
                {mounted && (
                  <div className="min-w-[150px]">
                    <RangePicker
                      value={scope}
                      onChange={handleScopeChange}
                      label="Scope"
                    />
                  </div>
                )}

                {/* Alerts button */}
                <AlertsBell />

                <span className="hidden sm:inline text-xs md:text-sm text-slate-400">v0.2</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto max-w-5xl px-4 md:px-6 py-6">
            <div className="relative" suppressHydrationWarning>
              {mounted ? children : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
