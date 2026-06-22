#!/usr/bin/env python3
"""
Full production deploy: code on server + local runtime assets sync.

Order:
  1. deploy-prod-cee8b1d.py   — git pull, migrate, build, seed:samples, restart
  2. sync-sample-assets-to-prod.py — public/game-sprites|game-bg sample-*
  3. sync-literary-covers-to-prod.py — public/covers/* referenced by prod Novel/Comic DB

Run from repo root on a machine that has local public/ assets (typically dev laptop).

Target: OPERONE_DEPLOY_HOST (see docs/server-migration.md).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PY = sys.executable

STEPS = [
    ("deploy code", ROOT / "deploy-prod-cee8b1d.py"),
    ("sync sample sprites/bg", ROOT / "sync-sample-assets-to-prod.py"),
    ("sync novel/comic covers", ROOT / "sync-literary-covers-to-prod.py"),
]


def main() -> int:
    for label, script in STEPS:
        print(f"\n{'=' * 60}\n[{label}] {script.name}\n{'=' * 60}")
        code = subprocess.call([PY, str(script)], cwd=ROOT.parent)
        if code != 0:
            print(f"\nFAILED at: {label} (exit {code})")
            return code
    print("\nDEPLOY_FULL_OK — code + sample assets + literary covers")
    print("Optional verify: python scripts/check-prod-literary-covers.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
