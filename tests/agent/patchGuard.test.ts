import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

type AgentConfig = { maxChangedLines: number };

function sh(cmd: string): string {
  try { return execSync(cmd, { stdio: 'pipe' }).toString().trim(); }
  catch { return ''; }
}

function isAgentConfig(x: unknown): x is AgentConfig {
  return typeof x === 'object'
    && x !== null
    && typeof (x as { maxChangedLines?: unknown }).maxChangedLines === 'number';
}

function readAgentConfig(): AgentConfig {
  const raw = fs.readFileSync('.agent/config.json', 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isAgentConfig(parsed)) {
    throw new Error('Invalid .agent/config.json: missing numeric maxChangedLines');
  }
  return parsed;
}

// Choose a sensible base for diff:
// - CI PRs: GITHUB_BASE_REF (merge-base diff)
// - Local with upstream: upstream (merge-base diff)
// - Local fallback: previous commit (HEAD~1)
function resolveBase(): { ref: string; tripleDot: boolean } {
  const prBase = process.env.GITHUB_BASE_REF || process.env.AGENT_BASE_REF;
  if (prBase) {
    sh(`git fetch --depth=1 origin ${prBase}`);
    return { ref: `origin/${prBase}`, tripleDot: true };
  }
  const upstream = sh('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}');
  if (upstream) {
    // fetch upstream if available (e.g., origin/main)
    const firstSlash = upstream.indexOf('/');
    if (firstSlash > 0) {
      const remote = upstream.slice(0, firstSlash);
      const branch = upstream.slice(firstSlash + 1);
      if (remote && branch) sh(`git fetch --depth=1 ${remote} ${branch}`);
    }
    return { ref: upstream, tripleDot: true };
  }
  const count = Number.parseInt(sh('git rev-list --count HEAD') || '0', 10);
  if (Number.isFinite(count) && count > 0) return { ref: 'HEAD~1', tripleDot: false };
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
      const add = Number.isFinite(na) ? na : 0;
      const rem = Number.isFinite(nr) ? nr : 0;
      return acc + add + rem;
    }, 0);
}

describe('patch guard', () => {
  it('stays within .agent/config.json.maxChangedLines', () => {
    const cfg = readAgentConfig();
    const { ref, tripleDot } = resolveBase();
    const total = linesChanged(ref, tripleDot);
    expect(total).toBeLessThanOrEqual(cfg.maxChangedLines);
  });
});
