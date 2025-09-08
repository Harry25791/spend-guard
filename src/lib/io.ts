// src/lib/io.ts
import { loadProjects, saveProjects, loadEntries, saveEntries } from "@/lib/storage";
import type { Project, EntryV2, EntryV1 } from "@/lib/storage";

export const SCHEMA_VERSION = 2;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

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

/** Minimal CSV-friendly shapes */
type CsvProject = Pick<Project, "id" | "name" | "provider" | "rateUsdPer1k">;
type CsvEntry = Pick<
  EntryV2,
  "id" | "date" | "provider" | "model" | "rateUsdPer1k" | "tokens" | "cost"
>;

/* -------------------------------------------------------------------------- */
/* Small runtime guards (for safe JSON parsing)                                */
/* -------------------------------------------------------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const asNumber = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

function isCsvEntry(v: unknown): v is CsvEntry {
  if (!isRecord(v)) return false;
  const id = asString(v.id);
  const date = asString(v.date);
  const tokens = asNumber(v.tokens);
  const cost = asNumber(v.cost);
  // provider/model/rateUsdPer1k are optional
  return !!(id && date && Number.isFinite(tokens ?? NaN) && Number.isFinite(cost ?? NaN));
}

function isExportBundleV1(x: unknown): x is ExportBundleV1 {
  if (!isRecord(x)) return false;
  const projectsOk = Array.isArray((x as { projects?: unknown }).projects);
  const entriesOk = isRecord((x as { entries?: unknown }).entries);
  const sv = (x as { schemaVersion?: unknown }).schemaVersion;
  const svOk = sv === undefined || sv === 1;
  return projectsOk && entriesOk && svOk;
}

function isExportBundleV2(x: unknown): x is ExportBundleV2 {
  if (!isRecord(x)) return false;
  const sv = (x as { schemaVersion?: unknown }).schemaVersion;
  const projectsOk = Array.isArray((x as { projects?: unknown }).projects);
  const entriesOk = isRecord((x as { entries?: unknown }).entries);
  return sv === 2 && projectsOk && entriesOk;
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Export / Import                                                            */
/* -------------------------------------------------------------------------- */

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
    const v1rows = bundle.entries?.[p.id] ?? [];
    const providerStr = p.provider ?? undefined; // carry project provider as-is if present
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  // Detect version safely
  const sv =
    isRecord(parsed) && typeof parsed.schemaVersion === "number"
      ? (parsed.schemaVersion as number)
      : undefined;

  let bundle: ExportBundleV2;
  if (!sv || sv === 1) {
    if (!isExportBundleV1(parsed)) throw new Error("Invalid legacy export structure.");
    bundle = migrateV1toV2(parsed);
    warnings.push("Imported legacy export (v1). Automatically upgraded to v2.");
  } else if (sv === 2) {
    if (!isExportBundleV2(parsed)) throw new Error("Invalid v2 export structure.");
    bundle = parsed;
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
      entries: Object.values(incomingEntries).reduce(
        (n, arr) => n + (arr?.length || 0),
        0
      ),
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

/* -------------------------------------------------------------------------- */
/* Phase 1.75.x additions: scope persistence, filtered exports                 */
/* -------------------------------------------------------------------------- */
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

function isViewScopeValue(x: unknown): x is ViewScope {
  return typeof x === "string" && SCOPE_OPTIONS.some((o) => o.value === x);
}

export function getViewScope(): ViewScope {
  try {
    const raw = localStorage.getItem("settings");
    const obj: unknown = raw ? JSON.parse(raw) : {};
    const maybe = isRecord(obj) ? (obj as Record<string, unknown>).viewScope : undefined;
    return isViewScopeValue(maybe) ? maybe : "month";
  } catch {
    return "month";
  }
}

export function setViewScope(v: ViewScope) {
  const raw = localStorage.getItem("settings");
  let s: Record<string, unknown> = {};
  try {
    const candidate: unknown = raw ? JSON.parse(raw) : {};
    if (isRecord(candidate)) s = candidate;
  } catch {
    // ignore
  }
  s.viewScope = v;
  localStorage.setItem("settings", JSON.stringify(s));
}

/* -------------------------------------------------------------------------- */
/* Time helpers (local-day, inclusive of today)                                */
/* -------------------------------------------------------------------------- */

/** Parse an ISO "YYYY-MM-DD" into a local-midnight Date (no TZ surprises). */
function parseLocalDateISO(dateISO: string): Date | null {
  if (!dateISO) return null;
  const parts = dateISO.split("-").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  // Local midnight for that calendar day:
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function endOfTodayLocal(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/**
 * Inclusive "last N days" window including today as day 1.
 * from = local midnight of (today - (N - 1)), to = local end-of-today.
 * Uses calendar constructors to avoid DST drift.
 */
function lastNDaysInclusiveLocal(n: number, now = new Date()): { from: Date; to: Date } {
  if (n < 1) throw new Error("n must be >= 1");
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const from = new Date(y, m, d - (n - 1), 0, 0, 0, 0);
  const to = new Date(y, m, d, 23, 59, 59, 999);
  return { from, to };
}

function firstOfThisMonthLocal(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function rangeForScope(
  scope: ViewScope,
  now = new Date()
): { from?: Date; to?: Date } {
  switch (scope) {
    case "month":
      return { from: firstOfThisMonthLocal(now), to: endOfTodayLocal(now) };
    case "last7":
      return lastNDaysInclusiveLocal(7, now);
    case "last14":
      return lastNDaysInclusiveLocal(14, now);
    case "last30":
      return lastNDaysInclusiveLocal(30, now);
    case "last90":
      return lastNDaysInclusiveLocal(90, now);
    case "last365":
      return lastNDaysInclusiveLocal(365, now);
    case "lifetime":
    default:
      return { from: undefined, to: undefined };
  }
}

/* -------------------------------------------------------------------------- */
/* Inclusive date filter for scopes (dates are ISO "YYYY-MM-DD")              */
/* -------------------------------------------------------------------------- */
export function filterByScope(dateISO: string, scope: ViewScope): boolean {
  if (!dateISO) return false;
  if (scope === "lifetime") return true;

  const d = parseLocalDateISO(dateISO);
  if (!d) return false;

  const { from, to } = rangeForScope(scope, new Date());
  if (from && d < from) return false;
  if (to && d > to) return false; // inclusive up to end-of-today
  return true;
}

/* -------------------------------------------------------------------------- */
/* CSV helpers                                                                */
/* -------------------------------------------------------------------------- */

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : String(v); // numbers only
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return fields.map(esc).join(",");
}

function entriesToCsv(
  projects: CsvProject[],
  entriesByProject: Record<string, CsvEntry[]>
): string {
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

/* -------------------------------------------------------------------------- */
/* Filtered views (localStorage → typed)                                      */
/* -------------------------------------------------------------------------- */

export function getFilteredEntriesForAll(
  scope: ViewScope
): { projects: CsvProject[]; entries: Record<string, CsvEntry[]> } {
  // Projects
  const raw = localStorage.getItem("projects");
  const parsedProjects: unknown = raw ? JSON.parse(raw) : [];
  const arr = Array.isArray(parsedProjects) ? parsedProjects : [];

  const projects: CsvProject[] = arr.map((p): CsvProject => {
    const r = isRecord(p) ? p : {};
    const idVal = r["id"];
    const id = asString(idVal) ?? (typeof idVal === "number" ? String(idVal) : "");
    return {
      id,
      name: asString(r["name"]) ?? "",
      provider: asString(r["provider"]) ?? "",
      rateUsdPer1k: asNumber(r["rateUsdPer1k"]),
    };
  });

  // Entries keyed by project id
  const entries: Record<string, CsvEntry[]> = {};
  for (const p of projects) {
    const eraw = localStorage.getItem(`entries-${p.id}`);
    if (!eraw) {
      entries[p.id] = [];
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(eraw);
      const arrEntries = Array.isArray(parsed) ? parsed.filter(isCsvEntry) : [];
      entries[p.id] = arrEntries.filter((e) => filterByScope(e.date, scope));
    } catch {
      entries[p.id] = [];
    }
  }
  return { projects, entries };
}

// Optional per-project helper (handy in project page)
export function getFilteredEntriesForProject(
  projectId: string,
  scope: ViewScope
): CsvEntry[] {
  const eraw = localStorage.getItem(`entries-${projectId}`);
  if (!eraw) return [];
  try {
    const parsed: unknown = JSON.parse(eraw);
    const arrEntries = Array.isArray(parsed) ? parsed.filter(isCsvEntry) : [];
    return arrEntries.filter((e) => filterByScope(e.date, scope));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Downloads                                                                  */
/* -------------------------------------------------------------------------- */

export function downloadFilteredCSV(scope: ViewScope, filename?: string) {
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
export function downloadProjectCSV(
  projectId: string,
  projectName: string,
  projectProvider: string,
  projectRateUsdPer1k: number | undefined,
  entries: CsvEntry[],
  filename?: string
) {
  const csv = entriesToCsv(
    [{ id: projectId, name: projectName, provider: projectProvider, rateUsdPer1k: projectRateUsdPer1k }],
    { [projectId]: entries }
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

export function downloadFilteredJSON(scope: ViewScope, filename?: string) {
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
  entries: CsvEntry[],
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
