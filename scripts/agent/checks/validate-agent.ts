// scripts/agent/checks/validate-agent.ts
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { isOp, isOpsPlan } from "../ops/apply-ops";

function fail(msg: string): never {
  console.error(`❌ Agent validation failed: ${msg}`);
  process.exit(1);
}
function warn(msg: string) {
  console.warn(`⚠️  ${msg}`);
}
function info(msg: string) {
  console.log(`ℹ️  ${msg}`);
}

// 1) Baseline files
const CFG = ".agent/config.json";
const CTX = ".agent/context.json";
if (!existsSync(CFG)) fail("Missing .agent/config.json");
if (!existsSync(CTX)) fail("Missing .agent/context.json");

// Types
type AgentConfig = { maxChangedLines: number; maxContextKB?: number };
type PromptRules = {
  requiredSections?: string[];
  bannedPhrases?: string[];
  maxChars?: number;
  maxLines?: number;
};

// Tiny helpers (no assertions)
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && Number.isFinite(n);
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === "string");
}

// Agent config guard
function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const m = v; // narrowed by isRecord
  const mcl = m["maxChangedLines"];
  const mck = m["maxContextKB"];
  const okMcl = isPositiveInt(mcl);
  const okMck = mck === undefined || isPositiveInt(mck);
  return okMcl && okMck;
}

// Load agent config (avoid assertions by branching)
function loadAgentConfig(): AgentConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(CFG, "utf8"));
  } catch {
    fail("Invalid JSON in .agent/config.json");
  }
  if (isAgentConfig(parsed)) return parsed;
  fail("Invalid structure in .agent/config.json (expected { maxChangedLines: number; maxContextKB?: number })");
}

// Context size check
function validateContextSize(maxKB: number) {
  let ctxRaw = "";
  try {
    ctxRaw = readFileSync(CTX, "utf8");
    JSON.parse(ctxRaw);
  } catch {
    fail("Invalid JSON in .agent/context.json");
  }
  const sizeKB = Math.ceil(Buffer.byteLength(ctxRaw, "utf8") / 1024);
  if (sizeKB > maxKB) {
    fail(`.agent/context.json too large: ${sizeKB}KB > ${maxKB}KB`);
  }
  return sizeKB;
}

// Prompt rules guard
function isPromptRules(x: unknown): x is PromptRules {
  if (!isRecord(x)) return false;
  const r = x;
  const rs = r["requiredSections"];
  const bp = r["bannedPhrases"];
  const mc = r["maxChars"];
  const ml = r["maxLines"];

  if (rs !== undefined && !isStringArray(rs)) return false;
  if (bp !== undefined && !isStringArray(bp)) return false;
  if (mc !== undefined && typeof mc !== "number") return false;
  if (ml !== undefined && typeof ml !== "number") return false;
  return true;
}

// Load prompt rules (no assertions)
function loadRules(): PromptRules {
  const RULES_PATH = path.join(".agent", "prompt-rules.json");
  if (existsSync(RULES_PATH)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(RULES_PATH, "utf8"));
      if (!isPromptRules(parsed)) fail("Invalid structure in .agent/prompt-rules.json");
      return parsed;
    } catch {
      fail("Invalid JSON in .agent/prompt-rules.json");
    }
  }
  return {
    requiredSections: ["## Task", "## Context", "## Rules", "## Output"],
    bannedPhrases: ["as an ai", "i can't", "i cannot"],
    maxChars: 12000
  };
}

function escapeForRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validatePrompts(rules: PromptRules) {
  const PROMPTS_DIR = path.join(".agent", "prompts");
  if (!existsSync(PROMPTS_DIR)) {
    warn(`${PROMPTS_DIR} not found; skipping prompt validation.`);
    return;
  }
  const files = readdirSync(PROMPTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => path.join(PROMPTS_DIR, f));

  if (files.length === 0) {
    warn(`${PROMPTS_DIR} contains no .md files; skipping prompt validation.`);
    return;
  }

  const errs: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lower = text.toLowerCase();

    if (rules.maxChars !== undefined && text.length > rules.maxChars) {
      errs.push(`${path.relative(process.cwd(), file)} exceeds maxChars (${text.length} > ${rules.maxChars}).`);
    }
    if (rules.maxLines !== undefined) {
      const lines = text.split(/\r?\n/).length;
      if (lines > rules.maxLines) {
        errs.push(`${path.relative(process.cwd(), file)} exceeds maxLines (${lines} > ${rules.maxLines}).`);
      }
    }
    if (Array.isArray(rules.bannedPhrases) && rules.bannedPhrases.length) {
      for (const phrase of rules.bannedPhrases) {
        if (lower.includes(phrase.toLowerCase())) {
          errs.push(`${path.relative(process.cwd(), file)} contains banned phrase: "${phrase}".`);
        }
      }
    }
    if (Array.isArray(rules.requiredSections) && rules.requiredSections.length) {
      for (const section of rules.requiredSections) {
        const re = new RegExp(`^\\s*${escapeForRegExp(section)}\\s*$`, "mi");
        if (!re.test(text)) {
          errs.push(`${path.relative(process.cwd(), file)} missing required section heading: ${section}`);
        }
      }
    }
  }

  if (errs.length) {
    fail(`Prompt validation failed:\n- ${errs.join("\n- ")}`);
  }
  console.log(`✅ Prompt validation passed for ${files.length} file(s).`);
}

// Ops schema gate (no assertions)
const OPS_PATH = ".agent/ops.json";
function validateOpsSchema() {
  if (!existsSync(OPS_PATH)) {
    info(`${OPS_PATH} not found; skipping ops schema validation (fail-open).`);
    return;
  }
  let dataUnknown: unknown;
  try {
    dataUnknown = JSON.parse(readFileSync(OPS_PATH, "utf8"));
  } catch {
    fail(`Invalid JSON in ${OPS_PATH}`);
  }

  if (!isOpsPlan(dataUnknown)) {
    if (isRecord(dataUnknown)) {
      const obj = dataUnknown; // Record<string, unknown>
      const opsUnknown = obj["ops"];
      if (Array.isArray(opsUnknown)) {
        const bad = opsUnknown
          .map((op, i) => ({ i, ok: isOp(op) }))
          .filter((x) => !x.ok)
          .map((x) => x.i);
        if (bad.length) fail(`${OPS_PATH} invalid; bad op indices: ${bad.join(", ")}`);
      }
    }
    fail(`${OPS_PATH} does not match Edit Engine contract.`);
  }
  console.log(`✅ ${OPS_PATH} matches Edit Engine contract.`);
}

// 4) Main
function main() {
  const cfg = loadAgentConfig();
  const maxContextKB = cfg.maxContextKB && cfg.maxContextKB > 0 ? cfg.maxContextKB : 512;
  const ctxKB = validateContextSize(maxContextKB);
  console.log(
    `✅ Agent metadata validated — maxChangedLines=${cfg.maxChangedLines}, contextSize=${ctxKB}KB (limit ${maxContextKB}KB)`
  );
  const rules = loadRules();
  validatePrompts(rules);
  validateOpsSchema();
  console.log("✅ Agent validation completed.");
}

if (require.main === module) {
  main();
}

export { main as validateAgent };
