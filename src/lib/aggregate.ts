// src/lib/aggregate.ts

/** Period granularity for charts/tables. */
export type Period = "day" | "week" | "month";

type Numberish = number | string;

/* ============================================================================
   Local-date helpers (match io.ts behavior: local day boundaries, inclusive)
   ========================================================================== */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse "YYYY-MM-DD" (or Date-ish) to a Date at local midnight. */
function toLocalDate(date: string | Date): Date | null {
  if (date instanceof Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (!date) return null;
  // Handle ISO date-only strings
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (m) {
    const y = +m[1], mo = +m[2] - 1, da = +m[3];
    const d = new Date(y, mo, da, 0, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback: let Date parse, then clamp to local midnight
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonthLocal(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekISO(d: Date): Date {
  // Monday = 1…Sunday = 7
  const wd = (d.getDay() || 7);
  const x = addDaysLocal(d, 1 - wd);
  return x;
}

function isoWeekKeyLocal(d: Date): string {
  // ISO week label "YYYY-Www" based on local time
  // Find Thursday of current week
  const wkStart = startOfWeekISO(d);
  const thursday = addDaysLocal(wkStart, 3);
  // Week number
  const yearStart = startOfWeekISO(new Date(thursday.getFullYear(), 0, 4));
  const diffDays = Math.round((thursday.getTime() - yearStart.getTime()) / 86400000);
  const weekNo = Math.floor(diffDays / 7) + 1;
  return `${thursday.getFullYear()}-W${pad2(weekNo)}`;
}

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* ============================================================================
   Public: original API (now local-day correct) + new series builders
   ========================================================================== */

export function groupEntriesByPeriod(
  entries: { date: string | Date; cost: Numberish; tokens?: Numberish }[],
  period: Period
): Array<{ key: string; cost: number; tokens: number }> {
  const map = new Map<string, { cost: number; tokens: number }>();

  for (const e of entries) {
    if (!e?.date) continue;
    const d = toLocalDate(e.date);
    if (!d) continue;

    const key =
      period === "day" ? dayKeyLocal(d)
      : period === "month" ? monthKeyLocal(d)
      : isoWeekKeyLocal(d);

    const prev = map.get(key) || { cost: 0, tokens: 0 };
    const c = Number(e.cost) || 0;
    const t = Number(e.tokens ?? 0) || 0;
    prev.cost += c;
    prev.tokens += t;
    map.set(key, prev);
  }

  const rows = Array.from(map.entries()).map(([key, v]) => ({
    key,
    cost: Number(v.cost.toFixed(2)),
    tokens: Math.round(v.tokens),
  }));
  rows.sort((a, b) => a.key.localeCompare(b.key));

  return rows;
}

/** Build a continuous list of keys between from..to for a given period. */
export function buildTimeKeys(
  period: Period,
  from?: Date,
  to?: Date
): string[] {
  if (!from || !to) return [];
  const keys: string[] = [];

  // Normalize bounds to local boundaries
  let cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = endOfDayLocal(to);

  if (period === "day") {
    while (cursor <= end) {
      keys.push(dayKeyLocal(cursor));
      cursor = addDaysLocal(cursor, 1);
    }
    return keys;
  }

  if (period === "week") {
    cursor = startOfWeekISO(cursor);
    while (cursor <= end) {
      keys.push(isoWeekKeyLocal(cursor));
      cursor = addDaysLocal(cursor, 7);
    }
    return keys;
  }

  // month
  cursor = startOfMonthLocal(cursor);
  while (cursor <= end) {
    keys.push(monthKeyLocal(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return keys;
}

/** Ensure a series has zero-filled points for missing keys. */
export function fillMissingKeys<T extends { key: string; cost?: number; tokens?: number }>(
  rows: T[],
  keys: string[]
): T[] {
  const map = new Map(rows.map((r) => [r.key, r]));
  const filled: T[] = keys.map((k) => {
    const r = map.get(k);
    if (r) return r;
    return { key: k, cost: 0, tokens: 0 } as T;
  });
  return filled;
}

/** Add cumulative fields to a time series. */
export function withCumulative<T extends { key: string; cost: number; tokens: number }>(
  rows: T[]
): Array<T & { cumCost: number; cumTokens: number }> {
  let accC = 0, accT = 0;
  return rows.map((r) => {
    accC += r.cost;
    accT += r.tokens;
    return { ...r, cumCost: Number(accC.toFixed(2)), cumTokens: accT };
  });
}

/**
 * Build a timeline series (grouped by period) with optional gap filling and
 * cumulative fields for easy Recharts use.
 */
export function buildTimelineSeries(
  entries: { date: string | Date; cost: Numberish; tokens?: Numberish }[],
  opts: {
    period?: Period;
    from?: Date; // if provided, gaps will be filled
    to?: Date;   // if provided, gaps will be filled
    cumulative?: boolean;
  } = {}
): Array<{ key: string; cost: number; tokens: number; cumCost?: number; cumTokens?: number }> {
  const period = opts.period ?? "day";
  let rows = groupEntriesByPeriod(entries, period);

  if (opts.from && opts.to) {
    const keys = buildTimeKeys(period, opts.from, opts.to);
    rows = fillMissingKeys(rows, keys);
    rows.sort((a, b) => a.key.localeCompare(b.key));
  }

  if (opts.cumulative) {
    return withCumulative(rows);
  }
  return rows;
}

/**
 * Provider stack series for stacked charts.
 * Returns:
 *  - rows: [{ key, <providerA>: number, <providerB>: number, ... }]
 *  - providers: string[] in stable order for stacked keys
 */
export function buildProviderStack(
  entries: { date: string | Date; cost: Numberish; provider?: string }[],
  opts: {
    period?: Period;
    from?: Date;
    to?: Date;
    normalizeProviderName?: (s?: string) => string; // optional normalizer (lowercase/trim/etc.)
  } = {}
): { rows: Array<Record<string, string | number>>; providers: string[] } {
  const period = opts.period ?? "day";
  const norm = opts.normalizeProviderName ?? ((s?: string) => (s || "unknown").trim());

  // Bucket: periodKey -> provider -> cost
  const bucket = new Map<string, Map<string, number>>();
  const providersSet = new Set<string>();

  for (const e of entries) {
    if (!e?.date) continue;
    const d = toLocalDate(e.date);
    if (!d) continue;

    const key =
      period === "day" ? dayKeyLocal(d)
      : period === "month" ? monthKeyLocal(d)
      : isoWeekKeyLocal(d);

    const prov = norm(e.provider);
    providersSet.add(prov);

    if (!bucket.has(key)) bucket.set(key, new Map());
    const inner = bucket.get(key)!;
    inner.set(prov, (inner.get(prov) || 0) + (Number(e.cost) || 0));
  }

  // Convert to rows
  let rows: Array<Record<string, string | number>> = Array.from(bucket.entries())
    .map(([key, m]) => {
      const obj: Record<string, string | number> = { key };
      for (const [prov, val] of m.entries()) obj[prov] = Number(val.toFixed(2));
      return obj;
    });

  // Gap-fill keys if range provided
  if (opts.from && opts.to) {
    const keys = buildTimeKeys(period, opts.from, opts.to);
    const map = new Map(rows.map((r) => [r.key as string, r]));
    rows = keys.map((k) => map.get(k) ?? { key: k });
  }

  // Ensure every row has every provider key (with 0)
  const providers = Array.from(providersSet.values()).sort();
  rows.forEach((r) => {
    for (const p of providers) {
      if (r[p] == null) r[p] = 0;
    }
    // Round numbers consistently
    for (const p of providers) {
      const v = Number(r[p]);
      r[p] = Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
    }
  });

  // Stable chronological order
  rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));

  return { rows, providers };
}

/**
 * Model stack series for stacked charts (mirrors buildProviderStack).
 * Returns:
 *  - rows: [{ key, <modelA>: number, <modelB>: number, ... }]
 *  - models: string[] in stable order for stacked keys
 */
export function buildModelStack(
  entries: { date: string | Date; cost: Numberish; model?: string }[],
  opts: {
    period?: Period;
    from?: Date;
    to?: Date;
    normalizeModelName?: (s?: string) => string; // optional normalizer (trim/lower/etc.)
  } = {}
): { rows: Array<Record<string, string | number>>; models: string[] } {
  const period = opts.period ?? "day";
  const norm = opts.normalizeModelName ?? ((s?: string) => (s || "unknown").trim());

  // Bucket: periodKey -> model -> cost
  const bucket = new Map<string, Map<string, number>>();
  const modelsSet = new Set<string>();

  for (const e of entries) {
    if (!e?.date) continue;
    const d = toLocalDate(e.date);
    if (!d) continue;

    const key =
      period === "day" ? dayKeyLocal(d)
      : period === "month" ? monthKeyLocal(d)
      : isoWeekKeyLocal(d);

    const mdl = norm(e.model);
    modelsSet.add(mdl);

    if (!bucket.has(key)) bucket.set(key, new Map());
    const inner = bucket.get(key)!;
    inner.set(mdl, (inner.get(mdl) || 0) + (Number(e.cost) || 0));
  }

  // Convert to rows
  let rows: Array<Record<string, string | number>> = Array.from(bucket.entries())
    .map(([key, m]) => {
      const obj: Record<string, string | number> = { key };
      for (const [mdl, val] of m.entries()) obj[mdl] = Number(val.toFixed(2));
      return obj;
    });

  // Gap-fill keys if range provided
  if (opts.from && opts.to) {
    const keys = buildTimeKeys(period, opts.from, opts.to);
    const map = new Map(rows.map((r) => [r.key as string, r]));
    rows = keys.map((k) => map.get(k) ?? { key: k });
  }

  // Ensure every row has every model key (with 0)
  const models = Array.from(modelsSet.values()).sort();
  rows.forEach((r) => {
    for (const m of models) {
      if (r[m] == null) r[m] = 0;
      const v = Number(r[m]);
      r[m] = Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
    }
  });

  // Stable chronological order
  rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));

  return { rows, models };
}
