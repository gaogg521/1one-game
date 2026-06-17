#!/usr/bin/env python3
"""Fix prod login: patch linkOwnerKey, rebuild, reset super_admin password."""
from __future__ import annotations

import os
import re
import secrets
import sys

import paramiko

HOST = "43.163.105.71"
REMOTE = "/opt/operone"
BOOT_USER = "allenzhao"
BOOT_EMAIL = "allenzhao@huanle.com"
BOOT_PASS = os.environ.get("SUPER_ADMIN_BOOTSTRAP_PASSWORD") or secrets.token_hex(10)

repo = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
raw = open(os.path.join(repo, "scripts/upload-literary-samples-to-server.py"), encoding="utf-8").read()
pw = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M).group(1)


def run(client, cmd, timeout=7200):
    print("\n>>>", cmd[:160])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    text = (o.read() + e.read()).decode("utf-8", "replace").strip()
    code = o.channel.recv_exit_status()
    if text:
        print(text[-5000:] if len(text) > 5000 else text)
    print(f"[exit {code}]")
    return code, text


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", pw, timeout=30, allow_agent=False, look_for_keys=False)

    sftp = client.open_sftp()
    uploads = [
        ("src/lib/auth/user.ts", f"{REMOTE}/src/lib/auth/user.ts"),
        ("src/app/login/page.tsx", f"{REMOTE}/src/app/login/page.tsx"),
    ]
    for local_rel, remote in uploads:
        local = os.path.join(repo, local_rel.replace("/", os.sep))
        sftp.put(local, remote)
        print("uploaded", local_rel)
    sftp.close()

    steps = [
        f"cd {REMOTE} && runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npm run build'",
        f"bash {REMOTE}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
        (
            f"cd {REMOTE} && set -a && . ./.env && set +a && "
            f"SUPER_ADMIN_BOOTSTRAP_USERNAME={BOOT_USER} "
            f"SUPER_ADMIN_BOOTSTRAP_EMAIL={BOOT_EMAIL} "
            f"SUPER_ADMIN_BOOTSTRAP_PASSWORD='{BOOT_PASS}' "
            f"SUPER_ADMIN_BOOTSTRAP_FORCE=1 "
            f"runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npm run ensure:super-admin'"
        ),
        (
            "curl -sS -m 15 -w '\\nHTTP:%{http_code}\\n' -X POST http://127.0.0.1:6666/api/auth/login "
            "-H 'Content-Type: application/json' "
            f"-H 'Cookie: gcreator_owner=e6268d62-6dd3-4a54-b85e-360b4161b5bd' "
            f"-d '{{\"account\":\"{BOOT_USER}\",\"password\":\"{BOOT_PASS}\"}}'"
        ),
    ]
    for cmd in steps:
        code, _ = run(client, cmd)
        if code != 0:
            client.close()
            return 1

    client.close()
    print("\n" + "=" * 50)
    print(f"登录: http://{HOST}:6666/login")
    print(f"用户名: {BOOT_USER}")
    print(f"密码:   {BOOT_PASS}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
