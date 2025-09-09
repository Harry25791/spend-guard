// scripts/agent/checks/validate-agent.ts
import { readFileSync, existsSync } from "node:fs";

function fail(msg: string): never {
  console.error(`Agent validation failed: ${msg}`);
  process.exit(1);
}

// Files that must exist
const CFG = ".agent/config.json";
const CTX = ".agent/context.json";

if (!existsSync(CFG)) fail("Missing .agent/config.json");
if (!existsSync(CTX)) fail("Missing .agent/context.json");

// Types + guards
type AgentConfig = {
  maxChangedLines: number;
  maxContextKB?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const mcl = v["maxChangedLines"];
  const mck = v["maxContextKB"];
  const mclOk =
    typeof mcl === "number" && Number.isInteger(mcl) && mcl > 0 && Number.isFinite(mcl);
  const mckOk =
    mck === undefined ||
    (typeof mck === "number" && Number.isInteger(mck) && mck > 0 && Number.isFinite(mck));
  return mclOk && mckOk;
}

// Parse config safely
let cfgRaw = "";
let cfgUnknown: unknown;
try {
  cfgRaw = readFileSync(CFG, "utf8");
  cfgUnknown = JSON.parse(cfgRaw);
} catch {
  fail("Invalid JSON in .agent/config.json");
}

if (!isAgentConfig(cfgUnknown)) {
  fail("Invalid structure in .agent/config.json (expected { maxChangedLines: number; maxContextKB?: number })");
}
const cfg: AgentConfig = cfgUnknown;

// Defaults
const maxContextKB = cfg.maxContextKB && cfg.maxContextKB > 0 ? cfg.maxContextKB : 512;

// Parse context and check size
let ctxRaw = "";
try {
  ctxRaw = readFileSync(CTX, "utf8");
  JSON.parse(ctxRaw);
} catch {
  fail("Invalid JSON in .agent/context.json");
}

const sizeKB = Math.ceil(Buffer.byteLength(ctxRaw, "utf8") / 1024);
if (sizeKB > maxContextKB) {
  fail(`.agent/context.json too large: ${sizeKB}KB > ${maxContextKB}KB`);
}

console.log(
  `Agent metadata validated ✅  maxChangedLines=${cfg.maxChangedLines}, contextSize=${sizeKB}KB (limit ${maxContextKB}KB)`
);
