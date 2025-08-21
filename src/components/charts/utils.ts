// src/components/charts/utils.ts
import type { Period } from "@/lib/aggregate";

export function daysBetween(a: Date, b: Date) {
  const A = new Date(a); A.setHours(0,0,0,0);
  const B = new Date(b); B.setHours(0,0,0,0);
  return Math.abs(Math.round((+B - +A) / 86_400_000));
}

/** Heuristic: choose period based on window length. */
export function autoPeriod(from?: Date, to?: Date): Period {
  if (!from || !to) return "day";
  const d = daysBetween(from, to);
  if (d > 180) return "month";
  if (d > 35) return "week";
  return "day";
}

export const fmtUsd = (n: number) =>
  `$${(Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtTokens = (n: number) =>
  `${Math.round(n).toLocaleString()} tk`;
