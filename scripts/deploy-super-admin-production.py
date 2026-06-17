#!/usr/bin/env python3
"""Git pull on production, rebuild, create bootstrap super_admin."""
from __future__ import annotations

import os
import re
import secrets
import sys

import paramiko

HOST = os.environ.get("OPERONE_DEPLOY_HOST", "43.163.105.71")
USER = os.environ.get("OPERONE_DEPLOY_USER", "root")
REMOTE = "/opt/operone"
BOOT_USER = os.environ.get("SUPER_ADMIN_BOOTSTRAP_USERNAME", "allenzhao")
BOOT_EMAIL = os.environ.get("SUPER_ADMIN_BOOTSTRAP_EMAIL", "allenzhao@huanle.com")
BOOT_PASS = os.environ.get("SUPER_ADMIN_BOOTSTRAP_PASSWORD") or secrets.token_hex(10)


def ssh_password() -> str:
    pw = os.environ.get("OPERONE_DEPLOY_PASSWORD", "")
    if pw:
        return pw
    repo = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    raw = open(os.path.join(repo, "scripts/upload-literary-samples-to-server.py"), encoding="utf-8").read()
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M)
    return m.group(1) if m else ""


def run(client, cmd, timeout=7200):
    print("\n>>>", cmd[:180])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-6000:] if len(text) > 6000 else text)
    print(f"[exit {code}]")
    return code, text


def main() -> int:
    pw = ssh_password()
    if not pw:
        print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
        return 2

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, pw, timeout=30, allow_agent=False, look_for_keys=False)

    steps = [
        f"cd {REMOTE} && git fetch origin && git reset --hard origin/main",
        f"cd {REMOTE} && set -a && . ./.env && set +a && npx prisma migrate deploy",
        f"cd {REMOTE} && runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npx prisma generate && npm run build'",
        f"bash {REMOTE}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
    ]
    for cmd in steps:
        if run(client, cmd)[0] != 0:
            client.close()
            return 1

    bootstrap = (
        f"cd {REMOTE} && set -a && . ./.env && set +a && "
        f"SUPER_ADMIN_BOOTSTRAP_USERNAME={BOOT_USER} "
        f"SUPER_ADMIN_BOOTSTRAP_EMAIL={BOOT_EMAIL} "
        f"SUPER_ADMIN_BOOTSTRAP_PASSWORD='{BOOT_PASS}' "
        f"SUPER_ADMIN_BOOTSTRAP_FORCE=1 "
        f"runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npm run ensure:super-admin'"
    )
    code, text = run(client, bootstrap, timeout=300)
    client.close()

    print("\n" + "=" * 50)
    print("生产 super_admin 登录信息（请妥善保存）：")
    print(f"  地址: http://{HOST}:6666/login")
    print(f"  用户名: {BOOT_USER}")
    print(f"  邮箱:   {BOOT_EMAIL}")
    print(f"  密码:   {BOOT_PASS}")
    print("  控制台: /console")
    print("=" * 50)

    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
