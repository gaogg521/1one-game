#!/usr/bin/env python3
"""Finish production deploy: CentOS7 sharp LD path + build + restart."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("sharp fix deploy")
    client = connect()
    ld = "/opt/rh/devtoolset-7/root/usr/lib64"
    node_wrap = f"{repo}/scripts/deploy/bin/node-centos7-sharp"
    steps = [
        f"test -d {ld} && echo devtoolset7_ok || echo devtoolset7_missing",
        (
            f"mkdir -p {repo}/scripts/deploy/bin && cat > {node_wrap} <<'EOF'\n"
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            f'export LD_LIBRARY_PATH="{ld}${{LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}}"\n'
            'REAL_NODE="$(readlink -f "$(command -v node)")"\n'
            'exec "$REAL_NODE" "$@"\n'
            "EOF\n"
            f"chmod +x {node_wrap}"
        ),
        (
            f"bash -lc 'cd {repo} && export PATH={repo}/scripts/deploy/bin:$PATH && "
            f"HOME={repo} NODE_OPTIONS=\"--max-old-space-size=2560\" npm run build'"
        ),
        f"cd {repo} && set -a && . ./.env && set +a && npm run seed:samples",
        "systemctl restart operone",
        "sleep 8",
        f"curl -sf http://127.0.0.1:{port}/api/health",
        f"cd {repo} && git log -1 --oneline",
    ]
    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0 and i in (3,):
            continue
        if code != 0 and i >= 2:
            client.close()
            return code
    client.close()
    print("\nDEPLOY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
