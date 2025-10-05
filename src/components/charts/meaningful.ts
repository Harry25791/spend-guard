// Sum a single numeric key across rows
export function sumByKey<T extends Record<string, any>>(rows: T[], key: string): number {
  return rows.reduce((sum, r) => sum + Number((r as any)?.[key] ?? 0), 0);
}

// Sum multiple numeric keys across rows
export function sumByKeys<T extends Record<string, any>>(rows: T[], keys: string[]): number {
  return rows.reduce(
    (sum, r) => sum + keys.reduce((inner, k) => inner + Number((r as any)?.[k] ?? 0), 0),
    0
  );
}

// Generic threshold check (defaults to $0.01)
export function hasMeaningful(total: number, threshold = 0.01): boolean {
  return total >= threshold;
}
