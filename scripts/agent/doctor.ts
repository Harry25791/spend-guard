// scripts/agent/doctor.ts
import fs from "node:fs";
import { execSync } from "node:child_process";

type AgentConfig = {
  branchPrefix: string;
  maxChangedLines: number;
  planner?: {
    defaultChangeBudget?: number;
    fallbackTask?: string;
  };
};

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const bp = v["branchPrefix"];
  const mcl = v["maxChangedLines"];
  const planner = v["planner"];
  if (typeof bp !== "string" || bp.length === 0) return false;
  if (typeof mcl !== "number") return false;
  if (planner !== undefined) {
    if (!isRecord(planner)) return false;
    const dcb = planner["defaultChangeBudget"];
    const ft = planner["fallbackTask"];
    if (dcb !== undefined && typeof dcb !== "number") return false;
    if (ft !== undefined && typeof ft !== "string") return false;
  }
  return true;
}

function readConfig(): AgentConfig {
  if (!fs.existsSync(".agent/config.json")) {
    fail("Missing .agent/config.json");
  }
  let parsed: unknown;
  try {
    const raw = fs.readFileSync(".agent/config.json", "utf8");
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("Invalid JSON in .agent/config.json");
  }
  if (!isAgentConfig(parsed)) {
    fail("Invalid shape for .agent/config.json (branchPrefix:string, maxChangedLines:number, optional planner)");
  }
  if (parsed.maxChangedLines < 1 || parsed.maxChangedLines > 400) {
    fail("config.maxChangedLines must be between 1 and 400");
  }
  return parsed;
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

  // Config sanity
  const cfg = readConfig();
  // Touch fields to satisfy "unused var" rules and ensure narrowing
  if (!cfg.branchPrefix || !cfg.maxChangedLines) {
    fail("config is missing required fields");
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
