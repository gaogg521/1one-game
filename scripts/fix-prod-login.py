#!/usr/bin/env python3
"""Fix prod login: patch linkOwnerKey, rebuild, reset super_admin password."""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run, site_url

REPO_ROOT = Path(__file__).resolve().parent.parent
BOOT_USER = os.environ.get("SUPER_ADMIN_BOOTSTRAP_USERNAME", "admin")
BOOT_EMAIL = os.environ.get("SUPER_ADMIN_BOOTSTRAP_EMAIL", "admin@example.com")
BOOT_PASS = os.environ.get("SUPER_ADMIN_BOOTSTRAP_PASSWORD") or secrets.token_hex(10)


def main() -> int:
    remote = deploy_repo()
    port = deploy_app_port()
    client = connect()
    sftp = client.open_sftp()
    for local_rel in ("src/lib/auth/user.ts", "src/app/login/page.tsx"):
        sftp.put(str(REPO_ROOT / local_rel), f"{remote}/{local_rel}")
        print("uploaded", local_rel)
    sftp.close()

    steps = [
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
        (
            f"curl -sS -m 15 -w '\\nHTTP:%{{http_code}}\\n' -X POST http://127.0.0.1:{port}/api/auth/login "
            "-H 'Content-Type: application/json' "
            f"-d '{{\"account\":\"{BOOT_USER}\",\"password\":\"{BOOT_PASS}\"}}'"
        ),
    ]
    for cmd in steps:
        if run(client, cmd) != 0:
            client.close()
            return 1
    client.close()
    print("\n" + "=" * 50)
    print(f"登录: {site_url()}/login")
    print(f"用户名: {BOOT_USER}")
    print(f"密码:   {BOOT_PASS}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
