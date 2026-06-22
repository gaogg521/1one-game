#!/usr/bin/env python3
"""Deploy origin/main to production with migrate + seed.

After this script, also run from local dev machine (assets are NOT in git):
  python scripts/sync-sample-assets-to-prod.py
  python scripts/sync-literary-covers-to-prod.py
Or use the all-in-one wrapper:
  python scripts/deploy-prod-with-assets.py

Target host: OPERONE_DEPLOY_HOST (default 43.163.105.71). See docs/server-migration.md
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_domain, deploy_repo, print_target, run


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("deploy")

    client = connect()
    steps = [
        f"cd {repo} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        f"cd {repo} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={port}|' .env || echo 'PORT={port}' >> .env)",
        f"cd {repo} && set -a && . ./.env && set +a && npx prisma migrate deploy",
        f"cd {repo} && HOME={repo} NPM_CONFIG_CACHE={repo}/.npm-cache npm install --no-audit --no-fund",
        f"cd {repo} && HOME={repo} npx prisma generate",
        (
            "python3 - <<'PY'\n"
            f"p = __import__('pathlib').Path('{repo}') / 'node_modules/@parcel/watcher/index.js'\n"
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
        f"cd {repo} && set -a && . ./.env && set +a && npm run seed:samples",
        "systemctl restart operone || true",
        "sleep 6",
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]

    try:
        for i, cmd in enumerate(steps):
            code = run(client, cmd)
            if code != 0 and i != len(steps) - 1:
                return code
    finally:
        client.close()

    print(f"\nDEPLOY_OK @ http://{deploy_domain()}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
