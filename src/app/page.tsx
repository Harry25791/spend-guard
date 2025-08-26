// src/app/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// UI
import SGCard from "@/components/ui/SGCard";
import KPIRow from "@/components/dashboard/KPIRow";
import HeroAvatar from "@/components/ui/HeroAvatar";

// Charts (Free tier)
import Timeline from "@/components/charts/Timeline";
import TopModelsBar from "@/components/charts/TopModelsBar";
import ProviderStackArea from "@/components/charts/ProviderStackArea";
import PieByModel from "@/components/charts/PieByModel";
import EntryHistogram from "@/components/charts/EntryHistogram";

// Types
import type { Project as ProjectType } from "@/lib/storage";

// Import/export + scope + filtered helpers
import {
  downloadExport,
  importAll,
  downloadFilteredCSV,
  downloadFilteredJSON,
  getFilteredEntriesForAll,
  getViewScope,
  setViewScope,
  type ViewScope,
  labelForScope,
  filterByScope,
  rangeForScope,
} from "@/lib/io";

// ===== TUNING KNOBS (Dashboard hero) =====
const HERO_DVH = 86;   // % of viewport height the hero should occupy (was ~100)
const HERO_GAP  = -160;   // px of space between the hero and the KPIs/charts

// Optional: how early the charts reveal as you scroll off the hero
const REVEAL_ROOT_MARGIN = "-15%";

type Project = ProjectType;

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div suppressHydrationWarning>{mounted ? children : null}</div>;
}

