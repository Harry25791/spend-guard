// scripts/agent/planner.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

type PlanStep = {
  id: string;
  title: string;
  rationale: string;
  changeBudget: number;
  acceptance: string[];
  touches: string[];
};

type AgentConfig = {
  maxChangedLines: number;
  planner?: {
    defaultChangeBudget?: number;
  };
};

function readJson<T>(p: string): T {
  const raw = readFileSync(p, "utf8");
  // We type this as unknown to avoid 'any' and unsafe assignments
  return JSON.parse(raw) as unknown as T;
}

function sanitizeId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultTaskFromRoadmap(): string {
  // Small, safe heuristic: first unchecked item ("- [ ] ...") in ROADMAP.md
  try {
    const raw = readFileSync("ROADMAP.md", "utf8");
    const line = raw.split("\n").find((l) => /^\s*-\s*\[\s\]\s+/.test(l));
    if (line) return line.replace(/^\s*-\s*\[\s\]\s+/, "").trim();
  } catch {
    // ignore
  }
  return "Create initial agent seed test and TODO";
}

function main() {
  // Config (if present)
  let changeBudget = 400;
  try {
    const cfg = readJson<AgentConfig>(".agent/config.json");
    if (typeof cfg?.planner?.defaultChangeBudget === "number" && cfg.planner.defaultChangeBudget > 0) {
      changeBudget = cfg.planner.defaultChangeBudget;
    }
  } catch {
    // optional; default stands
  }

  const inputTask = (process.env.AGENT_TASK ?? "").trim();
  const task = inputTask.length > 0 ? inputTask : defaultTaskFromRoadmap();

  const step: PlanStep = {
    id: sanitizeId(task.startsWith("Create ") ? task : `Create ${task}`),
    title: task,
    rationale: "Smallest available task from ROADMAP.md to keep PRs safe and reviewable.",
    changeBudget,
    acceptance: [
      "Given repo is installed, When running pnpm test:unit, Then tests pass",
      "Patch size stays within config.maxChangedLines",
    ],
    touches: ["src/**", "tests/**"],
  };

  // Keep legacy-style logging that tests/eyes expect
  console.log("Planned step:", step);
}

main();
