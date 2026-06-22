#!/usr/bin/env python3
"""Pull latest + set PORT + build + restart on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run, site_url


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("playability deploy")
    client = connect()
    steps = [
        f"cd {repo} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        f"cd {repo} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={port}|' .env || echo 'PORT={port}' >> .env)",
        'NODE_REAL=$(readlink -f $(command -v node)) && setcap cap_net_bind_service+ep "$NODE_REAL" 2>/dev/null || true',
        "systemctl stop nginx 2>/dev/null || true",
        "systemctl disable nginx 2>/dev/null || true",
        f"cd {repo} && HOME={repo} NPM_CONFIG_CACHE={repo}/.npm-cache npm install --no-audit --no-fund --ignore-scripts",
        f"cd {repo} && HOME={repo} npx prisma generate",
        (
            "python3 - <<'PY'\n"
            "from pathlib import Path\n"
            f"p = Path('{repo}') / 'node_modules/@parcel/watcher/index.js'\n"
            "if p.is_file():\n"
            "    p.write_text("
            "'\"use strict\";\\nconst noop=async()=>{};\\nconst emptySub=async()=>({unsubscribe:noop});\\n"
            "exports.subscribe=emptySub;\\nexports.unsubscribe=noop;\\n"
            "exports.writeSnapshot=async()=>\"\";\\nexports.getEventsSince=async()=>[];\\n', "
            "encoding='utf-8')\n"
            "    print('stubbed parcel watcher')\n"
            "PY"
        ),
        f"cd {repo} && HOME={repo} NODE_OPTIONS='--max-old-space-size=2560' npm run build",
        "systemctl restart operone || true",
        "sleep 5",
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]
    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0:
            client.close()
            return code if i < len(steps) - 1 else 1
    client.close()
    print(f"\nDEPLOY_OK @ {site_url()} (port {port})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
