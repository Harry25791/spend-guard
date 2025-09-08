import { execSync } from 'node:child_process';

const sh = (cmd: string) => execSync(cmd, { stdio: 'pipe' }).toString().trim();

export function currentBranch() {
  return sh('git rev-parse --abbrev-ref HEAD');
}

export function ensureCleanTreeOrAutostash() {
  // ignore untracked; only care about tracked modifications
  const dirty = sh('git status --porcelain --untracked-files=no');
  if (!dirty) return;
  execSync('git stash push -m "ai-agent-lite autostash (tracked only)"', { stdio: 'inherit' });
}

export function createBranch(name: string) {
  sh(`git checkout -b ${name}`);
}

export function hasChanges() {
  return !!sh('git status --porcelain');
}

export function stageAllAndCommit(message: string) {
  sh('git add -A');
  // If STILL nothing to commit, create an allow-empty commit so the PR can open
  try {
    sh(`git commit -m ${JSON.stringify(message)}`);
  } catch {
    sh(`git commit --allow-empty -m ${JSON.stringify(message + ' (empty)')}`);
  }
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
