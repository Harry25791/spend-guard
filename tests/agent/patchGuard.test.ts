import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function sh(cmd: string): string {
  try { return execSync(cmd, { stdio: 'pipe' }).toString().trim(); }
  catch { return ''; }
}

// Pick a reasonable base for diff:
// - CI PR: GITHUB_BASE_REF (diff all changes since branching)
// - If upstream exists: use it
// - Local fallback: previous commit (HEAD~1) to bound the latest change
function resolveBase(): { ref: string; tripleDot: boolean } {
  const prBase = process.env.GITHUB_BASE_REF || process.env.AGENT_BASE_REF;
  if (prBase) {
    // Ensure we have the base locally and use triple-dot (merge-base diff)
    sh(`git fetch --depth=1 origin ${prBase}`);
    return { ref: `origin/${prBase}`, tripleDot: true };
  }

  const upstream = sh('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}');
  if (upstream) {
    // Compare against upstream merge-base
    const [remote, ...branchParts] = upstream.split('/');
    const branch = branchParts.join('/');
    if (remote && branch) sh(`git fetch --depth=1 ${remote} ${branch}`);
    return { ref: upstream, tripleDot: true };
  }

  const count = parseInt(sh('git rev-list --count HEAD') || '0', 10);
  if (count > 0) return { ref: 'HEAD~1', tripleDot: false };

  return { ref: 'HEAD', tripleDot: false };
}

function linesChanged(baseRef: string, tripleDot: boolean): number {
  const sep = tripleDot ? '...' : '..';
  const out = sh(`git diff --numstat ${baseRef}${sep}HEAD`);
  return out
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
      const [a, r] = line.trim().split(/\s+/);
      const na = Number(a), nr = Number(r);
      return acc + (Number.isFinite(na) ? na : 0) + (Number.isFinite(nr) ? nr : 0);
    }, 0);
}

describe('patch guard', () => {
  it('stays within .agent/config.json.maxChangedLines', () => {
    const cfg = JSON.parse(fs.readFileSync('.agent/config.json', 'utf8'));
    const { ref, tripleDot } = resolveBase();
    const total = linesChanged(ref, tripleDot);
    expect(total).toBeLessThanOrEqual(cfg.maxChangedLines);
  });
});
