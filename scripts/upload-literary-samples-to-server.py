#!/usr/bin/env python3
"""Upload literary samples + apply server fixes (import, godot, deploy update)."""
import os, sys, tarfile, tempfile, time
import paramiko

HOST = "43.163.105.71"
USER = "root"
PASSWORD = "B?Stb#][,lupz%"
BUNDLE = os.path.join(os.path.dirname(__file__), "..", "data", "literary-samples-bundle")
REMOTE_DIR = "/opt/operone/data/literary-samples-bundle"

def run(client, cmd, timeout=3600):
    print("\n>>>", cmd[:120])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out[-6000:] if len(out) > 6000 else out.rstrip())
    if err.strip():
        print("STDERR:", err[-2000:].rstrip())
    print(f"[exit {code}]")
    return code

def upload_dir(sftp, local, remote):
    for root, _, files in os.walk(local):
        rel = os.path.relpath(root, local).replace("\\", "/")
        rdir = remote if rel == "." else f"{remote}/{rel}"
        try:
            sftp.stat(rdir)
        except OSError:
            parts = rdir.split("/")
            cur = ""
            for p in parts:
                if not p:
                    continue
                cur += "/" + p
                try:
                    sftp.stat(cur)
                except OSError:
                    sftp.mkdir(cur)
        for f in files:
            lp = os.path.join(root, f)
            rp = f"{rdir}/{f}"
            print("upload", rp)
            sftp.put(lp, rp)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)

# upload bundle
run(client, f"rm -rf {REMOTE_DIR} && mkdir -p {REMOTE_DIR}")
sftp = client.open_sftp()
upload_dir(sftp, os.path.abspath(BUNDLE), REMOTE_DIR)
sftp.close()

cmds = [
    "cd /opt/operone && git fetch origin && git pull --ff-only origin main || true",
    f"cd /opt/operone && python3 scripts/import-literary-samples.py --in {REMOTE_DIR}",
    "chown -R www-data:www-data /opt/operone/public /opt/operone/data",
    # Godot binary (~50MB)
    "cd /opt/operone && sudo -u www-data bash -lc 'bash scripts/godot-install-linux.sh'",
    # Templates (~1.1GB) — may take several minutes
    "cd /opt/operone && sudo -u www-data bash -lc 'XDG_DATA_HOME=/opt/operone/.local/share bash scripts/godot-install-templates-linux.sh'",
    "chown -R www-data:www-data /opt/operone/tools /opt/operone/.local",
    # rebuild for session API fix + restart with godot env
    "cd /opt/operone && sudo -u www-data bash -lc 'npm run build'",
    "bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
    "curl -sf http://127.0.0.1:6666/api/novel?limit=3",
    "curl -sf http://127.0.0.1:6666/api/comic?limit=3",
    "test -x /opt/operone/tools/godot/Godot_v4.4.1-stable_linux.x86_64 && echo GODOT_OK",
]
for c in cmds:
    code = run(client, c, timeout=7200)
    if code != 0 and "git pull" not in c and "import-literary" not in c:
        print("WARN non-zero:", c)

client.close()
print("DONE")
