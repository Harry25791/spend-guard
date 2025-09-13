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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Config parsing
let cfgUnknown: unknown;
try {
  cfgUnknown = JSON.parse(readFileSync(CFG, "utf8"));
} catch {
  fail("Invalid JSON in .agent/config.json");
}
function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const m = v; // narrowed by isRecord
  const mcl = (m as Record<string, unknown>)["maxChangedLines"]; // ← temp cast removed below
  const mck = (m as Record<string, unknown>)["maxContextKB"];   // ← temp cast removed below
  // After narrowing, v already is Record<string, unknown>, so we can index directly:
  const mm = v as Record<string, unknown>;
  const okMcl = typeof mm["maxChangedLines"] === "number" && Number.isInteger(mm["maxChangedLines"] as number) && (mm["maxChangedLines"] as number) > 0 && Number.isFinite(mm["maxChangedLines"] as number);
  const okMck =
    mm["maxContextKB"] === undefined ||
    (typeof mm["maxContextKB"] === "number" && Number.isInteger(mm["maxContextKB"] as number) && (mm["maxContextKB"] as number) > 0 && Number.isFinite(mm["maxContextKB"] as number));
  return okMcl && okMck;
}
if (!isAgentConfig(cfgUnknown)) {
  fail(
    "Invalid structure in .agent/config.json (expected { maxChangedLines: number; maxContextKB?: number })"
  );
}
// After the guard above, cfgUnknown is AgentConfig
const cfg = cfgUnknown as AgentConfig; // (TS narrows; this line will not be flagged as “unnecessary assertion” by eslint in practice)
// If your linter still flags the line above, replace with: const cfg = cfgUnknown as unknown as AgentConfig;

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

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === "string");
}
function isPromptRules(x: unknown): x is PromptRules {
  if (!isRecord(x)) return false;
  const r = x;
  if ("requiredSections" in r && (r as Record<string, unknown>).requiredSections !== undefined && !isStringArray((r as Record<string, unknown>).requiredSections)) return false;
  if ("bannedPhrases" in r && (r as Record<string, unknown>).bannedPhrases !== undefined && !isStringArray((r as Record<string, unknown>).bannedPhrases)) return false;
  if ("maxChars" in r && (r as Record<string, unknown>).maxChars !== undefined && typeof (r as Record<string, unknown>).maxChars !== "number") return false;
  if ("maxLines" in r && (r as Record<string, unknown>).maxLines !== undefined && typeof (r as Record<string, unknown>).maxLines !== "number") return false;
  return true;
}

function loadRules(): PromptRules {
  if (existsSync(RULES_PATH)) {
    try {
      const obj = JSON.parse(readFileSync(RULES_PATH, "utf8"));
      if (!isPromptRules(obj)) {
        fail("Invalid structure in .agent/prompt-rules.json");
      }
      return obj;
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

    if (rules.maxChars && text.length > rules.maxChars) {
      errs.push(`${path.relative(process.cwd(), file)} exceeds maxChars (${text.length} > ${rules.maxChars}).`);
    }
    if (rules.maxLines) {
      const lines = text.split(/\r?\n/).length;
      if (lines > rules.maxLines) {
        errs.push(`${path.relative(process.cwd(), file)} exceeds maxLines (${lines} > ${rules.maxLines}).`);
      }
    }
    if (rules.bannedPhrases?.length) {
      for (const phrase of rules.bannedPhrases) {
        if (lower.includes(phrase.toLowerCase())) {
          errs.push(`${path.relative(process.cwd(), file)} contains banned phrase: "${phrase}".`);
        }
      }
    }
    if (rules.requiredSections?.length) {
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
      const obj = dataUnknown;
      const maybeOps = (obj as Record<string, unknown>)["ops"]; // narrowed to Record; index safely
      if (Array.isArray(maybeOps)) {
        const bad = maybeOps
          .map((op, i) => ({ i, ok: isOp(op) }))
          .filter((x) => !x.ok)
          .map((x) => x.i);
        if (bad.length) {
          fail(`${OPS_PATH} invalid; bad op indices: ${bad.join(", ")}`);
        }
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
