"use client";
import React, { useEffect, useState } from "react";
import LeftRail from "./LeftRail";
import Aurora from "@/components/ui/Aurora";
import RangePicker from "@/components/ui/RangePicker";
import { getViewScope, setViewScope, type ViewScope } from "@/lib/io";
import Background from "../layout/Background";

export default function AppShell({ children }: React.PropsWithChildren) {
  // header scope
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => { try { setScopeState(getViewScope()); } catch {} }, []);
  const setScope = (s: ViewScope) => {
    setScopeState(s); setViewScope(s);
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: s } }));
  };

  // header scrolled effect
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // over-limit indicator (reads from settings; safe default)
  const [over, setOver] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("settings");
      if (!raw) return;
      const s = JSON.parse(raw);
      setOver(Boolean(s?.overLimit));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen">
      {/* Decorative background sits behind everything and ignores pointer events */}
      <Background />

      <div className="flex">
        {/* Left rail keeps its own stacking; interactive by default */}
        <LeftRail />

        {/* Right column = its own stacking context; ALWAYS interactive */}
        <div className="relative z-10 min-h-screen pointer-events-auto">
          {/* Header stays inside the right column */}
          <header
            className={[
              // ⚠️ KEY FIX: ensure header is explicitly interactive and above any layers
              "sticky top-0 z-30 pointer-events-auto border-b backdrop-blur transition-colors duration-300 supports-[backdrop-filter]:bg-white/0",
              scrolled ? "bg-white/[0.06] border-white/15" : "bg-white/[0.00] border-white/10",
            ].join(" ")}
          >
            <div className="sg-container flex items-center justify-between py-4">
              <div className="flex items-center gap-2">
                {/* SINGLE source of truth for header icon — using the PNG now */}
                <img
                  src="/brand/guardian.png"
                  alt="SpendGuard"
                  className="hidden h-6 w-6 rounded-sm object-contain md:block"
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
                    <path d="M12 2a6 6 0 00-6 6v2.268c0 .52...118 10.268V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  {over && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-ink-900" />}
                </button>
              </div>
            </div>
          </header>

          {/* Content: explicitly above any pseudo-layers; always interactive */}
          <main className="sg-container relative z-20 py-6 pointer-events-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
