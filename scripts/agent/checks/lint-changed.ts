// scripts/agent/checks/lint-changed.ts
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function sh(cmd: string): string {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function run() {
  // Try to diff against upstream main; fall back to all tracked files
  let out = "";
  try {
    out = sh("git diff --name-only --diff-filter=ACMRTUXB origin/main...HEAD");
  } catch {
    out = sh("git ls-files");
  }

  const changed = out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    // Code files only
    .filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f));

  let targets: string[] = [];

  if (changed.length > 0) {
    targets = changed;
    console.log("Linting changed files:");
    for (const f of targets) console.log(f);
  } else {
    // Fallback: lint our agent scripts and agent tests only (NOT .agent/)
    const fallbackRoots = ["scripts/agent", "tests/agent"];
    targets = fallbackRoots.filter((p) => existsSync(p));
    console.log("No changed files; linting fallback:", targets.join(", "));
  }

  if (targets.length === 0) {
    console.log("No lint targets; skipping.");
    return;
  }

  const cmd =
    "pnpm exec eslint " +
    targets.map((t) => JSON.stringify(t)).join(" ") +
    " --max-warnings=0";
  execSync(cmd, { stdio: "inherit" });
}

run();
