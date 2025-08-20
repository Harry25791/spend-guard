// src/lib/io.ts
import { loadProjects, saveProjects, loadEntries, saveEntries } from "@/lib/storage";
import type { Project, EntryV2, EntryV1 } from "@/lib/storage";
import { normalizeProvider } from "@/lib/rates";

export const SCHEMA_VERSION = 2;

type ExportBundleV2 = {
  app: "SpendGuard";
  schemaVersion: 2;
  exportedAt: string;
  projects: Project[];
  entries: Record<string, EntryV2[]>;
};

type ExportBundleV1 = {
  // legacy (no schemaVersion or =1). Same shape but entries are V1 rows.
  app?: "SpendGuard";
  schemaVersion?: 1;
  projects: Project[];
  entries: Record<string, EntryV1[]>;
};

type ImportStrategy = "merge" | "replace";

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

// Build an in-memory snapshot of all data in localStorage
export function exportAll(): ExportBundleV2 {
  const projects = loadProjects();
  const entries: Record<string, EntryV2[]> = {};
  for (const p of projects) {
    entries[p.id] = loadEntries(p.id, p.provider);
  }
  return {
    app: "SpendGuard",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    entries,
  };
}

// Download as file
export function downloadExport(filename?: string) {
  const data = exportAll();
  const json = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const name = filename || `spendguard-export-v${SCHEMA_VERSION}-${stamp}.json`;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function migrateV1toV2(bundle: ExportBundleV1): ExportBundleV2 {
  const projects = bundle.projects ?? [];
  const entries: Record<string, EntryV2[]> = {};
  for (const p of projects) {
    const v1rows = (bundle.entries?.[p.id] ?? []) as EntryV1[];
    const provider = p.provider;
    const providerNorm = provider ? normalizeProvider(provider) : null;
    entries[p.id] = v1rows.map((e) => ({
      ...e,
      // fill provider from project; model stays undefined
      provider: providerNorm ? provider : p.provider,
      model: undefined,
      rateUsdPer1k: p.rateUsdPer1k, // snapshot if present; can be refined later
    }));
  }
  return {
    app: "SpendGuard",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    projects,
    entries,
  };
}

// Import with basic validation + merge/replace
export function importAll(
  jsonText: string,
  strategy: ImportStrategy = "merge"
): { projects: number; entries: number; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  // Detect version
  const sv = parsed.schemaVersion as number | undefined;
  let bundle: ExportBundleV2;
  if (!sv || sv === 1) {
    // Treat as v1 legacy
    bundle = migrateV1toV2(parsed as ExportBundleV1);
    warnings.push("Imported legacy export (v1). Automatically upgraded to v2.");
  } else if (sv === 2) {
    bundle = parsed as ExportBundleV2;
  } else {
    throw new Error(`Unsupported schemaVersion: ${sv}`);
  }

  const incomingProjects = bundle.projects ?? [];
  const incomingEntries = bundle.entries ?? {};

  if (strategy === "replace") {
    // Replace all projects & entries
    saveProjects(incomingProjects);
    for (const p of incomingProjects) {
      saveEntries(p.id, incomingEntries[p.id] ?? []);
    }
    return {
      projects: incomingProjects.length,
      entries: Object.values(incomingEntries).reduce((n, arr) => n + (arr?.length || 0), 0),
      warnings,
    };
  }

  // MERGE
  // 1) Merge projects by id
  const existingProjects = loadProjects();
  const mergedProjectsMap = new Map<string, Project>();
  for (const p of existingProjects) mergedProjectsMap.set(p.id, p);
  for (const p of incomingProjects) mergedProjectsMap.set(p.id, p);
  const mergedProjects = Array.from(mergedProjectsMap.values());
  saveProjects(mergedProjects);

  // 2) Merge entries per project, dedupe by id
  let entryCount = 0;
  for (const p of mergedProjects) {
    const existing = loadEntries(p.id, p.provider);
    const incoming = incomingEntries[p.id] ?? [];
    const merged = dedupeById<EntryV2>([...incoming, ...existing]);
    saveEntries(p.id, merged);
    entryCount += merged.length;
  }

  return { projects: mergedProjects.length, entries: entryCount, warnings };
}


// ===== Phase 1.75.x additions: scope persistence, filtered exports =====
export type ViewScope = "month" | "lifetime";

function safeParse<T>(txt: string | null): T | null {
  if (!txt) return null;
  try { return JSON.parse(txt) as T; } catch { return null; }
}

/** Persisted scope in localStorage.settings.viewScope (default "month") */
export function getViewScope(): ViewScope {
  if (typeof window === "undefined") return "month";
  const settings = safeParse<{ alertsEnabled?: boolean; monthlyLimitUsd?: number; viewScope?: ViewScope }>(localStorage.getItem("settings"));
  return (settings?.viewScope === "lifetime" || settings?.viewScope === "month") ? settings!.viewScope : "month";
}

export function setViewScope(scope: ViewScope) {
  if (typeof window === "undefined") return;
  const settings = safeParse<{ alertsEnabled?: boolean; monthlyLimitUsd?: number; viewScope?: ViewScope }>(localStorage.getItem("settings")) || {};
  const next = { ...settings, viewScope: scope };
  localStorage.setItem("settings", JSON.stringify(next));
}

type CsvScope = ViewScope;

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return "\"" + s.replace(/"/g, '""') + "\"";
    return s;
  };
  return fields.map(esc).join(",");
}

