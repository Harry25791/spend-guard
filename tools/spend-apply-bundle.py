#!/usr/bin/env python3
import json, base64, os, sys, pathlib, subprocess, shlex

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]

def die(msg: str, code: int = 1):
    print(f"[bundle] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def is_safe_path(p: pathlib.Path) -> bool:
    try:
        # Must be relative, no drive, no absolute
        if p.is_absolute() or p.drive:
            return False
        # No parent escapes
        rp = (REPO_ROOT / p).resolve()
        return str(rp).startswith(str(REPO_ROOT))
    except Exception:
        return False

def write_file(path: pathlib.Path, content_b64: str):
    data = base64.b64decode(content_b64)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print(f"[bundle] wrote {path.as_posix()} ({len(data)} bytes)")

def run_cmd(cmd: str, check=True):
    print(f"[bundle] run: {cmd}")
    res = subprocess.run(cmd, shell=True)
    if check and res.returncode != 0:
        die(f"command failed: {cmd} (exit {res.returncode})", res.returncode)

def main():
    # Usage
    if len(sys.argv) < 2:
        print("Usage: python tools/spend-apply-bundle.py <bundle.json> [--dry-run] [--no-commit] [--post \"pnpm fmt && pnpm typecheck\"]")
        sys.exit(1)

    bundle_path = pathlib.Path(sys.argv[1])
    flags = sys.argv[2:]

    dry_run = "--dry-run" in flags
    no_commit = "--no-commit" in flags

    # Parse --post "..."; everything after --post is the command string
    post_cmd = None
    if "--post" in flags:
        i = flags.index("--post")
        if i + 1 >= len(flags):
            die("--post provided without a command string")
        post_cmd = flags[i + 1]

    # Load bundle
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except Exception as e:
        die(f"failed to read bundle json: {e}")

    message = bundle.get("message") or "apply bundle"
    files = bundle.get("files", [])
    remove = bundle.get("remove", [])

    # Basic schema checks
    if not isinstance(files, list) or not all(isinstance(x, dict) for x in files):
        die("bundle.files must be a list of {path, content_b64}")
    if not isinstance(remove, list) or not all(isinstance(x, str) for x in remove):
        die("bundle.remove must be a list of strings")

    # Validate paths and preview actions
    for r in remove:
        rp = pathlib.Path(r)
        if not is_safe_path(rp):
            die(f"unsafe remove path: {r}")
        if rp.exists() and rp.is_dir():
            print(f"[bundle] NOTE: will not recursively delete directory: {r} (skipped)")

    for item in files:
        if "path" not in item or "content_b64" not in item:
            die("each files[] item must have 'path' and 'content_b64'")
        p = pathlib.Path(item["path"])
        if not is_safe_path(p):
            die(f"unsafe file path: {item['path']}")

    print(f"[bundle] bundle: {bundle_path.name}")
    print(f"[bundle] message: {message}")
    print(f"[bundle] files: {len(files)}  remove: {len(remove)}")
    if dry_run:
        print("[bundle] DRY RUN — no writes/commits will occur")

    # Apply removals
    for r in remove:
        p = pathlib.Path(r)
        if not p.exists():
            print(f"[bundle] remove (skip missing): {r}")
            continue
        if p.is_file():
            if not dry_run:
                p.unlink()
            print(f"[bundle] removed file: {r}")
        else:
            print(f"[bundle] skip dir removal: {r}")

    # Write files
    for item in files:
        p = pathlib.Path(item["path"])
        if not dry_run:
            write_file(p, item["content_b64"])
        else:
            print(f"[bundle] would write {p.as_posix()}")

    # Stage + commit
    if not dry_run:
        run_cmd("git add -A")
        if not no_commit:
            # Use -F to avoid quoting issues in commit messages
            temp_msg = REPO_ROOT / ".bundle-commit-msg.txt"
            temp_msg.write_text(message, encoding="utf-8")
            try:
                run_cmd(f'git commit -F "{temp_msg.as_posix()}"')
            finally:
                try:
                    temp_msg.unlink()
                except Exception:
                    pass
        else:
            print("[bundle] no-commit mode: staged but not committed")

    # Optional post steps (format, typecheck, tests…)
    if post_cmd:
        run_cmd(post_cmd, check=True)

    print("\n[bundle] DONE")
    if not dry_run and not no_commit:
        print(f"[bundle] committed: {message}")

if __name__ == "__main__":
    main()
