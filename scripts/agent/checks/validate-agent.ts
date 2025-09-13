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

// ─────────────────────────────────────────────────────────────────────────────
// 1) Baseline metadata checks (preserved from previous version)
// ─────────────────────────────────────────────────────────────────────────────
const CFG = ".agent/config.json";
const CTX = ".agent/context.json";

if (!existsSync(CFG)) fail("Missing .agent/config.json");
if (!existsSync(CTX)) fail("Missing .agent/context.json");

type AgentConfig = {
  maxChangedLines: number;
  maxContextKB?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAgentConfig(v: unknown): v is AgentConfig {
  if (!isRecord(v)) return false;
  const mcl = (v as any)["maxChangedLines"];
  const mck = (v as any)["maxContextKB"];
  const mclOk =
    typeof mcl === "number" && Number.isInteger(mcl) && mcl > 0 && Number.isFinite(mcl);
  const mckOk =
    mck === undefined ||
    (typeof mck === "number" && Number.isInteger(mck) && mck > 0 && Number.isFinite(mck));
  return mclOk && mckOk;
}

// Parse config safely
let cfgUnknown: unknown;
try {
  cfgUnknown = JSON.parse(readFileSync(CFG, "utf8"));
} catch {
  fail("Invalid JSON in .agent/config.json");
}
if (!isAgentConfig(cfgUnknown)) {
  fail(
    "Invalid structure in .agent/config.json (expected { maxChangedLines: number; maxContextKB?: number })"
  );
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
  `✅ Agent metadata validated — maxChangedLines=${cfg.maxChangedLines}, contextSize=${sizeKB}KB (limit ${maxContextKB}KB)`
);

// ─────────────────────────────────────────────────────────────────────────────
// 2) Prompt validation (.agent/prompts/*.md against .agent/prompt-rules.json)
// ─────────────────────────────────────────────────────────────────────────────
type PromptRules = {
  requiredSections?: string[];   // e.g. ["## Task", "## Context", "## Rules", "## Output"]
  bannedPhrases?: string[];      // case-insensitive
  maxChars?: number;             // cap to prevent runaways
  maxLines?: number;             // optional line cap
};

const AGENT_DIR = ".agent";
const PROMPTS_DIR = path.join(AGENT_DIR, "prompts");
const RULES_PATH = path.join(AGENT_DIR, "prompt-rules.json");

function loadRules(): PromptRules {
  if (existsSync(RULES_PATH)) {
    try {
      return JSON.parse(readFileSync(RULES_PATH, "utf8"));
    } catch {
      fail("Invalid JSON in .agent/prompt-rules.json");
    }
  }
  // Safe defaults if no rules file present
  return {
    requiredSections: ["## Task", "## Context", "## Rules", "## Output"],
    bannedPhrases: ["as an ai", "i can't", "i cannot"],
    maxChars: 12000,
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

// ─────────────────────────────────────────────────────────────────────────────
// 3) Ops schema validation (.agent/ops.json against Edit Engine guards)
// ─────────────────────────────────────────────────────────────────────────────
const OPS_PATH = ".agent/ops.json";

function validateOpsSchema() {
  if (!existsSync(OPS_PATH)) {
    info(`${OPS_PATH} not found; skipping ops schema validation (fail-open).`);
    return;
  }
  let data: any;
  try {
    data = JSON.parse(readFileSync(OPS_PATH, "utf8"));
  } catch {
    fail(`Invalid JSON in ${OPS_PATH}`);
  }

  if (!isOpsPlan(data)) {
    // Pinpoint invalid ops for easier debugging
    if (data && Array.isArray(data.ops)) {
      const bad = data.ops
        .map((op: any, i: number) => ({ i, ok: isOp(op) }))
        .filter((x: any) => !x.ok)
        .map((x: any) => x.i);
      if (bad.length) {
        fail(`${OPS_PATH} invalid; bad op indices: ${bad.join(", ")}`);
      }
    }
    fail(`${OPS_PATH} does not match Edit Engine contract.`);
  }
  console.log(`✅ ${OPS_PATH} matches Edit Engine contract.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Main
// ─────────────────────────────────────────────────────────────────────────────
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
