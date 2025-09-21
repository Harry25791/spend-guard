# Usage:
#   .\tools\spend-apply-bundle.ps1 .\bundle-XX.json
#   .\tools\spend-apply-bundle.ps1 .\bundle.json --dry-run
#   .\tools\spend-apply-bundle.ps1 .\bundle.json --no-commit --post "pnpm fmt && pnpm typecheck"

param(
  [Parameter(Mandatory=$true)][string]$BundlePath,
  [switch]$dry_run,
  [switch]$no_commit,
  [string]$post
)

$ErrorActionPreference = "Stop"

# Ensure Python is available
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  $python = Get-Command python3 -ErrorAction SilentlyContinue
}
if (-not $python) {
  Write-Error "Python not found. Install Python 3 and ensure it's on PATH."
}

$flags = @()
if ($dry_run)   { $flags += "--dry-run" }
if ($no_commit) { $flags += "--no-commit" }
if ($post)      { $flags += @("--post", $post) }

# Resolve repo-root relative path to script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Py = Join-Path $ScriptDir "spend-apply-bundle.py"

& $python.Path $Py $BundlePath @flags
