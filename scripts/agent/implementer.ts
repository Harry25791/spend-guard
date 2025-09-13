import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir } from './utils/fsx';
import { createBranch, ensureCleanTreeOrAutostash, stageAllAndCommit, hasChanges } from './utils/git';
import type { Plan } from './types';

function ts() {
  const d = new Date();
  // YYYYMMDD-HHmm (safer uniqueness than just hour)
  return d.toISOString().replace(/[-:]/g,'').slice(0,13).replace('T','-') + d.toISOString().slice(14,16);
}

function main() {
  ensureCleanTreeOrAutostash();

  // ── self-heal derived artifacts on fresh checkouts ───────────────────────────
  try {
    if (!fs.existsSync('.agent/context.json')) {
      console.log('[agent] No .agent/context.json → building…');
      execSync('pnpm -s agent:context', { stdio: 'inherit' });
    }
    if (!fs.existsSync('.agent/plan.json')) {
      console.log('[agent] No .agent/plan.json → planning…');
      execSync('pnpm -s agent:plan', { stdio: 'inherit' });
    }
  } catch (_e) {
    console.error('[agent] Failed to generate .agent/context.json or .agent/plan.json');
    process.exit(1);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const cfg = JSON.parse(fs.readFileSync('.agent/config.json','utf8')) as { branchPrefix: string };
  const plan = JSON.parse(fs.readFileSync('.agent/plan.json','utf8')) as Plan;

  const stamp = ts();
  const branch = `${cfg.branchPrefix}${plan.chosen.id}-${stamp}`;
  createBranch(branch);

  // Write a tiny TODO marker (unique filename)
  const todoDir = path.join('src','agent');
  ensureDir(todoDir);
  const todoPath = path.join(todoDir, `TODO-${plan.chosen.id}-${stamp}.md`);
  const body = `# ${plan.chosen.title}\n\nRationale: ${plan.chosen.rationale}\n\nAcceptance Criteria:\n${plan.chosen.acceptance.map(a=>`- ${a}`).join('\n')}\n`;
  fs.writeFileSync(todoPath, body);

  // Seed unit test (unique filename)
  const testDir = path.join('tests','agent');
  ensureDir(testDir);
  const smokePath = path.join(testDir, `smoke-${stamp}.test.ts`);
  fs.writeFileSync(smokePath, `import { describe, it, expect } from 'vitest';\n\ndescribe('agent smoke ${stamp}', () => {\n  it('vitest is running', () => { expect(1+1).toBe(2); });\n});\n`);

  // If, for any reason, no diff is detected, append a heartbeat line to the TODO
  if (!hasChanges()) {
    fs.appendFileSync(todoPath, `\n- Heartbeat: ${new Date().toISOString()}\n`);
  }

  stageAllAndCommit(`chore(agent): seed for ${plan.chosen.title}`);
  console.log('Branch prepared:', branch);
  console.log('Wrote:', todoPath, 'and', smokePath);
}

main();
