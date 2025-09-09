// scripts/agent/checks/validate-agent.ts
import { readFileSync, existsSync } from "node:fs";

function fail(msg: string): never {
  console.error(`Agent validation failed: ${msg}`);
  process.exit(1);
}

const CFG = ".agent/config.json";
const CTX = ".agent/context.json";

// Must exist
if (!existsSync(CFG)) fail("Missing .agent/config.json");
if (!existsSync(CTX)) fail("Missing .agent/context.json");

// Parse config
let cfg: any;
try {
  cfg = JSON.parse(readFileSync(CFG, "utf8"));
} catch {
  fail("Invalid JSON in .agent/config.json");
}

if (
  typeof cfg.maxChangedLines !== "number" ||
  !Number.isInteger(cfg.maxChangedLines) ||
  cfg.maxChangedLines <= 0
) {
  fail("config.maxChangedLines must be a positive integer");
}

// Optional cap for context size (KB). Default 512KB if not provided.
const maxContextKB: number =
  typeof cfg.maxContextKB === "number" && cfg.maxContextKB > 0
    ? cfg.maxContextKB
    : 512;

// Parse/size context
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
