import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isOp, isOpsPlan } from "../../scripts/agent/ops/apply-ops";

function readFixture(name: string) {
  const p = path.join(__dirname, "fixtures", name);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

describe("Edit Engine OpsPlan contract", () => {
  it("accepts a valid ops plan (good-ops.json)", () => {
    const data = readFixture("good-ops.json");
    expect(isOpsPlan(data)).toBe(true);
    expect(data.ops.every((op: unknown) => isOp(op))).toBe(true);
  });

  it("rejects an invalid ops plan (bad-ops.json)", () => {
    const data = readFixture("bad-ops.json");
    expect(isOpsPlan(data)).toBe(false);
  });

  it("flags individual invalid ops in bad-ops.json", () => {
    const data = readFixture("bad-ops.json");
    const validity = Array.isArray(data.ops)
      ? data.ops.map((op: unknown) => isOp(op))
      : [];
    // Expect at least one invalid op
    expect(validity.some((v: boolean) => v === false)).toBe(true);
  });
});
