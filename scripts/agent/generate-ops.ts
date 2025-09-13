import fs from "node:fs";
import type { OpsPlan } from "./ops/apply-ops";
import { isOpsPlan } from "./ops/apply-ops";

type Plan = {
  chosen: {
    id: string;
    title: string;
    rationale: string;
    changeBudget: number;
    acceptance: string[];
    touches: string[];
  };
};
type AgentConfig = { maxChangedLines: number; allowPaths?: string[]; forbidPaths?: string[] };
type Ctx = { summary?: unknown; repoHints?: unknown };
type ChatMessage = { content?: string | null };
type ChatChoice = { message?: ChatMessage | null };
type ChatCompletion = { choices?: ChatChoice[] | null };

const PROMPT_PATH = ".agent/prompts/generate-ops.md";

function readJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return null; }
}
function readPrompt(): string | null {
  try { if (fs.existsSync(PROMPT_PATH)) return fs.readFileSync(PROMPT_PATH, "utf8"); } catch {}
  return null;
}
function stripCodeFence(s: string): string {
  const m = s.match(/```json\s*([\s\S]*?)```/i) ?? s.match(/```\s*([\s\S]*?)```/);
  return m ? m[1].trim() : s.trim();
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isChatCompletion(v: unknown): v is ChatCompletion {
  if (!isRecord(v)) return false;
  const choices = (v as { choices?: unknown }).choices;
  return Array.isArray(choices);
}

async function main() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.log("[gen-ops] No OPENAI_API_KEY; skipping ops generation (will fallback).");
    return;
  }

  const plan = readJson<Plan>(".agent/plan.json");
  const cfg = readJson<AgentConfig>(".agent/config.json");
  const ctx = readJson<Ctx>(".agent/context.json") ?? {};

  if (!plan || !cfg) {
    console.log("[gen-ops] Missing plan/config; skipping.");
    return;
  }

  const task = plan.chosen.title;
  const budget = Math.min(cfg.maxChangedLines, plan.chosen.changeBudget);
  const allow = cfg.allowPaths ?? ["src/**", "tests/**"];
  const forbid = cfg.forbidPaths ?? [];

  const filePrompt = readPrompt();
  const system = filePrompt
    ? `${filePrompt.trim()}\n\nImportant: Return ONLY a single JSON object that matches the OpsPlan schema. No prose, no code fences.`
    : [
        "You are Agent-Lite, a surgical code patcher.",
        "Return ONLY a compact JSON object that matches the OpsPlan schema (no prose, no code fences).",
        "Stay within the patch budget; avoid incidental churn and reformatting."
      ].join(" ");

  const userPayload = {
    intent: "Generate a tiny patch as an ops plan for the Edit Engine.",
    task,
    constraints: {
      patchBudgetLines: budget,
      maxChangedLines: cfg.maxChangedLines,
      allowPaths: allow,
      forbidPaths: forbid,
      rules: [
        "Prefer adding small new files over editing very large files.",
        "If editing a large file, isolate changes and avoid reformatting.",
        "Update/add tests when behavior changes.",
        "Keep ops minimal; no unrelated edits."
      ]
    },
    plan: plan.chosen,
    context: {
      summary: ctx.summary ?? null,
      repoHints: ctx.repoHints ?? null
    },
    schema: {
      id: "string",
      acceptance: "string[] (optional)",
      ops: [
        { op: "insertAfter", file: "string", anchor: "string", text: "string" },
        { op: "replaceBlock", file: "string", begin: "string", end: "string", text: "string" },
        {
          op: "addImport",
          file: "string",
          spec: { from: "string", names: "string[] (optional)", default: "string (optional)", typeOnly: "boolean (optional)" }
        },
        { op: "addTest", file: "string", text: "string" }
      ]
    }
  };

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5";
  const url = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1/chat/completions";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) }
        ],
        temperature: 1,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.log(`[gen-ops] OpenAI error ${res.status}: ${txt.slice(0, 400)}`);
      return;
    }

    const data: unknown = await res.json();
    if (!isChatCompletion(data)) {
      console.log("[gen-ops] Unexpected completion shape; skipping.");
      return;
    }

    const first = data.choices?.[0];
    const content = first?.message?.content ?? "";
    if (!content || typeof content !== "string") {
      console.log("[gen-ops] Empty completion content; skipping.");
      return;
    }

    const raw = stripCodeFence(content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.log("[gen-ops] Non-JSON response; skipping.");
      return;
    }

    if (!isOpsPlan(parsed)) {
      console.log("[gen-ops] Response failed schema check; skipping.");
      return;
    }

    const out = parsed; // narrowed by isOpsPlan
    fs.writeFileSync(".agent/ops.json", JSON.stringify(out as OpsPlan, null, 2));
    console.log(`[gen-ops] Wrote .agent/ops.json with ${(out as OpsPlan).ops.length} ops.`);
  } catch (e) {
    console.log(`[gen-ops] Request failed: ${(e as Error).message}`);
  }
}

void main();
