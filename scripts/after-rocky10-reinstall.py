#!/usr/bin/env python3
"""Post Rocky 10 reinstall: restore backup + deploy latest code + verify.

Prerequisites:
  - Fresh install.sh completed on server (same IP is fine)
  - scripts/deploy.local.env configured (same host if same machine)
  - backups/operone-migrate-*.tgz from prepare-prod-migration.py

Usage:
  python scripts/after-rocky10-reinstall.py
  python scripts/after-rocky10-reinstall.py --bundle backups/operone-migrate-20260622.tgz
  python scripts/after-rocky10-reinstall.py --skip-deploy
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
STATE_FILE = ROOT / "backups" / "LAST_MIGRATION.json"


def latest_bundle() -> Path | None:
    if STATE_FILE.is_file():
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            p = Path(data["bundle"])
            if p.is_file():
                return p
        except (json.JSONDecodeError, KeyError, OSError):
            pass
    backups = sorted((ROOT / "backups").glob("operone-migrate-*.tgz"), key=lambda p: p.stat().st_mtime, reverse=True)
    return backups[0] if backups else None


def run_step(label: str, script: str, extra: list[str] | None = None) -> int:
    cmd = [sys.executable, str(SCRIPTS / script)] + (extra or [])
    print(f"\n{'=' * 60}\n[{label}] {' '.join(cmd)}\n{'=' * 60}")
    return subprocess.call(cmd, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore and deploy after Rocky 10 reinstall")
    parser.add_argument("--bundle", type=Path, help="Migration .tgz (default: LAST_MIGRATION.json or newest)")
    parser.add_argument("--skip-deploy", action="store_true", help="Only restore, skip deploy-prod-with-assets")
    parser.add_argument("--skip-verify", action="store_true", help="Skip post-deploy verification scripts")
    args = parser.parse_args()

    bundle = args.bundle or latest_bundle()
    if not bundle or not bundle.is_file():
        print("No migration bundle found. Run prepare-prod-migration.py first.", file=sys.stderr)
        return 1

    print(f"Using bundle: {bundle} ({bundle.stat().st_size / 1024 / 1024:.1f} MB)")

    code = run_step("restore", "restore-prod-migration.py", ["--bundle", str(bundle.resolve())])
    if code != 0:
        return code

    if not args.skip_deploy:
        code = run_step("deploy", "deploy-prod-with-assets.py")
        if code != 0:
            return code

    if not args.skip_verify:
        for script in ("check-prod-literary-covers.py", "verify-prod-doudizhu.py"):
            run_step(f"verify {script}", script)

    sys.path.insert(0, str(SCRIPTS))
    from prod_ssh import site_url

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"  Site: {site_url()}")
    print("  Check: /api/health · /arcade · /novel/feed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
