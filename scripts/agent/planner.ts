import fs from 'node:fs';
import { writeJSON } from './utils/fsx';
import type { Plan, PlanStep } from './types';


function parseTasks(md: string): string[] {
const lines = md.split(/\r?\n/);
return lines.filter(l => /- \[ \]\s+/.test(l)).map(l => l.replace(/^- \[ \]\s+/, '').trim());
}


function toId(title: string) {
return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
}


function planFromRoadmap(): PlanStep {
const cfg = JSON.parse(fs.readFileSync('.agent/config.json', 'utf8'));
const budget: number = cfg.planner?.defaultChangeBudget ?? 200;
let title = cfg.planner?.fallbackTask || 'Create initial agent seed test and TODO';
if (fs.existsSync('ROADMAP.md')) {
const raw = fs.readFileSync('ROADMAP.md', 'utf8');
const tasks = parseTasks(raw);
if (tasks.length) title = tasks[0];
}
return {
id: toId(title),
title,
rationale: 'Smallest available task from ROADMAP.md to keep PRs safe and reviewable.',
changeBudget: budget,
acceptance: [
'Given repo is installed, When running pnpm test:unit, Then tests pass',
'Patch size stays within config.maxChangedLines',
],
touches: ['src/**', 'tests/**']
};
}


function main() {
const chosen = planFromRoadmap();
const plan: Plan = { chosen, alternatives: [] };
writeJSON('.agent/plan.json', plan);
console.log('Planned step:', chosen);
}


main();