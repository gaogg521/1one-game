#!/usr/bin/env python3
"""Deploy origin/main to production with migrate + seed.

After this script, also run from local dev machine (assets are NOT in git):
  python scripts/sync-sample-assets-to-prod.py
  python scripts/sync-literary-covers-to-prod.py
Or use the all-in-one wrapper:
  python scripts/deploy-prod-with-assets.py

Target host: set OPERONE_DEPLOY_HOST (see scripts/deploy.local.env.example). See docs/server-migration.md
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import (
    connect,
    deploy_app_port,
    deploy_domain,
    deploy_repo,
    ensure_git_safe,
    local_health_check_command,
    print_target,
    run,
    shell_source_env,
)


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    env = shell_source_env(repo)
    print_target("deploy")

    client = connect()
    ensure_git_safe(client, repo)
    steps = [
        f"cd {repo} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        f"cd {repo} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={port}|' .env || echo 'PORT={port}' >> .env)",
        (
            f"cd {repo} && for pair in "
            f"'OPENGAME_BROWSER_BENCH=1' 'OPENGAME_BROWSER_BENCH_REPAIR=1' "
            f"'OPENGAME_BROWSER_BENCH_REQUIRED=1' 'PLAYWRIGHT_BASE_URL=http://127.0.0.1:{port}' "
            f"'PLAYWRIGHT_BROWSERS_PATH={repo}/data/ms-playwright'; do "
            "key=${pair%%=*}; grep -q \"^${key}=\" .env && sed -i \"s|^${key}=.*|${pair}|\" .env || echo \"${pair}\" >> .env; done"
        ),
        f"sed -i 's/\\r$//' {repo}/.env 2>/dev/null; sed -i '/^PRISMA_CLIENT_ENGINE_TYPE=/d' {repo}/.env 2>/dev/null || true",
        f"cd {repo} && {env} && npx prisma migrate deploy",
        f"cd {repo} && HOME={repo} NPM_CONFIG_CACHE={repo}/.npm-cache npm install --no-audit --no-fund",
        f"cd {repo} && HOME={repo} npx prisma generate",
        f"cd {repo} && mkdir -p data/ms-playwright && PLAYWRIGHT_BROWSERS_PATH={repo}/data/ms-playwright npx playwright install chromium && chmod -R a+rX data/ms-playwright",
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
        f"chown -R www-data:www-data {repo}/.next",
        f"cd {repo} && {env} && npm run seed:samples",
        "systemctl restart operone",
        "sleep 6",
        "systemctl is-active --quiet operone",
        local_health_check_command(),
        f"cd {repo} && bash scripts/deploy/install-generation-worker-timer.sh",
    ]

    try:
        for i, cmd in enumerate(steps):
            code = run(client, cmd)
            if code != 0:
                return code
    finally:
        client.close()

    domain = deploy_domain()
    print(f"\nDEPLOY_OK @ {domain or f'http://127.0.0.1:{port}'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
