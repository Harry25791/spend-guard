// src/lib/aggregate.ts
export type Period = "day" | "week" | "month";

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function isoWeekKey(d: Date): string {
  // ISO week: Monday-based
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime())/86400000) + 1)/7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

export function groupEntriesByPeriod(
  entries: { date: string; cost: number; tokens?: number }[],
  period: Period
): Array<{ key: string; cost: number; tokens: number }> {
  const map = new Map<string, { cost: number; tokens: number }>();
  for (const e of entries) {
    if (!e?.date) continue;
    const d = new Date(e.date);
    const key =
      period === "day" ? `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}` :
      period === "month" ? `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}` :
      isoWeekKey(d);
    const prev = map.get(key) || { cost: 0, tokens: 0 };
    prev.cost += Number(e.cost) || 0;
    prev.tokens += Number(e.tokens) || 0;
    map.set(key, prev);
  }
  const rows = Array.from(map.entries()).map(([key, v]) => ({ key, cost: Number(v.cost.toFixed(2)), tokens: v.tokens }));
  rows.sort((a,b) => a.key.localeCompare(b.key));
  return rows;
}
