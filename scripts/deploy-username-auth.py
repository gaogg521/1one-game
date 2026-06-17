#!/usr/bin/env python3
"""Hot-deploy username auth to production server."""
from __future__ import annotations

import os
import re
import sys

import paramiko

HOST = os.environ.get("OPERONE_DEPLOY_HOST", "43.163.105.71")
USER = os.environ.get("OPERONE_DEPLOY_USER", "root")
REMOTE = "/opt/operone"
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

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
UPLOAD_REL += [f"src/messages/{f}" for f in os.listdir(os.path.join(REPO, "src/messages")) if f.endswith(".json")]


def password() -> str:
    pw = os.environ.get("OPERONE_DEPLOY_PASSWORD", "")
    if pw:
        return pw
    raw = open(os.path.join(REPO, "scripts/upload-literary-samples-to-server.py"), encoding="utf-8").read()
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M)
    return m.group(1) if m else ""


def run(client, cmd, timeout=3600):
    print("\n>>>", cmd[:160])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-5000:] if len(text) > 5000 else text)
    print(f"[exit {code}]")
    return code


def main() -> int:
    pw = password()
    if not pw:
        print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
        return 2

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, pw, timeout=30, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()

    for rel in UPLOAD_REL:
        local = os.path.join(REPO, rel.replace("/", os.sep))
        remote = f"{REMOTE}/{rel.replace(chr(92), '/')}"
        remote_dir = os.path.dirname(remote).replace("\\", "/")
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
        sftp.put(local, remote)
    sftp.close()

    cmds = [
        f"cd {REMOTE} && set -a && . ./.env && set +a && npx prisma migrate deploy",
        f"cd {REMOTE} && runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npx prisma generate && npm run build'",
        f"bash {REMOTE}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
        f"cd {REMOTE} && AUTH_TEST_BASE_URL=http://127.0.0.1:6666 runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npx tsx scripts/qa-username-auth.ts'",
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
