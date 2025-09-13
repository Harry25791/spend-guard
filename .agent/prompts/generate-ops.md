# Generate Ops Plan for Edit Engine (Agent-Lite)

## Task
Produce a **minimal, surgical** ops plan to implement the next tiny step of work. The plan must respect the patch budget and limit churn. Prefer small, tightly scoped changes that are easy to review.

## Context
You will receive a JSON payload (from the user message) containing:
- `task`: the natural-language description of the step
- `constraints.patchBudgetLines`, `constraints.allowPaths`, `constraints.forbidPaths`
- `plan`: the selected roadmap item, including `id`, `title`, `rationale`, `acceptance`, `touches`
- `context.summary` and `context.repoHints` (optional)

Use only the information provided. Do **not** invent files, APIs, or paths that are not referenced or obviously present. Keep diffs isolated to the smallest set of files under allowed paths.

## Constraints
- Hard budget: respect `constraints.patchBudgetLines` and avoid incidental reformatting.
- Only touch paths under `constraints.allowPaths`; **never** touch paths under `constraints.forbidPaths`.
- Keep edits idempotent where possible (anchors, replaceable blocks).
- Update/add tests when behavior changes.

## Rules
- Prefer **append-only** or block-bounded edits over broad rewrites.
- Avoid import reordering or unrelated code movement.
- Keep each op self-contained and executable by the Edit Engine.
- Allowed operations (strict):
  - `"insertAfter"` — `{ file, anchor, text }`
  - `"replaceBlock"` — `{ file, begin, end, text }`
  - `"addImport"` — `{ file, spec: { from, names?, default?, typeOnly? } }`
  - `"addTest"` — `{ file, text }`
- Limit the total number of ops to what’s necessary (aim ≤ 6).

## Output
Return **only** a single JSON object (no prose, no code fences) matching:

- `id`: string (stable identifier for this step; use `plan.id` if suitable)
- `acceptance`: string[] (optional) — Given/When/Then style
- `ops`: array of the allowed ops above, with valid shapes and only allowed fields

**Strict formatting requirements:**
- No comments, no trailing commas.
- Use **double quotes** for all JSON keys/strings.
- Do not include markdown code fences.

**Example shape (illustrative only):**
```json
{
  "id": "step-id",
  "acceptance": [
    "Given the repo is clean, When the ops are applied, Then the check suite passes"
  ],
  "ops": [
    {
      "op": "insertAfter",
      "file": "src/foo.ts",
      "anchor": "// [agent-keep] foo",
      "text": "export const bar = 1;"
    },
    {
      "op": "addTest",
      "file": "tests/foo.test.ts",
      "text": "import { describe, it, expect } from 'vitest';\ndescribe('foo', () => { it('works', () => { expect(1).toBe(1); }); });"
    }
  ]
}
