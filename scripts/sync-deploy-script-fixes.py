#!/usr/bin/env python3
"""Upload fixed deploy scripts to production and apply pending migrations."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, ensure_git_safe, print_target, run, run_output, shell_source_env

ROOT = Path(__file__).resolve().parent.parent

UPLOAD = [
    "scripts/deploy/install.sh",
    "scripts/deploy/linux-ubuntu22-full.sh",
    "scripts/deploy/lib/os-lib.sh",
    "scripts/deploy/lib/ubuntu-deploy-lib.sh",
    "prisma/migrations/20260622120000_project_bgm_notes/migration.sql",
]


def main() -> int:
    repo = deploy_repo()
    print_target("sync deploy script fixes")
    client = connect()
    ensure_git_safe(client, repo)
    sftp = client.open_sftp()
    for rel in UPLOAD:
        local = ROOT / rel
        remote = f"{repo}/{rel.replace(chr(92), '/')}"
        remote_dir = str(Path(remote).parent).replace("\\", "/")
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
        print(f"upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    env = shell_source_env(repo)
    for cmd in (
        f"cd {repo} && {env} && npx prisma migrate deploy",
        "systemctl restart operone",
        "sleep 5",
        "curl -sf http://127.0.0.1:80/api/health",
    ):
        code = run(client, cmd, timeout=600)
        if code != 0:
            client.close()
            return code

    client.close()
    print("SYNC_DEPLOY_SCRIPTS_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
