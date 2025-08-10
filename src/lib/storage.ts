// lib/storage.ts
export type Project = {
  id: string;
  name: string;
  provider: string;          // e.g., "openai"
  rateUsdPer1k?: number;     // optional project-level override
  // (future) defaultModel?: string
};

export type EntryV1 = {
  id: string;
  date: string;              // "YYYY-MM-DD"
  tokens: number;
  cost: number;
};

export type EntryV2 = EntryV1 & {
  provider?: string;         // stored per-entry
  model?: string;            // stored per-entry
  rateUsdPer1k?: number;     // snapshot used for this entry (optional)
};

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("projects");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("projects", JSON.stringify(projects));
}

export function loadEntries(projectId: string, projectProvider?: string): EntryV2[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(`entries-${projectId}`);
  if (!raw) return [];
  try {
    const arr: (EntryV1 | EntryV2)[] = JSON.parse(raw);
    // Migrate forward: if older entries don't have provider/model, add provider from project for compatibility
    return arr.map((e) => {
      const v2: EntryV2 = { ...e } as EntryV2;
      if (!("provider" in v2) || !v2.provider) {
        v2.provider = projectProvider || undefined;
      }
      // leave model undefined for legacy rows — UI will show "Select model"
      return v2;
    });
  } catch {
    return [];
  }
}

export function saveEntries(projectId: string, entries: EntryV2[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`entries-${projectId}`, JSON.stringify(entries));
}
