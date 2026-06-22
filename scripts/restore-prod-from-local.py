#!/usr/bin/env python3
"""Restore production from local dev.db + public assets (post OS reinstall)."""
from __future__ import annotations

import argparse
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import (
    connect,
    deploy_app_port,
    deploy_repo,
    ensure_git_safe,
    print_target,
    run,
    run_output,
    shell_source_env,
)

ROOT = Path(__file__).resolve().parent.parent
LOCAL_DB = ROOT / "prisma" / "dev.db"


def collect_cover_paths(db_path: Path) -> list[str]:
    conn = sqlite3.connect(db_path)
    paths: set[str] = set()
    for table in ("Project", "Novel", "Comic"):
        for (p,) in conn.execute(
            f"SELECT coverPath FROM {table} WHERE coverPath IS NOT NULL AND coverPath != ''"
        ):
            if p.startswith("/"):
                paths.add(p)
    conn.close()
    return sorted(paths)


def local_public_file(cover_path: str) -> Path | None:
    rel = cover_path.lstrip("/")
    candidates = [
        ROOT / "public" / rel,
        ROOT / rel,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def build_covers_tar(paths: list[str], dest: Path) -> tuple[int, int]:
    added = 0
    missing = 0
    with tarfile.open(dest, "w:gz") as tar:
        for p in paths:
            local = local_public_file(p)
            if not local:
                missing += 1
                continue
            arc = local.relative_to(ROOT).as_posix()
            tar.add(local, arcname=arc)
            added += 1
    return added, missing


def collect_user_sprite_dirs(db_path: Path) -> list[Path]:
    conn = sqlite3.connect(db_path)
    ids = [
        r[0]
        for r in conn.execute("SELECT id FROM Project WHERE id NOT LIKE 'sample-%'")
    ]
    conn.close()
    root = ROOT / "public" / "game-sprites"
    return sorted(d for i in ids if (d := root / i).is_dir())


def build_sprites_tar(dirs: list[Path], dest: Path) -> int:
    files = 0
    with tarfile.open(dest, "w:gz") as tar:
        for d in dirs:
            arc = d.relative_to(ROOT).as_posix()
            tar.add(d, arcname=arc)
            files += sum(1 for _ in d.rglob("*") if _.is_file())
    return files


def upload_tar(client, local: Path, remote: str, retries: int = 3) -> None:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            run_output(client, f"mkdir -p {Path(remote).parent.as_posix().replace(chr(92), '/')}")
            sftp = client.open_sftp()
            print(f"Uploading {local.stat().st_size / 1024 / 1024:.1f} MB -> {remote} (attempt {attempt}/{retries})")
            sftp.put(str(local), remote)
            sftp.close()
            return
        except Exception as exc:
            last_err = exc
            print(f"Upload failed: {exc}", file=sys.stderr)
            if attempt < retries:
                print("Reconnecting…", file=sys.stderr)
                client.close()
                client = connect()
    raise last_err or RuntimeError("upload failed")


PENDING_MIGRATIONS_IF_SCHEMA_AHEAD = [
    "20260621161000_add_comment",
    "20260622120000_project_bgm_notes",
]


def db_stats(db_path: Path) -> dict[str, int]:
    conn = sqlite3.connect(db_path)
    stats = {
        "users": conn.execute("SELECT COUNT(*) FROM User").fetchone()[0],
        "projects": conn.execute("SELECT COUNT(*) FROM Project").fetchone()[0],
        "novels": conn.execute("SELECT COUNT(*) FROM Novel").fetchone()[0],
        "comics": conn.execute("SELECT COUNT(*) FROM Comic").fetchone()[0],
    }
    conn.close()
    return stats


def mark_schema_ahead_migrations(client, repo: str, env: str) -> None:
    """dev.db may contain tables from db push before migration rows were recorded."""
    for name in PENDING_MIGRATIONS_IF_SCHEMA_AHEAD:
        run(
            client,
            f"cd {repo} && {env} && npx prisma migrate resolve --applied {name} 2>/dev/null || true",
            timeout=120,
        )


def migrate_deploy_with_resolve(client, repo: str, env: str) -> int:
    mark_schema_ahead_migrations(client, repo, env)
    code = run(client, f"cd {repo} && {env} && npx prisma migrate deploy", timeout=1800)
    if code == 0:
        return 0
    mark_schema_ahead_migrations(client, repo, env)
    return run(client, f"cd {repo} && {env} && npx prisma migrate deploy", timeout=1800)


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore prod from local dev.db + assets")
    parser.add_argument("--skip-sprites", action="store_true", help="Skip user game-sprites (~5GB)")
    parser.add_argument("--skip-samples-sync", action="store_true", help="Skip sample sprites/bg sync script")
    parser.add_argument("--skip-db", action="store_true", help="Skip DB upload (already restored)")
    parser.add_argument("--skip-covers", action="store_true", help="Skip cover tarball")
    parser.add_argument("--sprites-only", action="store_true", help="Only upload user sprite batches + restart")
    args = parser.parse_args()

    if args.sprites_only:
        args.skip_db = True
        args.skip_covers = True
        args.skip_samples_sync = False

    if not LOCAL_DB.is_file():
        print(f"Missing {LOCAL_DB}", file=sys.stderr)
        return 1

    stats = db_stats(LOCAL_DB)
    print("Local dev.db:", stats)

    repo = deploy_repo()
    port = deploy_app_port()
    env = shell_source_env(repo)
    print_target("restore from local")

    client = connect()
    ensure_git_safe(client, repo)

    # 1) Stop service + upload database
    run(client, "systemctl stop operone || true")
    if not args.skip_db:
        remote_db = f"{repo}/prisma/prod.db"
        sftp = client.open_sftp()
        print(f"Upload DB {LOCAL_DB} ({LOCAL_DB.stat().st_size / 1024 / 1024:.1f} MB) -> {remote_db}")
        sftp.put(str(LOCAL_DB), remote_db)
        for suffix in ("-wal", "-shm"):
            local_extra = LOCAL_DB.parent / (LOCAL_DB.name + suffix)
            if local_extra.is_file():
                sftp.put(str(local_extra), remote_db + suffix)
        sftp.close()

        steps_pre = [
            f"chown www-data:www-data {remote_db} {remote_db}-wal {remote_db}-shm 2>/dev/null || chown www-data:www-data {remote_db}",
            f"sed -i 's/\\r$//' {repo}/.env 2>/dev/null; sed -i '/^PRISMA_CLIENT_ENGINE_TYPE=/d' {repo}/.env 2>/dev/null || true",
        ]
        for cmd in steps_pre:
            if run(client, cmd, timeout=1800) != 0:
                client.close()
                return 1
        if migrate_deploy_with_resolve(client, repo, env) != 0:
            client.close()
            return 1
        if run(
            client,
            f"cd {repo} && runuser -u www-data -- bash -lc 'export HOME={repo}; cd {repo} && npx prisma generate'",
            timeout=1800,
        ) != 0:
            client.close()
            return 1

    # 2) Covers tarball
    if not args.skip_covers:
        cover_paths = collect_cover_paths(LOCAL_DB)
        with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
            covers_tar = Path(tmp.name)
        added, missing = build_covers_tar(cover_paths, covers_tar)
        print(f"Covers: {added} files to upload, {missing} missing locally")
        remote_covers = f"{repo}/data/restore-covers.tar.gz"
        upload_tar(client, covers_tar, remote_covers)
        covers_tar.unlink(missing_ok=True)
        run(
            client,
            f"cd {repo} && tar -xzf {remote_covers} && chown -R www-data:www-data {repo}/public/covers {repo}/public/samples 2>/dev/null || true",
        )

    # 3) User sprites
    if not args.skip_sprites:
        sprite_dirs = collect_user_sprite_dirs(LOCAL_DB)
        print(f"User sprite dirs: {len(sprite_dirs)}")
        batch_size = 40
        for i in range(0, len(sprite_dirs), batch_size):
            batch = sprite_dirs[i : i + batch_size]
            batch_no = i // batch_size + 1
            total_batches = (len(sprite_dirs) + batch_size - 1) // batch_size
            with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
                sprites_tar = Path(tmp.name)
            file_count = build_sprites_tar(batch, sprites_tar)
            mb = sprites_tar.stat().st_size / 1024 / 1024
            print(f"Sprite batch {batch_no}/{total_batches}: {len(batch)} dirs, {file_count} files, {mb:.1f} MB")
            remote_sprites = f"{repo}/data/restore-sprites-{batch_no:03d}.tar.gz"
            try:
                upload_tar(client, sprites_tar, remote_sprites)
            except Exception:
                client.close()
                client = connect()
                upload_tar(client, sprites_tar, remote_sprites)
            sprites_tar.unlink(missing_ok=True)
            run(
                client,
                f"cd {repo} && tar -xzf {remote_sprites} && chown -R www-data:www-data {repo}/public/game-sprites",
                timeout=7200,
            )

    client.close()

    # 4) Sample assets via existing script
    if not args.skip_samples_sync:
        code = subprocess.call([sys.executable, str(Path(__file__).parent / "sync-sample-assets-to-prod.py")])
        if code != 0:
            print("WARN: sample asset sync failed", file=sys.stderr)

    # 5) .env from local
    subprocess.call([sys.executable, str(Path(__file__).parent / "upload-prod-env.py")])

    # 6) Restart + verify
    client = connect()
    run(client, "systemctl restart operone")
    run(client, "sleep 10")
    _, health = run_output(client, f"curl -sf http://127.0.0.1:{port}/api/health")
    _, counts = run_output(
        client,
        f'sqlite3 {repo}/prisma/prod.db "SELECT '
        f"'users', COUNT(*) FROM User UNION ALL "
        f"SELECT 'projects', COUNT(*) FROM Project UNION ALL "
        f"SELECT 'novels', COUNT(*) FROM Novel UNION ALL "
        f"SELECT 'comics', COUNT(*) FROM Comic;\"",
    )
    client.close()

    print("\nRESTORE_OK")
    print("health:", health[:200] if health else "(none)")
    print("prod counts:\n", counts)
    return 0 if health and '"ok":true' in health else 1


if __name__ == "__main__":
    raise SystemExit(main())
