import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './utils/fsx';
import { createBranch, ensureCleanTree, stageAllAndCommit } from './utils/git';
import type { Plan } from './types';


function ts() { const d = new Date(); return d.toISOString().replace(/[-:]/g,'').slice(0,13).replace('T','-'); }


function main() {
ensureCleanTree();
const cfg = JSON.parse(fs.readFileSync('.agent/config.json','utf8')) as { branchPrefix: string };
const plan = JSON.parse(fs.readFileSync('.agent/plan.json','utf8')) as Plan;
const branch = `${cfg.branchPrefix}${plan.chosen.id}-${ts()}`;
createBranch(branch);


// Write a tiny TODO marker inside repo
const todoDir = path.join('src','agent');
ensureDir(todoDir);
const todoPath = path.join(todoDir, `TODO-${plan.chosen.id}.md`);
const body = `# ${plan.chosen.title}\n\nRationale: ${plan.chosen.rationale}\n\nAcceptance Criteria:\n${plan.chosen.acceptance.map(a=>`- ${a}`).join('\n')}\n`;
fs.writeFileSync(todoPath, body);


// Seed unit test (kept simple & passing)
const testDir = path.join('tests','agent');
ensureDir(testDir);
fs.writeFileSync(path.join(testDir, 'smoke.test.ts'), `import { describe, it, expect } from 'vitest';\n\ndescribe('agent smoke', () => {\n it('vitest is running', () => { expect(1+1).toBe(2); });\n});\n`);


// Guard test for patch size is in repo root tests (added below)


stageAllAndCommit(`chore(agent): seed for ${plan.chosen.title}`);
console.log('Branch prepared:', branch);
}


main();