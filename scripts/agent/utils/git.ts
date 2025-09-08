import { execSync } from 'node:child_process';


const sh = (cmd: string) => execSync(cmd, { stdio: 'pipe' }).toString().trim();


export function currentBranch() {
return sh('git rev-parse --abbrev-ref HEAD');
}
export function ensureCleanTree() {
const s = sh('git status --porcelain');
if (s) throw new Error('Working tree not clean. Commit or stash before running agent.');
}
export function createBranch(name: string) {
sh(`git checkout -b ${name}`);
}
export function stageAllAndCommit(message: string) {
sh('git add -A');
sh(`git commit -m ${JSON.stringify(message)}`);
}
export function changedLinesAgainst(baseRef = 'origin/main') {
try { sh('git fetch --depth=1 origin main'); } catch {}
const diff = sh(`git diff --numstat ${baseRef}...`);
let added = 0, removed = 0;
diff.split('\n').filter(Boolean).forEach(line => {
const [a, r] = line.split(/\s+/);
added += isNaN(+a) ? 0 : +a;
removed += isNaN(+r) ? 0 : +r;
});
return { added, removed, total: added + removed };
}