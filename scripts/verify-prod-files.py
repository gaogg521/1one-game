#!/usr/bin/env python3
"""Verify production has expected files from commit."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run_output


def main() -> int:
    repo = deploy_repo()
    print_target("verify files")
    client = connect()
    checks = [
        ("git log -1 --oneline", "commit"),
        ("test -f CONTEXT.md && wc -c < CONTEXT.md || echo MISSING", "CONTEXT.md bytes"),
        ("test -f src/components/CreateQuickStart.tsx && echo OK || echo MISSING", "CreateQuickStart"),
        ("git ls-files public/ 2>/dev/null | wc -l", "tracked public count"),
        ("ls public/samples 2>/dev/null | wc -l", "samples dir count"),
    ]
    print(f"REPO={repo}\n")
    for cmd, label in checks:
        out, code = run_output(client, f"cd {repo} && {cmd}")
        print(f"{label}: {out} [exit {code}]")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
