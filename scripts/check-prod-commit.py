#!/usr/bin/env python3
import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
REPO = "/opt/operone"


def load_password() -> str:
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    if p.is_file():
        m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1)
    sys.exit("no password")


def main() -> None:
    pw = load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", pw, timeout=30, allow_agent=False, look_for_keys=False)
    for cmd in [
        f"cd {REPO} && git log -1 --oneline",
        f"cd {REPO} && git merge-base --is-ancestor 3d8c065 HEAD && echo '3d8c065:included' || echo '3d8c065:MISSING'",
        "curl -sf http://127.0.0.1:3000/api/health",
    ]:
        _, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace").strip()
        print(out)
    client.close()


if __name__ == "__main__":
    main()
