#!/usr/bin/env python3
"""Sync user game-sprites to production — one remote listing, per-dir SFTP upload."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run, run_output

ROOT = Path(__file__).resolve().parent.parent
LOCAL_DB = ROOT / "prisma" / "dev.db"
BATCH = 25


def user_sprite_dirs() -> list[Path]:
    conn = sqlite3.connect(LOCAL_DB)
    ids = [r[0] for r in conn.execute("SELECT id FROM Project WHERE id NOT LIKE 'sample-%'")]
    conn.close()
    root = ROOT / "public" / "game-sprites"
    return sorted(d for i in ids if (d := root / i).is_dir())


def remote_sprite_names(client, repo: str) -> set[str]:
    _, out = run_output(
        client,
        f"find {repo}/public/game-sprites -mindepth 1 -maxdepth 1 -type d ! -name 'sample-*' -printf '%f\\n' 2>/dev/null || "
        f"ls -1 {repo}/public/game-sprites | grep -v '^sample-'",
        timeout=120,
    )
    return {ln.strip() for ln in (out or "").splitlines() if ln.strip()}


def sftp_put_dir(sftp, local: Path, remote: str) -> None:
    try:
        sftp.mkdir(remote)
    except OSError:
        pass
    for item in local.iterdir():
        rp = f"{remote}/{item.name}"
        if item.is_dir():
            sftp_put_dir(sftp, item, rp)
        else:
            sftp.put(str(item), rp)


def upload_dirs(client, repo: str, dirs: list[Path]) -> None:
    sftp = client.open_sftp()
    for d in dirs:
        remote = f"{repo}/public/game-sprites/{d.name}"
        print(f"  upload {d.name} …", flush=True)
        sftp_put_dir(sftp, d, remote)
    sftp.close()
    run(client, f"chown -R www-data:www-data {repo}/public/game-sprites", timeout=600)


def main() -> int:
    if not LOCAL_DB.is_file():
        print(f"Missing {LOCAL_DB}", file=sys.stderr)
        return 1

    repo = deploy_repo()
    print_target("sync user sprites")
    all_local = user_sprite_dirs()
    print(f"Local user sprite dirs: {len(all_local)}")

    client = connect()
    existing = remote_sprite_names(client, repo)
    todo = [d for d in all_local if d.name not in existing]
    print(f"On server: {len(existing)} · need upload: {len(todo)}")

    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        n, total = i // BATCH + 1, (len(todo) + BATCH - 1) // BATCH or 1
        print(f"\n=== Batch {n}/{total} ({len(batch)} dirs) ===", flush=True)
        try:
            upload_dirs(client, repo, batch)
        except Exception as exc:
            print(f"Reconnect after: {exc}", flush=True)
            client.close()
            client = connect()
            upload_dirs(client, repo, batch)

    run(client, "systemctl restart operone || true")
    run(client, "sleep 8")
    _, health = run_output(client, "curl -sf http://127.0.0.1:80/api/health")
    _, count = run_output(
        client,
        f"find {repo}/public/game-sprites -mindepth 1 -maxdepth 1 -type d ! -name 'sample-*' | wc -l",
    )
    client.close()
    print("\nSPRITES_SYNC_OK")
    print("health:", health)
    print("user sprite dirs on server:", count.strip() if count else "?")
    return 0 if health and '"ok":true' in health else 1


if __name__ == "__main__":
    raise SystemExit(main())
