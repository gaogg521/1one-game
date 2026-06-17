#!/usr/bin/env python3
"""Re-run literary sample import on production."""
import re
import sys

import paramiko

raw = open("scripts/upload-literary-samples-to-server.py", encoding="utf-8").read()
pw = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M).group(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("43.163.105.71", 22, "root", pw, timeout=30, allow_agent=False, look_for_keys=False)

cmds = [
    "cd /opt/operone && python3 scripts/import-literary-samples.py --in /opt/operone/data/literary-samples-bundle",
    "chown -R www-data:www-data /opt/operone/public /opt/operone/data",
    "curl -sf 'http://127.0.0.1:6666/api/novel?limit=2'",
    "curl -sf 'http://127.0.0.1:6666/api/comic?limit=2'",
]

for cmd in cmds:
    print(">>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace").strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    print(f"[exit {code}]")
    if code != 0 and "import-literary" in cmd:
        sys.exit(code)

client.close()
print("DONE")
