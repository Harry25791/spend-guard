// scripts/agent/utils/git.ts
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  // Prefer modern switch; fall back to checkout for older Git
  try {
    sh(`git switch -c "${name}"`);
  } catch {
    sh(`git checkout -b "${name}"`);
  }
}

export function hasChanges() {
  return !!sh('git status --porcelain');
}

export function stageAllAndCommit(message: string) {
  sh('git add -A');

  // Write commit message to a temp file to avoid shell-quoting issues (backticks, quotes, etc.)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-lite-'));
  const msgFile = path.join(tmpDir, 'COMMIT_MESSAGE.txt');

  try {
    fs.writeFileSync(msgFile, message, 'utf8');
    try {
      sh(`git commit -F "${msgFile}"`);
    } catch {
      // If STILL nothing to commit, create an allow-empty commit so the PR can open
      sh(`git commit --allow-empty -F "${msgFile}"`);
    }
  } finally {
    // Best-effort cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* no-op */
    }
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
