#!/usr/bin/env python3
"""Upload local .env to production (gitignored) and restart."""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run

ROOT = Path(__file__).resolve().parent.parent
LOCAL_ENV = ROOT / ".env"


def prod_env_text() -> str:
    if not LOCAL_ENV.is_file():
        raise SystemExit(f"Missing {LOCAL_ENV}")
    text = LOCAL_ENV.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    seen_db = seen_port = False
    for line in text.splitlines():
        if re.match(r"^\s*DATABASE_URL\s*=", line):
            lines.append('DATABASE_URL="file:./prod.db"')
            seen_db = True
            continue
        if re.match(r"^\s*PORT\s*=", line):
            lines.append("PORT=80")
            seen_port = True
            continue
        # Windows dev-only; breaks Linux production runtime
        if re.match(r"^\s*PRISMA_CLIENT_ENGINE_TYPE\s*=", line):
            continue
        lines.append(line)
    if not seen_db:
        lines.insert(0, 'DATABASE_URL="file:./prod.db"')
    if not seen_port:
        lines.append("PORT=80")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    repo = deploy_repo()
    print_target("upload .env")
    client = connect()
    sftp = client.open_sftp()
    remote = f"{repo}/.env"
    local_tmp = ROOT / "data" / ".env.prod-upload.tmp"
    local_tmp.parent.mkdir(parents=True, exist_ok=True)
    local_tmp.write_text(prod_env_text(), encoding="utf-8", newline="\n")
    sftp.put(str(local_tmp), remote)
    sftp.close()
    local_tmp.unlink(missing_ok=True)
    steps = [
        f"chown www-data:www-data {remote}",
        f"sed -i 's/\\r$//' {remote}",
        f"sed -i '/^PRISMA_CLIENT_ENGINE_TYPE=/d' {remote}",
        f"cd {repo} && set -a && . <(sed 's/\\r$//' {remote}) && set +a && npx prisma migrate deploy",
        "systemctl restart operone",
        "sleep 5",
        "curl -sf http://127.0.0.1:80/api/health",
    ]
    for cmd in steps:
        if run(client, cmd, timeout=1800) != 0:
            client.close()
            return 1
    client.close()
    print("ENV_UPLOAD_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
