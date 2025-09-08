import { execSync } from 'node:child_process';
import fs from 'node:fs';

function sh(cmd: string): string {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch {
    return '';
  }
}

function getChanged(): string[] {
  // Ensure we have the base to diff against
  sh('git fetch --depth=1 origin main');
  const out = sh('git diff --name-only --diff-filter=ACMRTUXB origin/main...');
  const files = out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx)$/.test(f));
  return Array.from(new Set(files));
}

function run(): void {
  const changed = getChanged();
  if (changed.length === 0) {
    // Fallback: lint agent code so CI still validates something useful
    const fallback = ['scripts/agent', '.agent', 'tests/agent'].filter((p) => fs.existsSync(p));
    if (fallback.length === 0) {
      console.log('No changed TS/TSX files; nothing to lint.');
      return;
    }
    console.log(`No changed files; linting fallback: ${fallback.join(', ')}`);
    execSync(`pnpm exec eslint ${fallback.join(' ')} --max-warnings=0`, { stdio: 'inherit' });
    return;
  }
  console.log(`Linting changed files:\n${changed.join('\n')}\n`);
  execSync(`pnpm exec eslint ${changed.join(' ')} --max-warnings=0`, { stdio: 'inherit' });
}

run();
