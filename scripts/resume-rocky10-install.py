#!/usr/bin/env python3
"""Upload deploy lib fix and resume linux-ubuntu22-full.sh on Rocky 10."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "scripts" / "deploy" / "lib" / "ubuntu-deploy-lib.sh"


def main() -> int:
    repo = deploy_repo()
    print_target("resume Rocky 10 install")
    client = connect()
    sftp = client.open_sftp()
    remote_lib = f"{repo}/scripts/deploy/lib/ubuntu-deploy-lib.sh"
    print(f"Upload {LIB.name} -> {remote_lib}")
    sftp.put(str(LIB), remote_lib)
    sftp.close()

    cmd = (
        f"export NON_INTERACTIVE=1 OPERONE_DIR={repo} && "
        f"bash {repo}/scripts/deploy/linux-ubuntu22-full.sh 2>&1 | tee -a /root/operone-full.log"
    )
    code = run(client, cmd, timeout=7200)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
