// src/components/layout/AppShell.tsx
"use client";
import React from "react";
import LeftRail from "./LeftRail";
import Aurora from "@/components/ui/Aurora";

export default function AppShell({ children }: React.PropsWithChildren) {
  return (
    <div className="min-h-screen w-full bg-ink-900 text-slate-100 relative">
      <Aurora className="pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 grid grid-cols-[240px,1fr] md:grid-cols-[260px,1fr]">
        {/* Left rail */}
        <aside className="hidden sm:block border-r border-white/10 min-h-screen sticky top-0">
          <LeftRail />
        </aside>

        {/* Content column */}
        <div className="min-h-screen">
          <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/0 border-b border-white/10">
            <div className="sg-container py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/brand/guardian-badge.svg"
                  alt=""
                  className="h-6 w-6 opacity-90 hidden md:block"
                  onError={(e) => ((e.currentTarget.style.display = 'none'))}
                />
                <span className="text-base font-semibold tracking-tight">SpendGuard</span>
              </div>
              <span className="text-xs text-slate-400">v0.2</span>
            </div>
          </header>

          <main className="sg-container py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
