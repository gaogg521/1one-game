#!/usr/bin/env python3
"""Git pull on production, rebuild, create bootstrap super_admin."""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run, site_url

BOOT_USER = os.environ.get("SUPER_ADMIN_BOOTSTRAP_USERNAME", "admin")
BOOT_EMAIL = os.environ.get("SUPER_ADMIN_BOOTSTRAP_EMAIL", "admin@example.com")
BOOT_PASS = os.environ.get("SUPER_ADMIN_BOOTSTRAP_PASSWORD") or secrets.token_hex(10)


def main() -> int:
    remote = deploy_repo()
    print_target("super admin bootstrap")
    client = connect()
    steps = [
        f"cd {remote} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        f"cd {remote} && runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npm run build'",
        f"bash {remote}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
        (
            f"cd {remote} && set -a && . ./.env && set +a && "
            f"SUPER_ADMIN_BOOTSTRAP_USERNAME={BOOT_USER} "
            f"SUPER_ADMIN_BOOTSTRAP_EMAIL={BOOT_EMAIL} "
            f"SUPER_ADMIN_BOOTSTRAP_PASSWORD='{BOOT_PASS}' "
            f"SUPER_ADMIN_BOOTSTRAP_FORCE=1 "
            f"runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npm run ensure:super-admin'"
        ),
    ]
    for cmd in steps:
        if run(client, cmd, timeout=7200) != 0:
            client.close()
            return 1
    client.close()
    print("\n" + "=" * 50)
    print(f"Console: {site_url()}/console")
    print(f"User:    {BOOT_USER}")
    print(f"Pass:    {BOOT_PASS}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
