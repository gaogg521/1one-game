#!/usr/bin/env python3
"""Hot-deploy username auth to production server."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run

REPO = Path(__file__).resolve().parent.parent

UPLOAD_REL = [
    "prisma/schema.prisma",
    "prisma/migrations/20260615100000_username_auth/migration.sql",
    "src/lib/auth/username.ts",
    "src/lib/auth/username-auth.ts",
    "src/lib/auth/types.ts",
    "src/lib/auth/user.ts",
    "src/app/api/auth/register/username/route.ts",
    "src/app/api/auth/login/username/route.ts",
    "src/app/api/auth/session/route.ts",
    "src/app/login/page.tsx",
    "src/app/register/page.tsx",
    "scripts/qa-username-auth.ts",
    "scripts/deploy/Dockerfile.godot",
    "scripts/deploy-prod-smoke-test.py",
]
UPLOAD_REL += [f"src/messages/{f.name}" for f in (REPO / "src/messages").glob("*.json")]


def main() -> int:
    remote = deploy_repo()
    port = deploy_app_port()
    print_target("username auth deploy")
    client = connect()
    sftp = client.open_sftp()

    for rel in UPLOAD_REL:
        local = REPO / rel
        remote_path = f"{remote}/{rel.replace(chr(92), '/')}"
        remote_dir = str(Path(remote_path).parent).replace("\\", "/")
        parts = remote_dir.split("/")
        cur = ""
        for p in parts:
            if not p:
                continue
            cur += "/" + p
            try:
                sftp.stat(cur)
            except OSError:
                sftp.mkdir(cur)
        print("upload", rel)
        sftp.put(str(local), remote_path)
    sftp.close()

    cmds = [
        f"cd {remote} && set -a && . ./.env && set +a && npx prisma migrate deploy",
        f"cd {remote} && runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npx prisma generate && npm run build'",
        f"bash {remote}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
        (
            f"cd {remote} && AUTH_TEST_BASE_URL=http://127.0.0.1:{port} runuser -u www-data -- bash -lc "
            f"'export PATH=/usr/local/bin:/usr/bin:$PATH; npx tsx scripts/qa-username-auth.ts'"
        ),
    ]
    for cmd in cmds:
        if run(client, cmd, timeout=7200) != 0:
            client.close()
            return 1

    client.close()
    print("\n[DONE] username auth deployed + QA passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
