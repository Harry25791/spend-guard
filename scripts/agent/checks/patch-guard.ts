// scripts/agent/checks/patch-guard.ts
import { execSync } from "node:child_process";
import fs from "node:fs";

type AgentConfig = {
  maxChangedLines: number;
  allowPaths?: string[];   // optional; simple matcher for your common patterns
  forbidPaths?: string[];
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === "string");
}

function isAgentConfig(v: unknown): v is AgentConfig {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.maxChangedLines !== "number") return false;
  if (o.allowPaths !== undefined && !isStringArray(o.allowPaths)) return false;
  if (o.forbidPaths !== undefined && !isStringArray(o.forbidPaths)) return false;
  return true;
}

function readCfg(): AgentConfig {
  const raw = fs.readFileSync(".agent/config.json", "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isAgentConfig(parsed)) {
    throw new Error("Invalid .agent/config.json");
  }
  if (parsed.maxChangedLines < 1) {
    throw new Error("maxChangedLines must be >= 1");
  }
  return parsed;
}

function ensureUpstream() {
  try {
    execSync("git rev-parse --verify origin/main", { stdio: "ignore" });
  } catch {
    execSync("git fetch origin main", { stdio: "inherit" });
  }
}

function simpleMatch(file: string, pattern: string): boolean {
  if (pattern === "**") return true;
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -3));
  if (pattern.startsWith("**.")) return file.endsWith(pattern.slice(3)); // e.g. **.png
  if (pattern.includes("/**.")) {
    // e.g. public/**.png
    const [dir, ext] = pattern.split("/**.");
    return file.startsWith(dir + "/") && file.endsWith("." + ext);
  }
  // exact file (README.md, ROADMAP.md)
  return file === pattern;
}

function isAllowed(file: string, allow: string[] | undefined, forbid: string[] | undefined): boolean {
  const allowed = !allow || allow.length === 0 || allow.some(p => simpleMatch(file, p));
  const forbidden = !!forbid && forbid.some(p => simpleMatch(file, p));
  return allowed && !forbidden;
}

function main() {
  const cfg = readCfg();
  ensureUpstream();

  // Use merge-base triple-dot to measure topic branch diff
  const out = execSync("git diff --numstat origin/main...HEAD", { encoding: "utf8" });

  let added = 0;
  let deleted = 0;
  const details: { file: string; a: number; d: number }[] = [];

  out.trim().split("\n").filter(Boolean).forEach(line => {
    const parts = line.split("\t");
    if (parts.length < 3) return;
    const [a, d, file] = parts;
    // filter paths by allow/forbid (simple matcher good for your patterns)
    if (!isAllowed(file, cfg.allowPaths, cfg.forbidPaths)) return;

    const ai = a === "-" ? 0 : parseInt(a, 10);
    const di = d === "-" ? 0 : parseInt(d, 10);
    const add = Number.isFinite(ai) ? ai : 0;
    const del = Number.isFinite(di) ? di : 0;

    added += add;
    deleted += del;
    details.push({ file, a: add, d: del });
  });

  const total = added + deleted;
  console.log(`[patch-guard] Diff vs origin/main (filtered): +${added} / -${deleted} = ${total} lines (budget: ${cfg.maxChangedLines})`);

  if (total > cfg.maxChangedLines) {
    console.error(`[patch-guard] ❌ Over budget by ${total - cfg.maxChangedLines} lines. Top changed files:`);
    details.sort((x, y) => y.a + y.d - (x.a + x.d)).slice(0, 10).forEach(r => {
      console.error(`  ${r.file}: +${r.a} -${r.d} = ${r.a + r.d}`);
    });
    process.exit(1);
  }

  console.log("[patch-guard] ✅ Within budget");
}

main();
