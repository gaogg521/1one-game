#!/usr/bin/env python3
"""Create a migration bundle on the production server and download it locally.

Bundle includes state NOT in git: .env, prod.db, public runtime assets, data/.

Usage (from repo root, on a machine with SSH access):
  set OPERONE_DEPLOY_PASSWORD=...
  python scripts/backup-prod-for-migration.py
  python scripts/backup-prod-for-migration.py --output backups/my-migrate.tgz

Optional — backup a different (old) host before cutover:
  set OPERONE_DEPLOY_HOST=43.163.105.71
  python scripts/backup-prod-for-migration.py

See docs/server-migration.md
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from prod_ssh import connect, deploy_repo, print_target, run

ROOT = Path(__file__).resolve().parent.parent
BACKUP_ITEMS = [
    ".env",
    "prisma/prod.db",
    "prisma/prod.db-wal",
    "prisma/prod.db-shm",
    "public/covers",
    "public/game-sprites",
    "public/game-bg",
    "data",
]


def build_remote_tar(repo: str, remote_tar: str, include_tools: bool) -> int:
    items = list(BACKUP_ITEMS)
    if include_tools:
        items.extend(["tools", ".local"])

    items_shell = " ".join(items)
    manifest_py = f"""
import json, subprocess, datetime, pathlib
repo = pathlib.Path({repo!r})
def cnt(sql):
    try:
        return subprocess.check_output(["sqlite3", str(repo / "prisma/prod.db"), sql], text=True).strip()
    except Exception:
        return "?"
manifest = {{
    "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "hostname": subprocess.getoutput("hostname"),
    "gitHead": subprocess.getoutput(f"cd {{repo}} && git log -1 --format=%H 2>/dev/null").strip(),
    "gitSubject": subprocess.getoutput(f"cd {{repo}} && git log -1 --oneline 2>/dev/null").strip(),
    "counts": {{
        "projects": cnt("SELECT COUNT(*) FROM Project;"),
        "novels": cnt("SELECT COUNT(*) FROM Novel;"),
        "comics": cnt("SELECT COUNT(*) FROM Comic;"),
        "users": cnt("SELECT COUNT(*) FROM User;"),
    }},
}}
(repo / "data").mkdir(parents=True, exist_ok=True)
(repo / "data/migration-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))
"""

    tar_loop = (
        f"cd {repo} && mkdir -p data && python3 - <<'PY'\n{manifest_py}\nPY && "
        f'TO_TAR="" && for p in {items_shell}; do [ -e "$p" ] && TO_TAR="$TO_TAR $p"; done && '
        f'tar czf {remote_tar} $TO_TAR data/migration-manifest.json'
    )

    steps = [
        tar_loop,
        f"du -sh {remote_tar}",
        f"tar tzf {remote_tar} | head -30",
    ]
    client = connect()
    try:
        for cmd in steps:
            code = run(client, cmd, timeout=1800)
            if code != 0:
                return code
        return 0
    finally:
        client.close()


def download_remote_tar(remote_tar: str, local_path: Path) -> int:
    client = connect()
    try:
        sftp = client.open_sftp()
        local_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"\nDownloading {remote_tar} -> {local_path}")
        sftp.get(remote_tar, str(local_path))
        sftp.close()
        print(f"LOCAL_OK {local_path} ({local_path.stat().st_size / 1024 / 1024:.1f} MB)")
        return 0
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup production state for server migration")
    parser.add_argument(
        "--output",
        type=Path,
        help="Local .tgz path (default: backups/operone-migrate-UTC.tgz)",
    )
    parser.add_argument("--include-tools", action="store_true", help="Also pack tools/ and .local/ (Godot)")
    parser.add_argument("--keep-remote", action="store_true", help="Do not delete remote tar after download")
    args = parser.parse_args()

    repo = deploy_repo()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    remote_tar = f"{repo}/data/migration-backup-{ts}.tgz"
    local_path = args.output or (ROOT / "backups" / f"operone-migrate-{ts}.tgz")

    print_target("backup")
    code = build_remote_tar(repo, remote_tar, args.include_tools)
    if code != 0:
        return code

    code = download_remote_tar(remote_tar, local_path.resolve())
    if code != 0:
        return code

    if not args.keep_remote:
        client = connect()
        try:
            run(client, f"rm -f {remote_tar}")
        finally:
            client.close()

    print("\nBACKUP_OK")
    print(f"  bundle: {local_path}")
    print("  next: install new server, then:")
    print(f"    set OPERONE_DEPLOY_HOST=<new-ip>")
    print(f"    python scripts/restore-prod-migration.py --bundle {local_path}")
    return 0


if __name__ == "__main__":
    # Allow `python scripts/backup-prod-for-migration.py` without package install
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
