// scripts/agent/doctor.ts
import fs from "node:fs";
import { execSync } from "node:child_process";

function fail(msg: string): never {
  console.error(`[doctor] ${msg}`);
  process.exit(1);
}

function warn(msg: string) {
  console.warn(`[doctor] WARN: ${msg}`);
}

function hasBin(cmd: string) {
  try {
    execSync(`${cmd} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  // Node >= 20
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
    fail(`Node >= 20 required. Detected ${process.versions.node}`);
  }

  // pnpm available (via Corepack or global)
  if (!hasBin("pnpm")) {
    fail("pnpm not found. Enable Corepack or install pnpm.");
  }

  // Config exists & sane
  if (!fs.existsSync(".agent/config.json")) {
    fail("Missing .agent/config.json");
  }
  let cfg: any;
  try {
    cfg = JSON.parse(fs.readFileSync(".agent/config.json", "utf8"));
  } catch {
    fail("Invalid JSON in .agent/config.json");
  }
  if (typeof cfg.branchPrefix !== "string" || !cfg.branchPrefix.length) {
    fail("config.branchPrefix must be a non-empty string");
  }
  if (
    typeof cfg.maxChangedLines !== "number" ||
    cfg.maxChangedLines < 1 ||
    cfg.maxChangedLines > 400
  ) {
    fail("config.maxChangedLines must be a number between 1 and 400");
  }

  // Vitest present (unit tests gate)
  if (!fs.existsSync("node_modules/.bin/vitest")) {
    warn("vitest not found in node_modules/.bin — unit tests may fail later");
  }

  // Local-only cleanliness hint (implementer autostash handles it)
  try {
    const out = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (out && !process.env.CI) {
      warn("working tree not clean — implementer will try to autostash");
    }
  } catch {
    // ignore if git unavailable
  }

  console.log("[doctor] ok");
}

main();
