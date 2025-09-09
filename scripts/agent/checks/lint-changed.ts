// scripts/agent/checks/lint-changed.ts
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function sh(cmd: string): string {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

const ALLOWED_ROOTS = ["scripts/agent", "tests/agent"];
const isCodeFile = (f: string) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f);
const isInAllowedRoots = (f: string) => ALLOWED_ROOTS.some((r) => f === r || f.startsWith(`${r}/`));

function run() {
  let out = "";
  try {
    // With fetch-depth: 0 this works on CI and locally
    out = sh("git diff --name-only --diff-filter=ACMRTUXB origin/main...HEAD");
  } catch {
    // Fallback if origin/main is unavailable
    out = sh("git ls-files");
  }

  const changed = out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isCodeFile)
    .filter(isInAllowedRoots);

  let targets: string[] = [];

  if (changed.length > 0) {
    targets = changed;
    console.log("Linting agent-changed files:");
    for (const f of targets) console.log(f);
  } else {
    // Always lint only agent scope on fallback
    targets = ALLOWED_ROOTS.filter((p) => existsSync(p));
    console.log("No changed files; linting agent scope:", targets.join(", "));
  }

  if (targets.length === 0) {
    console.log("No lint targets; skipping.");
    return;
  }

  const cmd = "pnpm exec eslint " + targets.map((t) => JSON.stringify(t)).join(" ") + " --max-warnings=0";
  execSync(cmd, { stdio: "inherit" });
}

run();
