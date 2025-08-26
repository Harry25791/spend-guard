"use client";
import React, { useEffect, useRef, useState } from "react";
import LeftRail from "./LeftRail";
import Aurora from "@/components/ui/Aurora";
import RangePicker from "@/components/ui/RangePicker";
import { getViewScope, setViewScope, type ViewScope } from "@/lib/io";
import Background from "../layout/Background";
import { GlobalAlertsModal } from "@/components/modals/AlertsModal";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: React.PropsWithChildren) {
  // ── scope in header
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => { try { setScopeState(getViewScope()); } catch {} }, []);
  const setScope = (s: ViewScope) => {
    setScopeState(s);
    setViewScope(s);
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: s } }));
  };

  // ── dynamic rail/header measurements (CSS vars)
  const railRef = useRef<HTMLDivElement>(null);
  const hdrRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = railRef.current; if (!el) return;
    const set = (w: number) => document.documentElement.style.setProperty("--rail-w", `${Math.round(w)}px`);
    set(el.offsetWidth);
    const ro = new (window as any).ResizeObserver((entries: any[]) => {
      const w = entries?.[0]?.contentRect?.width ?? el.offsetWidth;
      set(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = hdrRef.current; if (!el) return;
    const set = () => document.documentElement.style.setProperty("--hdr-h", `${el.offsetHeight}px`);
    set();
    const ro = new (window as any).ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => { ro.disconnect(); window.removeEventListener("resize", set); };
  }, []);

  // ── over-limit dot + header tint on scroll
  const [over, setOver] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("settings");
      if (!raw) return;
      setOver(Boolean(JSON.parse(raw)?.overLimit));
    } catch {}
  }, []);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── route-aware title + badge
  const pathname = usePathname() || "/";
  const first = `/${(pathname.split("/")[1] ?? "").toLowerCase()}`; // "/", "/projects", "/reports", "/settings"

  const { title, icon } = (() => {
    switch (first) {
      case "/projects":
        return { title: "Projects", icon: "/rail/ProjectsIcon.png" };
      case "/reports":
        return { title: "Reports", icon: "/rail/ReportsIcon.png" };
      case "/settings":
        return { title: "Settings", icon: "/rail/SettingsIcon.png" }; // name per your request
      case "/":
      default:
        return { title: "SpendGuard", icon: "/rail/ShieldIcon.png" };
    }
  })();

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background layers out of flow */}
      <Background />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-40">
        <Aurora className="h-full w-full opacity-60" />
      </div>

      {/* Fixed left rail that follows scroll */}
      <aside ref={railRef} className="fixed left-0 top-0 z-40 h-[100dvh]">
        <LeftRail />
      </aside>

      {/* Fixed header that follows scroll, aligned to start after the rail */}
      <header
        ref={hdrRef}
        className={[
          "fixed top-0 z-30 border-b backdrop-blur transition-colors duration-300 supports-[backdrop-filter]:bg-white/0",
          scrolled ? "bg-white/[0.06] border-white/15" : "bg-white/[0.00] border-white/10",
        ].join(" ")}
        style={{
          left: "var(--rail-w, 0px)",
          width: "calc(100vw - var(--rail-w, 0px))",
        }}
      >
        <div className="sg-container flex items-center justify-between py-4">
          {/* Left: dynamic badge + title */}
          <div className="flex items-center gap-2">
            <img
              src={icon}
              alt={title}
              className="hidden rounded-sm object-contain md:block"
              style={{ width: "var(--brand-icon, 24px)", height: "var(--brand-icon, 24px)" }}
            />
            <span
              className="font-semibold tracking-tight"
              style={{ fontSize: "var(--hdr-title-size)" }}
            >
              {title}
            </span>
            <span className="ml-2 text-xs text-slate-400">v0.2</span>
          </div>

          {/* Right: scope + alerts */}
          <div className="flex items-center gap-3">
            <RangePicker value={scope} onChange={setScope} />
            <button
              type="button"
              aria-label="Alerts"
              className="btn btn-ghost btn-sm relative"
              onClick={() => window.dispatchEvent(new CustomEvent("sg:open-alerts"))}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M12 2a6 6 0 00-6 6v2.27c0 .52-.21.99-.55 1.33L3.88 13.16A1.94 1.94 0 005 16h14a1.94 1.94 0 001.12-3.54l-1.56-1.56c-.34-.34-.56-.81-.56-1.33V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {over && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-ink-900" />}
            </button>
          </div>
        </div>
      </header>

      {/* Content area sits to the right of the rail and is *that* width */}
      <main
        className="relative z-20 min-w-0 py-6"
        style={{
          width: "calc(100vw - var(--rail-w, 0px))",
          marginLeft: "var(--rail-w, 0px)",
          paddingTop: "calc(var(--hdr-h, 56px) + 12px)",
        }}
      >
        <div className="sg-container">{children}</div>
      </main>

      <GlobalAlertsModal />
    </div>
  );
}
