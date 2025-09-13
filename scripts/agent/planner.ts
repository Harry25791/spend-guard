// scripts/agent/planner.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

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
    fallbackTask?: string;
  };
};

function readJson<T>(p: string): T {
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as unknown as T;
}

function sanitizeId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function firstUncheckedFromRoadmap(): string | null {
  try {
    const raw = readFileSync("ROADMAP.md", "utf8");
    const line = raw.split("\n").find((l) => /^\s*-\s*\[\s\]\s+/.test(l));
    if (line) return line.replace(/^\s*-\s*\[\s\]\s+/, "").trim();
  } catch {
    // ignore
  }
  return null;
}

function main() {
  // Load optional config
  let cfg: AgentConfig | undefined;
  try {
    cfg = readJson<AgentConfig>(".agent/config.json");
  } catch {
    // proceed with safe defaults
  }

  const inputTask = (process.env.AGENT_TASK ?? "").trim();
  const fromRoadmap = firstUncheckedFromRoadmap();
  const fallbackTask =
    cfg?.planner?.fallbackTask ?? "Create initial agent seed test and TODO";

  const task = inputTask || fromRoadmap || fallbackTask;

  const changeBudget =
    (cfg?.planner?.defaultChangeBudget && cfg.planner.defaultChangeBudget > 0
      ? cfg.planner.defaultChangeBudget
      : Math.min(200, cfg?.maxChangedLines ?? 400));

  const step: PlanStep = {
    id: sanitizeId(task.startsWith("Create ") ? task : `Create ${task}`),
    title: task,
    rationale: inputTask
      ? "User-specified task via AGENT_TASK (workflow_dispatch input)."
      : fromRoadmap
      ? "Smallest available task from ROADMAP.md to keep PRs safe and reviewable."
      : "Fallback task from .agent/config.json planner.fallbackTask.",
    changeBudget,
    acceptance: [
      "Given repo is installed, When running pnpm test:unit, Then tests pass",
      "Patch size stays within config.maxChangedLines",
    ],
    touches: ["src/**", "tests/**"],
  };

  // Ensure .agent exists and write plan.json
  if (!existsSync(".agent")) mkdirSync(".agent", { recursive: true });
  const plan = { chosen: step, alternatives: [] as PlanStep[] };
  writeFileSync(".agent/plan.json", JSON.stringify(plan, null, 2));

  // Legacy-style log that tests expect
  console.log("Planned step:", step);
}

main();
