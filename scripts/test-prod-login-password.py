#!/usr/bin/env python3
import re
import paramiko

raw = open("scripts/upload-literary-samples-to-server.py", encoding="utf-8").read()
pw = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M).group(1)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("43.163.105.71", 22, "root", pw, timeout=30, allow_agent=False, look_for_keys=False)

cmds = [
    "sqlite3 /opt/operone/prisma/prod.db \"SELECT id, username, role, legacyOwnerKey FROM User;\"",
    """curl -sS -m 20 -w '\\nHTTP:%{http_code}\\n' -X POST http://127.0.0.1:6666/api/auth/login -H 'Content-Type: application/json' -H 'Cookie: operone_owner=anon-test-key-12345' -d '{\"account\":\"allenzhao\",\"password\":\"40725f30d9c3162e2e9c20\"}'""",
    """curl -sS -m 20 -w '\\nHTTP:%{http_code}\\n' -X POST http://127.0.0.1:6666/api/auth/login -H 'Content-Type: application/json' -d '{\"account\":\"allenzhao\",\"password\":\"40725f30d9c3162e2e9c20\"}'""",
]
for cmd in cmds:
    print(">>>", cmd[:100])
    _, o, e = client.exec_command(cmd, timeout=30)
    print((o.read()+e.read()).decode()[:2000])
client.close()
