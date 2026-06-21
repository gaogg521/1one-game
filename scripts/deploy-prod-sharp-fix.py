#!/usr/bin/env python3
"""Finish production deploy: CentOS7 sharp LD path + build + restart."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
REPO = "/opt/operone"
PORT = "80"


def load_password() -> str:
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else sys.exit("no password")


def run(client, cmd, timeout=3600):
    print("\n>>>", cmd[:220])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-8000:])
    print(f"[exit {code}]")
    return code


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    ld = "/opt/rh/devtoolset-7/root/usr/lib64"
    node_wrap = f"{REPO}/scripts/deploy/bin/node-centos7-sharp"

    steps = [
        f"test -d {ld} && echo devtoolset7_ok || echo devtoolset7_missing",
        (
            f"mkdir -p {REPO}/scripts/deploy/bin && cat > {node_wrap} <<'EOF'\n"
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            f'export LD_LIBRARY_PATH="{ld}${{LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}}"\n'
            'REAL_NODE="$(readlink -f "$(command -v node)")"\n'
            'exec "$REAL_NODE" "$@"\n'
            "EOF\n"
            f"chmod +x {node_wrap}"
        ),
        (
            f"bash -lc 'cd {REPO} && export PATH={REPO}/scripts/deploy/bin:$PATH && "
            f"which node && node -e \"console.log(process.env.LD_LIBRARY_PATH||\\\"\\\")\" && "
            f"HOME={REPO} NODE_OPTIONS=\"--max-old-space-size=2560\" npm run build'"
        ),
        f"cd {REPO} && set -a && . ./.env && set +a && npm run seed:samples",
        (
            f"grep -q 'LD_LIBRARY_PATH={ld}' /etc/systemd/system/operone.service || "
            f"sed -i '/^Environment=HOME=/a Environment=LD_LIBRARY_PATH={ld}' /etc/systemd/system/operone.service; "
            "systemctl daemon-reload"
        ),
        "systemctl restart operone",
        "sleep 8",
        f"curl -sf http://127.0.0.1:{PORT}/api/health",
        f"cd {REPO} && git log -1 --oneline",
    ]
    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0 and i in (3, 4):
            continue  # seed/systemd patch optional
        if code != 0 and i >= 4:
            client.close()
            return code
        if code != 0 and i == 2:
            client.close()
            return code
    client.close()
    print("\nDEPLOY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
