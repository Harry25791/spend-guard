"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { getViewScope, labelForScope, type ViewScope, filterByScope } from "@/lib/io";
import { loadEntries, type EntryV2 } from "@/lib/storage";
import HeroAvatar from "@/components/ui/HeroAvatar";

/* ───────────────────────── Tunables (local to this page) ─────────────────────────
   Adjust these safely without affecting Home.
----------------------------------------------------------------------------- */
const HERO_MIN_VH = 70;              // hero min height as % of viewport height (minus header)
const FORM_OFFSET_Y = -360;             // px to nudge the Add Project card up/down
const STAGGER_TRIGGER_PCT = 0.20;    // how far you scroll past the hero before table reveals (0..1)

// Use a DIFFERENT image from Home if you like:
const AVATAR_SRC = "/brand/SpendGuardAvatar.png"; // e.g. "/brand/SpendGuardAvatarProjects.png"
/* ─────────────────────────────────────────────────────────────────────────── */

type Project = {
  id: string;
  name: string;
  provider?: string;
  rateUsdPer1k?: number;
};

export default function ProjectsPage() {
  /* Scope mirror (labels only; real scope lives in header) */
  const [scope, setScope] = useState<ViewScope>("month");
  useEffect(() => {
    try { setScope(getViewScope()); } catch {}
    const onFocus = () => { try { setScope(getViewScope()); } catch {} };
    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  /* Hydration guard to avoid SSR/CSR mismatch */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  /* Projects */
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return []; // server: empty, but we render a skeleton
    const raw = localStorage.getItem("projects");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((p: any) => ({ ...p, id: String(p.id) })) : [];
  });

  // cross-tab sync (only runs client-side post-mount)
  useEffect(() => {
    if (!hydrated) return;
    const resync = () => {
      const raw = localStorage.getItem("projects");
      const arr = raw ? JSON.parse(raw) : [];
      const norm = Array.isArray(arr) ? arr.map((p: any) => ({ ...p, id: String(p.id) })) : [];
      setProjects((prev) => (JSON.stringify(prev) === JSON.stringify(norm) ? prev : norm));
    };
    window.addEventListener("focus", resync);
    window.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("visibilitychange", resync);
    };
  }, [hydrated]);

  /* Add / Delete */
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const next = [...projects, { id: crypto.randomUUID(), name: n }];
    setProjects(next);
    localStorage.setItem("projects", JSON.stringify(next));
    setName("");
    nameRef.current?.focus();
  };

  const deleteProject = (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    localStorage.setItem("projects", JSON.stringify(next));
    localStorage.removeItem(`entries-${id}`);
    setOpenSummaries((ids) => ids.filter((x) => x !== id));
  };

  /* Lifetime totals for table (kept light) */
  const totalsByProject = useMemo(() => {
    const map: Record<string, { total: number; lastDate: string | null }> = {};
    for (const p of projects) {
      const raw = hydrated ? localStorage.getItem(`entries-${p.id}`) : null;
      if (!raw) { map[p.id] = { total: 0, lastDate: null }; continue; }
      try {
        const arr: Array<{ date: string; cost: number }> = JSON.parse(raw);
        const total = arr.reduce((s, e) => s + (Number(e.cost) || 0), 0);
        const lastDate = arr.length ? arr.map(e => e.date).reduce((a,b)=>a>b?a:b) : null;
        map[p.id] = { total, lastDate };
      } catch {
        map[p.id] = { total: 0, lastDate: null };
      }
    }
    return map;
  }, [projects, hydrated]);

  /* Stagger reveal trigger (after scrolling past hero) */
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    const el = sentinelRef.current;
    if (!el) return;
    const o = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setReveal(true);
      },
      { rootMargin: `0px 0px -${Math.round(STAGGER_TRIGGER_PCT * 100)}% 0px`, threshold: 0.01 }
    );
    o.observe(el);
    return () => o.disconnect();
  }, [hydrated]);

  /* Multiple open summaries */
  const [openSummaries, setOpenSummaries] = useState<string[]>([]);
  const toggleSummary = (id: string) =>
    setOpenSummaries((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  /* Skeleton row to keep SSR/CSR markup stable */
  const SkeletonRow = () => (
    <tr className="border-t border-white/10">
      <td className="px-5 py-3">
        <div className="h-4 w-40 bg-white/10 rounded" />
      </td>
      <td className="px-5 py-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
      </td>
      <td className="px-5 py-3 text-right">
        <div className="h-4 w-16 bg-white/10 rounded ml-auto" />
      </td>
      <td className="px-5 py-3 text-center">
        <div className="h-7 w-24 bg-white/10 rounded inline-block" />
      </td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-6xl px-6">
      {/* ─────────────── HERO (avatar left, form right) ─────────────── */}
      <section
        className="relative"
        style={{
          minHeight: `calc(${HERO_MIN_VH}dvh - var(--hdr-h, 64px))`,
          marginBottom: "28px",
          paddingTop: "0.5rem",
        }}
      >
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12">
          {/* AVATAR (left) — shared HeroAvatar + CSS-var Y offset (Option B) */}
          <div className="relative md:col-span-6 md:pr-6 lg:pr-10 md:justify-self-start">
            <HeroAvatar
              src="/brand/SpendGuardAvatar.png"
              widthPx={860}
              aspectRatio="4/5"
              translateY={{ base: -10, md: -30 }}   // raise/lower here
              maskStartPct={55}
              maskEndPct={88}
              sizes="(min-width: 1024px) 60vw, 92vw"
              objectFit="contain"
              priority
            />
          </div>

          {/* ADD PROJECT (right) */}
          <div className="md:col-span-6 md:pl-6 lg:pl-10" style={{ marginTop: FORM_OFFSET_Y }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Add a project</h1>
                <span className="text-xs md:text-sm text-slate-400">
                  Scope: {labelForScope(scope)} (set in header)
                </span>
              </div>
              <form onSubmit={addProject} className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                />
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15 active:bg-white/20 transition"
                >
                  Add Project
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* sentinel for stagger trigger */}
        <div ref={sentinelRef} className="h-4" />
      </section>

      {/* ─────────────── TABLE + COLLAPSIBLE ROW SUMMARIES ─────────────── */}
      <div className={`transition-opacity duration-500 ${reveal ? "opacity-100" : "opacity-0 translate-y-2"}`}>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-xl backdrop-blur">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-slate-300 text-sm">
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Last Entry</th>
                <th className="px-5 py-3 text-right">Lifetime Total ($)</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* SSR-safe: render skeleton until hydrated */}
              {!hydrated ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No projects yet. Add one above.
                  </td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <Fragment key={p.id}>
                    <tr
                      key={`${p.id}-row`}
                      className={`border-t border-white/10 ${i % 2 === 0 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.06] transition`}
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${p.id}?name=${encodeURIComponent(p.name)}${p.provider ? `&provider=${encodeURIComponent(p.provider)}` : ""}`}
                          className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{totalsByProject[p.id]?.lastDate ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-medium">
                        ${(totalsByProject[p.id]?.total ?? 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleSummary(p.id)}
                          className="rounded-md px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 transition"
                        >
                          {openSummaries.includes(p.id) ? "Hide summary" : "Summary"}
                        </button>
                        <button
                          onClick={() => deleteProject(p.id)}
                          className="ml-2 rounded-md px-3 py-1.5 bg-white/10 border border-white/10 hover:bg-white/15 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible summary row directly under the project row */}
                    {openSummaries.includes(p.id) && (
                      <tr key={`${p.id}-summary`} className="border-t border-white/10">
                        <td colSpan={4} className="px-5 py-4">
                          <InlineProjectSummary projectId={p.id} scope={scope} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

/* Compact KPI block for inline summary */
function InlineProjectSummary({ projectId, scope }: { projectId: string; scope: ViewScope }) {
  const [entries, setEntries] = useState<EntryV2[]>(() => loadEntries(projectId));
  useEffect(() => { setEntries(loadEntries(projectId)); }, [projectId]);

  const viewEntries = useMemo(
    () => entries.filter((e) => filterByScope(e.date as string, scope)),
    [entries, scope]
  );

  const entriesCount = viewEntries.length;
  const totalCost = useMemo(() => viewEntries.reduce((s, e) => s + (Number(e.cost) || 0), 0), [viewEntries]);
  const totalTokens = useMemo(() => viewEntries.reduce((s, e) => s + (Number(e.tokens) || 0), 0), [viewEntries]);
  const avgCost = entriesCount ? Number((totalCost / entriesCount).toFixed(2)) : 0;
  const avgTokens = entriesCount ? Math.round(totalTokens / entriesCount) : 0;
  const lastEntryDate = viewEntries.length
    ? viewEntries.map((e) => e.date).reduce((a, b) => (a > b ? a : b))
    : "—";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Scope Total" value={`$${totalCost.toFixed(2)}`} sub={`${totalTokens.toLocaleString()} tok`} />
        <KPI label="Entries" value={String(entriesCount)} />
        <KPI label="Avg / Entry" value={`$${avgCost.toFixed(2)}`} sub={`${avgTokens} tok`} />
        <KPI label="Last Entry" value={lastEntryDate} />
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-white mt-1">{value}</div>
      {sub ? <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div> : null}
    </div>
  );
}
