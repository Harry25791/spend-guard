import fs from "node:fs";
import { execSync } from "node:child_process";

const CTX_PATH = ".agent/context.json";

function ensureContextBuilt() {
  if (fs.existsSync(CTX_PATH)) return;
  try {
    execSync("pnpm agent:context", { stdio: "inherit" });
  } catch {
    execSync("node --loader tsx ./scripts/agent/context/build-context.ts", { stdio: "inherit" });
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

describe("context pack", () => {
  it("exists and is JSON", () => {
    ensureContextBuilt();
    const raw = fs.readFileSync(CTX_PATH, "utf8");
    const obj: unknown = JSON.parse(raw);
    expect(isRecord(obj)).toBe(true);
    if (isRecord(obj)) {
      expect(Object.prototype.hasOwnProperty.call(obj, "generatedAt")).toBe(true);
    }
  });
});
