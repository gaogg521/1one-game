#!/usr/bin/env python3
"""Restore a migration bundle onto a (new) production server.

Prerequisites on target host:
  - Empty or fresh install: curl install.sh (see docs/server-migration.md)
  - OPERONE_DEPLOY_HOST points at the NEW server

Usage:
  set OPERONE_DEPLOY_HOST=<new-ip>
  set OPERONE_DEPLOY_PASSWORD=...
  python scripts/restore-prod-migration.py --bundle backups/operone-migrate-20260618.tgz

See docs/server-migration.md
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from prod_ssh import connect, deploy_domain, deploy_host, deploy_app_port, deploy_repo, print_target, run

ROOT = Path(__file__).resolve().parent.parent


def upload_bundle(local: Path, remote_tar: str) -> int:
    if not local.is_file():
        print(f"Missing bundle: {local}", file=sys.stderr)
        return 1
    client = connect()
    try:
        run(client, f"mkdir -p {deploy_repo()}/data")
        sftp = client.open_sftp()
        print(f"\nUploading {local} -> {remote_tar} ({local.stat().st_size / 1024 / 1024:.1f} MB)")
        sftp.put(str(local.resolve()), remote_tar)
        sftp.close()
        return 0
    finally:
        client.close()


def restore_on_server(remote_tar: str, skip_migrate: bool, skip_restart: bool) -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    steps = [
        "systemctl stop operone || true",
        f"cd {repo} && tar xzf {remote_tar}",
        f"chown -R www-data:www-data {repo}/public {repo}/data {repo}/prisma/prod.db 2>/dev/null || true",
        f"chown www-data:www-data {repo}/.env 2>/dev/null || true",
    ]
    if not skip_migrate:
        steps.append(f"cd {repo} && set -a && . ./.env && set +a && npx prisma migrate deploy")
    if not skip_restart:
        steps.extend(
            [
                "systemctl restart operone || true",
                "sleep 6",
                f"curl -sf http://127.0.0.1:{port}/api/health",
            ]
        )

    client = connect()
    try:
        for i, cmd in enumerate(steps):
            code = run(client, cmd, timeout=1800)
            if code != 0:
                return code
        return 0
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore migration bundle to production server")
    parser.add_argument("--bundle", type=Path, required=True, help="Local .tgz from backup-prod-for-migration.py")
    parser.add_argument("--skip-migrate", action="store_true", help="Skip prisma migrate deploy after extract")
    parser.add_argument("--skip-restart", action="store_true", help="Only extract files, do not restart service")
    parser.add_argument("--keep-remote-tar", action="store_true", help="Keep uploaded tar on server")
    args = parser.parse_args()

    bundle = args.bundle if args.bundle.is_absolute() else (ROOT / args.bundle)
    remote_tar = f"{deploy_repo()}/data/migration-restore.tgz"

    print_target("restore")
    code = upload_bundle(bundle, remote_tar)
    if code != 0:
        return code

    code = restore_on_server(remote_tar, args.skip_migrate, args.skip_restart)
    if code != 0:
        return code

    if not args.keep_remote_tar:
        client = connect()
        try:
            run(client, f"rm -f {remote_tar}")
        finally:
            client.close()

    domain = deploy_domain()
    host = deploy_host()
    print("\nRESTORE_OK")
    print(f"  health: http://{host}/api/health")
    print(f"  site:   http://{domain}/ (after DNS points to this host)")
    print("  optional: python scripts/deploy-prod-with-assets.py  # refresh code + sync assets from laptop")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
