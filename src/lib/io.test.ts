import { rangeForScope } from "@/lib/io";

test("Last 7 includes today", () => {
  const now = new Date("2025-08-22T12:00:00Z");
  const { from, to } = rangeForScope("LAST_7", now);
  // Expect window to be 2025-08-16..2025-08-22 (inclusive)
  const iso = (d?: Date) => d?.toISOString().slice(0, 10);
  expect(iso(from)).toBe("2025-08-16");
  expect(iso(to)).toBe("2025-08-22");
});
