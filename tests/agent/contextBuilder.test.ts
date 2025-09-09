import fs from "node:fs";
import { execSync } from "node:child_process";

const CTX_PATH = ".agent/context.json";

function ensureContextBuilt() {
  if (fs.existsSync(CTX_PATH)) return;
  // First try the same script your CI uses
  try {
    execSync("pnpm agent:context", { stdio: "inherit" });
    return;
  } catch {
    // Fallback: invoke the builder directly via tsx
    // (works in both local and CI where tsx is devDependency)
    execSync("node --loader tsx ./scripts/agent/context/build-context.ts", {
      stdio: "inherit",
    });
  }
}

describe("context pack", () => {
  it("exists and is JSON", () => {
    ensureContextBuilt();
    const raw = fs.readFileSync(CTX_PATH, "utf8");
    const obj = JSON.parse(raw);
    expect(obj).toHaveProperty("generatedAt");
  });
});
