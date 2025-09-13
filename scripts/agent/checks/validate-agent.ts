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

// Config parsing (no assertions after guards)
function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const m = v; // narrowed by isRecord
  const mcl = (m as Record<string, unknown>)["maxChangedLines"];
  const mck = (m as Record<string, unknown>)["maxContextKB"];
  const okMcl = isPositiveInt(mcl);
  const okMck = mck === undefined || isPositiveInt(mck);
  return okMcl && okMck;
}

const cfg: AgentConfig = (() => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(CFG, "utf8"));
  } catch {
    fail("Invalid JSON in .agent/config.json");
  }
  if (!isAgentConfig(parsed)) {
    fail("Invalid structure in .agent/config.json (expected { maxChangedLines: number; maxContextKB?: number })");
  }
  // inside this branch, parsed is AgentConfig via the type guard
  return parsed;
})();

const maxContextKB = cfg.maxContextKB && cfg.maxContextKB > 0 ? cfg.maxContextKB : 512;

// Context size check
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
  `✅ Agent metadata validated — maxChangedLines=${cfg.maxChangedLines}, contextSize=${sizeKB}KB (limit ${maxContextKB}KB)`
);

// 2) Prompt validation
const AGENT_DIR = ".agent";
const PROMPTS_DIR = path.join(AGENT_DIR, "prompts");
const RULES_PATH = path.join(AGENT_DIR, "prompt-rules.json");

function isPromptRules(x: unknown): x is PromptRules {
  if (!isRecord(x)) return false;
  const r = x as Record<string, unknown>;
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

function loadRules(): PromptRules {
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

// 3) Ops schema gate
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
      const obj = dataUnknown; // narrowed to Record<string, unknown>
      const opsUnknown = (obj as Record<string, unknown>)["ops"];
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
  const rules = loadRules();
  validatePrompts(rules);
  validateOpsSchema();
  console.log("✅ Agent validation completed.");
}

if (require.main === module) {
  main();
}

export { main as validateAgent };
