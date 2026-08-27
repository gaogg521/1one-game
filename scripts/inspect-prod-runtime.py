#!/usr/bin/env python3
"""Read-only production snapshot: health, commit, services, model routes (no secrets)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prod_ssh import connect, deploy_repo, local_health_check_command, print_target, run_output, shell_source_env

DUMP_SCRIPT = Path(__file__).with_name("inspect-prod-runtime-dump.ts")


def main() -> int:
    print_target("inspect production runtime")
    client = connect()
    repo = deploy_repo()
    checks = []

    code, health = run_output(client, local_health_check_command(), timeout=30)
    checks.append(("health", code == 0, health[-400:]))

    code, commit = run_output(client, f"git -C {repo} log -1 --oneline && git -C {repo} status -sb", timeout=30)
    checks.append(("git", code == 0, commit[-400:]))

    code, units = run_output(
        client,
        "systemctl is-active operone operone-generation-worker.timer nginx; "
        "systemctl show operone-generation-worker.timer -p ActiveState -p LastTriggerUSec --no-pager",
        timeout=30,
    )
    checks.append(("services", code == 0, units[-400:]))

    dump_path = f"{repo}/scripts/_inspect-prod-runtime-dump.ts"
    sftp = client.open_sftp()
    sftp.put(str(DUMP_SCRIPT), dump_path)
    sftp.close()
    code, routes = run_output(
        client,
        f"{shell_source_env(repo)} && cd {repo} && npx --yes tsx {dump_path}; rm -f {dump_path}",
        timeout=180,
    )
    checks.append(("runtime_routes", code == 0, routes[-6000:]))

    print("\n=== summary ===")
    failed = 0
    for name, ok, _ in checks:
        print(f"{'OK' if ok else 'FAIL'} {name}")
        if not ok:
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