function entriesToCsv(projects: any[], entriesByProject: Record<string, any[]>): string {
  const header = [
    "project_id","project_name","project_provider","project_rateUsdPer1k",
    "entry_id","date","provider","model","rateUsdPer1k","tokens","cost"
  ];
  const rows: string[] = [header.join(",")];
  for (const p of projects) {
    const rowsForP = entriesByProject[p.id] ?? [];
    for (const e of rowsForP) {
      rows.push(toCsvRow([
        p.id, p.name, p.provider, (p.rateUsdPer1k ?? ""),
        e.id, e.date, (e.provider ?? ""), (e.model ?? ""), (e.rateUsdPer1k ?? ""), e.tokens, e.cost
      ]));
    }
  }
  return rows.join("\n");
}

/** Build filtered view (month or lifetime) across all projects. */
export function getFilteredEntriesForAll(scope: CsvScope): { projects: any[]; entries: Record<string, any[]> } {
  const projects = loadProjects();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const monthPrefix = `${yyyy}-${mm}`; // "YYYY-MM"

  const out: Record<string, any[]> = {};
  for (const p of projects) {
    const raw = loadEntries(p.id, p.provider);
    const filtered = scope === "month"
      ? (raw ?? []).filter((e: any) => (e.date || "").startsWith(monthPrefix))
      : (raw ?? []);
    out[p.id] = filtered;
  }
  return { projects, entries: out };
}

export function downloadFilteredCSV(scope: CsvScope, filename?: string) {
  const { projects, entries } = getFilteredEntriesForAll(scope);
  const csv = entriesToCsv(projects, entries);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const name = filename || `spendguard-${scope}-export-${stamp}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Project-scoped CSV export with provided entries array (already filtered by UI). */
export function downloadProjectCSV(projectId: string, projectName: string, projectProvider: string, projectRateUsdPer1k: number | undefined, entries: any[], filename?: string) {
  const csv = entriesToCsv(
    [ { id: projectId, name: projectName, provider: projectProvider, rateUsdPer1k: projectRateUsdPer1k } ] as any[],
    { [projectId]: entries } as Record<string, any[]>
  );
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeName = (projectName || "project").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 40);
  const name = filename || `spendguard-${safeName}-${stamp}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadFilteredJSON(scope: CsvScope, filename?: string) {
  const data = getFilteredEntriesForAll(scope);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const name = filename || `spendguard-${scope}-export-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadProjectJSON(projectId: string, projectName: string, projectProvider: string, projectRateUsdPer1k: number | undefined, entries: any[], filename?: string) {
  const payload = {
    project: { id: projectId, name: projectName, provider: projectProvider, rateUsdPer1k: projectRateUsdPer1k },
    entries
  };
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeName = (projectName || "project").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 40);
  const name = filename || `spendguard-${safeName}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

