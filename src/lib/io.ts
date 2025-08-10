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
