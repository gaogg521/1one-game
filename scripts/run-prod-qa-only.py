#!/usr/bin/env python3
import os, re, sys, paramiko
HOST = "43.163.105.71"
USER = "root"
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
raw = open(os.path.join(REPO, "scripts/upload-literary-samples-to-server.py"), encoding="utf-8").read()
PASSWORD = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M).group(1)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, USER, PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
sftp.put(os.path.join(REPO, "scripts/qa-username-auth.ts"), "/opt/operone/scripts/qa-username-auth.ts")
sftp.close()
cmd = "cd /opt/operone && AUTH_TEST_BASE_URL=http://127.0.0.1:6666 runuser -u www-data -- bash -lc 'export PATH=/usr/local/bin:/usr/bin:$PATH; npx tsx scripts/qa-username-auth.ts'"
_, o, e = c.exec_command(cmd, timeout=120)
out = o.read().decode() + e.read().decode()
print(out)
sys.exit(o.channel.recv_exit_status())
