#!/usr/bin/env python3
"""Pre-migration checklist: validate SSH config, test connection, backup production.

Run BEFORE reinstalling the OS on the production server.

Usage (repo root):
  python scripts/prepare-prod-migration.py
  python scripts/prepare-prod-migration.py --include-tools

Requires scripts/deploy.local.env (copy from deploy.local.env.example).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
LOCAL_ENV = SCRIPTS / "deploy.local.env"
EXAMPLE_ENV = SCRIPTS / "deploy.local.env.example"
BACKUPS = ROOT / "backups"
STATE_FILE = BACKUPS / "LAST_MIGRATION.json"


def fail(msg: str, code: int = 1) -> int:
    print(f"\n[FAIL] {msg}", file=sys.stderr)
    return code


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def check_python() -> int:
    ok(f"Python {sys.version.split()[0]}")
    try:
        import paramiko  # noqa: F401

        ok("paramiko installed")
    except ImportError:
        return fail("pip install paramiko")
    return 0


def check_local_env() -> int:
    if not LOCAL_ENV.is_file():
        print(f"\nMissing {LOCAL_ENV}")
        print(f"  copy {EXAMPLE_ENV.name} -> deploy.local.env and fill in values")
        return fail("deploy.local.env not found")
    lines = LOCAL_ENV.read_text(encoding="utf-8").splitlines()
    keys: dict[str, str] = {}
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        keys[k.strip()] = v.strip().strip('"').strip("'")
    host = keys.get("OPERONE_DEPLOY_HOST", "")
    password = keys.get("OPERONE_DEPLOY_PASSWORD", "")
    key_path = keys.get("OPERONE_DEPLOY_KEY_PATH", "")
    if not host or host.startswith("your."):
        return fail("OPERONE_DEPLOY_HOST not set in deploy.local.env")
    if not password and not key_path:
        return fail("Set OPERONE_DEPLOY_PASSWORD or OPERONE_DEPLOY_KEY_PATH in deploy.local.env")
    ok(f"deploy.local.env → host={host}")
    return 0


def check_ssh_and_health() -> int:
    sys.path.insert(0, str(SCRIPTS))
    from prod_ssh import connect, deploy_app_port, deploy_host, deploy_user, print_target, run_output

    print_target("preflight")
    try:
        client = connect(timeout=20)
    except Exception as exc:
        return fail(f"SSH connect: {exc}")
    ok(f"SSH {deploy_user()}@{deploy_host()}")

    port = deploy_app_port()
    code, text = run_output(client, f"curl -sf --max-time 15 http://127.0.0.1:{port}/api/health || true", timeout=30)
    client.close()
    if code == 0 and ("ok" in text.lower() or '"ok"' in text):
        ok(f"production health on port {port}")
    else:
        print(f"[WARN] health check inconclusive (exit {code}); continuing backup anyway")
        if text:
            print(text[:500])
    return 0


def run_backup(include_tools: bool) -> tuple[int, Path | None]:
    cmd = [sys.executable, str(SCRIPTS / "backup-prod-for-migration.py")]
    if include_tools:
        cmd.append("--include-tools")
    print("\n" + "=" * 60 + "\nRunning backup...\n" + "=" * 60)
    proc = subprocess.run(cmd, cwd=ROOT)
    if proc.returncode != 0:
        return proc.returncode, None
    bundles = sorted(BACKUPS.glob("operone-migrate-*.tgz"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not bundles:
        return fail("backup finished but no operone-migrate-*.tgz in backups/"), None
    return 0, bundles[0]


def write_state(bundle: Path, include_tools: bool) -> None:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    state = {
        "preparedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "bundle": str(bundle.resolve()),
        "bundleSizeMb": round(bundle.stat().st_size / 1024 / 1024, 2),
        "includeTools": include_tools,
        "nextAfterReinstall": [
            "curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash",
            f"python scripts/after-rocky10-reinstall.py --bundle {bundle.name}",
        ],
    }
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ok(f"state saved → {STATE_FILE}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare production backup before OS reinstall")
    parser.add_argument("--include-tools", action="store_true", help="Include Godot tools/ in backup (larger)")
    parser.add_argument("--skip-backup", action="store_true", help="Only run preflight checks")
    args = parser.parse_args()

    print("=" * 60)
    print("Operone migration prep (before Rocky 10 reinstall)")
    print("=" * 60)

    for step in (check_python, check_local_env):
        if step() != 0:
            return 1

    if check_ssh_and_health() != 0:
        return 1

    if args.skip_backup:
        print("\n[SKIP] --skip-backup; preflight only")
        return 0

    code, bundle = run_backup(args.include_tools)
    if code != 0 or bundle is None:
        return code or 1

    write_state(bundle, args.include_tools)
    print("\n" + "=" * 60)
    print("READY FOR OS REINSTALL")
    print("=" * 60)
    print(f"  Backup: {bundle}")
    print(f"  Size:   {bundle.stat().st_size / 1024 / 1024:.1f} MB")
    print("\nYou may reinstall Rocky 10 now.")
    print("After install.sh on the new system, run:")
    print(f"  python scripts/after-rocky10-reinstall.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
