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
    if (r?.id && !seen.has(r.id)) {
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
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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
    const providerStr = p.provider ?? undefined; // carry project provider as-is if present
    // Keep note: we don't normalize here to preserve user-entered casing
    entries[p.id] = v1rows.map((e) => ({
      ...e,
      provider: providerStr,
      model: undefined,
      rateUsdPer1k: p.rateUsdPer1k, // snapshot if present
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
// --- Time range scopes -------------------------------------------------------
export type ViewScope =
  | "month"
  | "last7"
  | "last14"
  | "last30"
  | "last90"
  | "last365"
  | "lifetime";

export const SCOPE_OPTIONS: { value: ViewScope; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "last7", label: "Last 7 days" },
  { value: "last14", label: "Last 14 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "last365", label: "Last Year" },
  { value: "lifetime", label: "Lifetime" },
];

export function labelForScope(s: ViewScope): string {
  return SCOPE_OPTIONS.find((o) => o.value === s)?.label ?? "This Month";
}

export function getViewScope(): ViewScope {
  try {
    const raw = localStorage.getItem("settings");
    const s = raw ? JSON.parse(raw) : {};
    const v = s.viewScope as ViewScope | undefined;
    return v && SCOPE_OPTIONS.some((o) => o.value === v) ? v : "month";
  } catch {
    return "month";
  }
}

export function setViewScope(v: ViewScope) {
  const raw = localStorage.getItem("settings");
  let s: any = {};
  try {
    s = raw ? JSON.parse(raw) : {};
  } catch {}
  s.viewScope = v;
  localStorage.setItem("settings", JSON.stringify(s));
}

// Inclusive date filter for scopes (dates are ISO "YYYY-MM-DD")
export function filterByScope(dateISO: string, scope: ViewScope): boolean {
  if (!dateISO) return false;
  if (scope === "lifetime") return true;

  // UTC-safe date math
  const parts = dateISO.split("-").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diffDays = Math.floor((todayUTC - dayUTC) / 86_400_000);

  switch (scope) {
    case "month":
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    case "last7":
      return diffDays >= 0 && diffDays < 7;
    case "last14":
      return diffDays >= 0 && diffDays < 14;
    case "last30":
      return diffDays >= 0 && diffDays < 30;
    case "last90":
      return diffDays >= 0 && diffDays < 90;
    case "last365":
      return diffDays >= 0 && diffDays < 365;
    default:
      return true;
  }
}

type CsvScope = ViewScope;

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return fields.map(esc).join(",");
}

function entriesToCsv(projects: any[], entriesByProject: Record<string, any[]>): string {
  const header = [
    "project_id",
    "project_name",
    "project_provider",
    "project_rateUsdPer1k",
    "entry_id",
    "date",
    "provider",
    "model",
    "rateUsdPer1k",
    "tokens",
    "cost",
  ];
  const rows: string[] = [header.join(",")];
  for (const p of projects) {
    const rowsForP = entriesByProject[p.id] ?? [];
    for (const e of rowsForP) {
      rows.push(
        toCsvRow([
          p.id,
          p.name,
          p.provider,
          p.rateUsdPer1k ?? "",
          e.id,
          e.date,
          e.provider ?? "",
          e.model ?? "",
          e.rateUsdPer1k ?? "",
          e.tokens,
          e.cost,
        ])
      );
    }
  }
  return rows.join("\n");
}

// Update this helper to respect new scopes (used by Home)
export function getFilteredEntriesForAll(scope: ViewScope) {
  const raw = localStorage.getItem("projects");
  const rawList = raw ? (JSON.parse(raw) as Array<{ id: string | number }>) : [];
  const projects = rawList.map((p) => ({ ...p, id: String(p.id) }));
  const entries: Record<string, any[]> = {};
  for (const p of projects) {
    const eraw = localStorage.getItem(`entries-${p.id}`);
    if (!eraw) {
      entries[p.id] = [];
      continue;
    }
    try {
      const arr = (JSON.parse(eraw) as any[]) || [];
      entries[p.id] = arr.filter((e) => filterByScope(e?.date, scope));
    } catch {
      entries[p.id] = [];
    }
  }
  return { projects, entries };
}

// Optional per-project helper (handy in project page)
export function getFilteredEntriesForProject(projectId: string, scope: ViewScope) {
  const eraw = localStorage.getItem(`entries-${projectId}`);
  if (!eraw) return [];
  try {
    const arr = (JSON.parse(eraw) as any[]) || [];
    return arr.filter((e) => filterByScope(e?.date, scope));
  } catch {
    return [];
  }
}

export function downloadFilteredCSV(scope: CsvScope, filename?: string) {
  const { projects, entries } = getFilteredEntriesForAll(scope);
  const csv = entriesToCsv(projects as any[], entries);
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
export function downloadProjectCSV(
  projectId: string,
  projectName: string,
  projectProvider: string,
  projectRateUsdPer1k: number | undefined,
  entries: any[],
  filename?: string
) {
  const csv = entriesToCsv(
    [{ id: projectId, name: projectName, provider: projectProvider, rateUsdPer1k: projectRateUsdPer1k }] as any[],
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

export function downloadProjectJSON(
  projectId: string,
  projectName: string,
  projectProvider: string,
  projectRateUsdPer1k: number | undefined,
  entries: any[],
  filename?: string
) {
  const payload = {
    project: { id: projectId, name: projectName, provider: projectProvider, rateUsdPer1k: projectRateUsdPer1k },
    entries,
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
