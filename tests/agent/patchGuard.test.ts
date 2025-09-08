import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';


function linesAgainstMain() {
try { execSync('git fetch --depth=1 origin main', { stdio: 'ignore' }); } catch {}
const out = execSync('git diff --numstat origin/main...',{stdio:'pipe'}).toString();
return out.trim().split('\n').filter(Boolean).reduce((acc, line) => {
const [a, r] = line.split(/\s+/);
return acc + (isNaN(+a)||isNaN(+r) ? 0 : (+a + +r));
}, 0);
}


describe('patch guard', () => {
it('stays within .agent/config.json.maxChangedLines', () => {
const cfg = JSON.parse(require('fs').readFileSync('.agent/config.json','utf8'));
const total = linesAgainstMain();
expect(total).toBeLessThanOrEqual(cfg.maxChangedLines);
});
});