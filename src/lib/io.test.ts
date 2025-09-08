import { rangeForScope, type ViewScope } from "@/lib/io";
import { describe, it, expect } from "vitest";

// local y-m-d formatter to avoid timezone shifts
const ymdLocal = (d?: Date) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined;

describe("rangeForScope (local-day inclusive)", () => {
  const NOW = new Date("2025-08-22T12:00:00"); // local noon on Aug 22, 2025

  it("last7 includes today", () => {
    const { from, to } = rangeForScope("last7" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2025-08-16"); // 7 days inclusive: 16..22
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("last14 includes today", () => {
    const { from, to } = rangeForScope("last14" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2025-08-09");
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("last30 includes today", () => {
    const { from, to } = rangeForScope("last30" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2025-07-24");
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("last90 includes today", () => {
    const { from, to } = rangeForScope("last90" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2025-05-25");
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("last365 includes today", () => {
    const { from, to } = rangeForScope("last365" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2024-08-23"); // 365 inclusive from 2025-08-22 -> 2024-08-24
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("month starts on first of this month and includes today", () => {
    const { from, to } = rangeForScope("month" as ViewScope, NOW);
    expect(ymdLocal(from)).toBe("2025-08-01");
    expect(ymdLocal(to)).toBe("2025-08-22");
  });

  it("lifetime returns open range", () => {
    const { from, to } = rangeForScope("lifetime" as ViewScope, NOW);
    expect(from).toBeUndefined();
    expect(to).toBeUndefined();
  });
});