function HeroIntro() {
  return (
    <section
      aria-label="SpendGuard hero"
      className="relative mx-auto max-w-6xl px-6"
      style={{
        minHeight: `calc(${HERO_DVH}dvh - var(--hdr-h, 64px))`,
        marginBottom: `${HERO_GAP}px`,
        paddingTop: "0.5rem",
      }}
    >
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12">
        {/* TEXT (left) — nudge UP with negative translate */}
        <div className="md:col-span-6 md:pr-6 lg:pr-10 relative -translate-y-12 md:-translate-y-60">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs/5 text-white/70">
            <span className="inline-block h-4 w-4 rounded bg-white/10" />
            <span className="font-medium">SpendGuard</span>
            <span className="opacity-60">v0.2</span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            SpendGuard
          </h1>
          <p className="mt-3 max-w-xl text-white/70">
            Track token usage and spend at a glance.
          </p>
          <div className="mt-10 text-sm text-white/60">Scroll to reveal insights ↓</div>
        </div>

        {/* AVATAR (right) — shared component with unified translateY */}
        <div className="relative md:col-span-6 md:pl-6 lg:pl-10 md:justify-self-center lg:justify-self-end">
          <HeroAvatar
            src="/brand/SpendGuardAvatar.png"
            widthPx={860}
            aspectRatio="4/5"
            translateY={{ base: -10, md: -30 }}
            maskStartPct={55}
            maskEndPct={88}
            sizes="(min-width: 1024px) 60vw, 92vw"
            objectFit="contain"
            priority
          />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  // ────────────────────────────────────────────────────────────────────────────
  // Scope (synced with header)
  const [scope, setScopeState] = useState<ViewScope>("month");
  useEffect(() => {
    try { setScopeState(getViewScope()); } catch {}
  }, []);
  useEffect(() => {
    const onScope = (e: any) => {
      const v = e?.detail?.scope as ViewScope | undefined;
      if (v) setScopeState(v);
    };
    window.addEventListener("sg:scope-change", onScope as EventListener);
    return () => window.removeEventListener("sg:scope-change", onScope as EventListener);
  }, []);
  const setScope = useCallback((s: ViewScope) => {
    setScopeState(s);
    setViewScope(s);
    window.dispatchEvent(new CustomEvent("sg:scope-change", { detail: { scope: s } }));
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("projects");
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.map((p: any) => ({ ...p, id: String(p.id) })) : [];
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Cross-tab resync
  useEffect(() => {
    const resync = () => {
      const stored = localStorage.getItem("projects");
      const parsed = stored ? JSON.parse(stored) : [];
      const normalized = Array.isArray(parsed) ? parsed.map((p: any) => ({ ...p, id: String(p.id) })) : [];
      if (JSON.stringify(normalized) !== JSON.stringify(projects)) setProjects(normalized);
    };
    window.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [projects]);

  // Alerts settings
  type AlertSettings = { alertsEnabled: boolean; monthlyLimitUsd: number; overLimit?: boolean };
  const [settings, setSettings] = useState<AlertSettings>(() => {
    if (typeof window === "undefined") return { alertsEnabled: true, monthlyLimitUsd: 0 };
    const raw = localStorage.getItem("settings");
    if (!raw) return { alertsEnabled: true, monthlyLimitUsd: 0 };
    try {
      const parsed = JSON.parse(raw);
      return {
        alertsEnabled: !!parsed.alertsEnabled,
        monthlyLimitUsd: Number(parsed.monthlyLimitUsd) || 0,
        overLimit: !!parsed.overLimit,
      };
    } catch {
      return { alertsEnabled: true, monthlyLimitUsd: 0 };
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = localStorage.getItem("settings");
    let merged: any = {};
    try { merged = prev ? JSON.parse(prev) : {}; } catch {}
    merged.alertsEnabled = settings.alertsEnabled;
    merged.monthlyLimitUsd = settings.monthlyLimitUsd;
    merged.overLimit = settings.overLimit;
    localStorage.setItem("settings", JSON.stringify(merged));
  }, [settings]);

  // Provider labels (lifetime)
  const [providerLabels, setProviderLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    localStorage.setItem("projects", JSON.stringify(projects));
    const providerMap: Record<string, string> = {};
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) { providerMap[p.id] = "—"; continue; }
      try {
        const entries: { provider?: string }[] = JSON.parse(raw);
        const set = new Set(
          entries
            .map((e) => (e.provider || "").trim())
            .filter((v) => v.length > 0)
            .map((v) => v.toLowerCase()),
        );
        providerMap[p.id] = set.size === 0 ? "—" : set.size === 1 ? Array.from(set)[0] : "Multiple Providers";
      } catch { providerMap[p.id] = "—"; }
    }
    setProviderLabels(providerMap);
  }, [projects]);

  // Insights data
  const [insightsReady, setInsightsReady] = useState(false);
  useEffect(() => setInsightsReady(true), []);

  const filteredAll = useMemo(() => {
    if (!insightsReady) return { projects: [] as Project[], entries: {} as Record<string, any[]> };
    return getFilteredEntriesForAll(scope);
  }, [insightsReady, scope, projects]);

  const flatEntries = useMemo(() => {
    const out: Array<{ date: string; cost: number; tokens?: number; model?: string; provider?: string }> = [];
    for (const p of filteredAll.projects) {
      for (const e of (filteredAll.entries[p.id] ?? []) as any[]) {
        out.push({
          date: e.date,
          cost: Number(e.cost) || 0,
          tokens: Number(e.tokens) || 0,
          model: e.model,
          provider: e.provider,
        });
      }
    }
    return out;
  }, [filteredAll]);

  const { from, to } = useMemo(() => rangeForScope(scope, new Date()), [scope]);

  // KPIs
  const lifetimeTotals = useMemo(() => {
    let total = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ cost: number }> = JSON.parse(raw);
        for (const e of arr) total += Number(e.cost) || 0;
      } catch {}
    }
    return Number(total.toFixed(2));
  }, [projects]);

  const monthTotal = useMemo(() => {
    let sum = 0;
    for (const p of projects) {
      const raw = localStorage.getItem(`entries-${p.id}`);
      if (!raw) continue;
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        for (const e of arr) if (filterByScope(e.date, "month")) sum += Number(e.cost) || 0;
      } catch {}
    }
    return Number(sum.toFixed(2));
  }, [projects, hydrated]);

  const projectsCount = projects.length;
  const overLimitActive =
    hydrated && settings.alertsEnabled && settings.monthlyLimitUsd > 0 && monthTotal > settings.monthlyLimitUsd;

  useEffect(() => { setSettings((s) => ({ ...s, overLimit: overLimitActive })); }, [overLimitActive]);

  const limitText =
    settings.monthlyLimitUsd > 0
      ? overLimitActive
        ? `Over by $${(monthTotal - settings.monthlyLimitUsd).toFixed(2)}`
        : `Remaining $${(settings.monthlyLimitUsd - monthTotal).toFixed(2)}`
      : "No limit set";

  // ────────────────────────────────────────────────────────────────────────────
  // Reveal after hero scroll (SLOW, DELAYED STAGGER)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setReveal(true);
          io.disconnect();
        }
      },
      { root: null, threshold: 0, rootMargin: `0px 0px ${REVEAL_ROOT_MARGIN} 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const revealClass = (idx: number) =>
    `transition-all duration-[900ms] ease-out will-change-transform ${
      reveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
    } [transition-delay:${Math.min(1200 + idx * 140, 2400)}ms]`;

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  return (
    <>
      {/* HERO (first paint) */}
      <HeroIntro />

      {/* Sentinel right after hero to trigger reveal */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* DASHBOARD (reveals after scroll) */}
      <div className="space-y-6">
        {/* KPI Row */}
        <div className={revealClass(1)}>
          <ClientOnly>
            <KPIRow
              className=""
              items={[
                { label: "This Month Spend", value: `$${monthTotal.toFixed(2)}` },
                { label: "Lifetime Spend", value: `$${lifetimeTotals.toFixed(2)}` },
                { label: "Projects", value: String(projectsCount) },
                { label: "Limit Status", value: limitText, warn: overLimitActive },
              ]}
            />
          </ClientOnly>
        </div>

        {/* Charts */}
        <div className={revealClass(2)}>
          <ClientOnly>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SGCard>
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  Spend over time — {labelForScope(scope)}
                </h3>
                <Timeline entries={flatEntries} from={from} to={to} cumulative valueKey="cumCost" ariaLabel="Cumulative spend" />
              </SGCard>

              <SGCard>
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  Top models — {labelForScope(scope)}
                </h3>
                <TopModelsBar entries={flatEntries} topN={6} />
              </SGCard>

              <SGCard>
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  Spend by provider — {labelForScope(scope)}
                </h3>
                <ProviderStackArea entries={flatEntries} from={from} to={to} />
              </SGCard>

              <SGCard>
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  Model share — {labelForScope(scope)}
                </h3>
                <PieByModel entries={flatEntries} />
              </SGCard>

              <SGCard className="lg:col-span-2">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  Entry size distribution — {labelForScope(scope)}
                </h3>
                <EntryHistogram entries={flatEntries} metric="tokens" />
              </SGCard>
            </div>
          </ClientOnly>
        </div>

        {/* Controls: filtered exports, full backup, import, clear (glassy buttons) */}
        <div className={revealClass(4)}>
          <ClientOnly>
            <div className="flex flex-wrap items-center justify-between pt-2">
              <div className="text-sm text-slate-400">
                Scope: <span className="text-slate-200">{labelForScope(scope)}</span> (set in header)
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => downloadFilteredCSV(scope)} className="btn btn-outline btn-sm">
                  Export CSV — {labelForScope(scope)}
                </button>
                <button onClick={() => downloadFilteredJSON(scope)} className="btn btn-outline btn-sm">
                  Export JSON — {labelForScope(scope)}
                </button>
                <button
                  onClick={() => downloadExport()}
                  className="btn btn-sm"
                  title="Full backup (all data, versioned JSON)"
                >
                  Full Backup (JSON v2)
                </button>

                <label className="btn btn-sm cursor-pointer">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const res = importAll(text, "merge");
                        alert(
                          `Import complete.\nProjects: ${res.projects}\nEntries: ${res.entries}${
                            res.warnings.length ? `\nWarnings:\n- ${res.warnings.join("\n- ")}` : ""
                          }`,
                        );
                        location.reload();
                      } catch (err: any) {
                        alert(`Import failed: ${err?.message || String(err)}`);
                      } finally {
                        ev.target.value = "";
                      }
                    }}
                    className="hidden"
                  />
                </label>

                {projects.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear all projects?")) {
                        setProjects([]);
                        Object.keys(localStorage).forEach((key) => {
                          if (key.startsWith("entries-")) localStorage.removeItem(key);
                        });
                        localStorage.removeItem("projects");
                      }
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Clear All Projects
                  </button>
                )}
              </div>
            </div>
          </ClientOnly>
        </div>
      </div>
    </>
  );
}
