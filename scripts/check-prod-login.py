#!/usr/bin/env python3
"""Check prod DB for super admin and test login API."""
import json
import re
import sys

import paramiko

raw = open("scripts/upload-literary-samples-to-server.py", encoding="utf-8").read()
pw = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M).group(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("43.163.105.71", 22, "root", pw, timeout=30, allow_agent=False, look_for_keys=False)

cmds = [
    "sqlite3 /opt/operone/prisma/prod.db \"SELECT id, username, email, role, length(passwordHash) as ph FROM User WHERE username='allenzhao' OR email LIKE '%allenzhao%' OR role='super_admin';\"",
    "sqlite3 /opt/operone/prisma/prod.db \"SELECT COUNT(*) FROM User;\"",
    "curl -sS -m 15 -w '\\nHTTP_CODE:%{http_code}\\n' -X POST http://127.0.0.1:6666/api/auth/login -H 'Content-Type: application/json' -d '{\"identifier\":\"allenzhao\",\"password\":\"wrong-password-test\"}'",
    "journalctl -u operone -n 30 --no-pager 2>/dev/null | tail -20",
]

for cmd in cmds:
    print(">>>", cmd[:120])
    _, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace").strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[:8000])
    print(f"[exit {code}]\n")

client.close()
