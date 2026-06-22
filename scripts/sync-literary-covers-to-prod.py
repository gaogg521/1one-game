#!/usr/bin/env python3
"""Sync novel/comic cover files referenced by production DB from local public/covers/."""
from __future__ import annotations

import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run_output

REPO = deploy_repo()
REMOTE_TAR = f"{REPO}/data/literary-covers-bundle.tar.gz"


def fetch_prod_cover_paths(client) -> list[str]:
    sql = (
        "SELECT coverPath FROM Novel WHERE coverPath IS NOT NULL AND coverPath != '' "
        "UNION SELECT coverPath FROM Comic WHERE coverPath IS NOT NULL AND coverPath != '';"
    )
    _, out = run_output(client, f'sqlite3 {REPO}/prisma/prod.db "{sql}"')
    paths = [ln.strip() for ln in out.splitlines() if ln.strip().startswith("/covers/")]
    return sorted(set(paths))


def local_rel(path: str) -> str:
    return path.lstrip("/")


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    covers_dir = repo / "public" / "covers"
    print_target("sync literary covers")

    client = connect()
    prod_paths = fetch_prod_cover_paths(client)
    print(f"Production coverPath refs: {len(prod_paths)}")

    to_upload: list[Path] = []
    missing_local: list[str] = []
    for p in prod_paths:
        rel = local_rel(p)
        local = repo / "public" / rel
        if local.is_file():
            to_upload.append(local)
        else:
            missing_local.append(p)

    print(f"Local files found: {len(to_upload)}")
    if missing_local:
        print(f"Missing locally ({len(missing_local)}):")
        for p in missing_local[:10]:
            print(" ", p)
        if len(missing_local) > 10:
            print(f"  ... +{len(missing_local) - 10} more")

    if not to_upload:
        print("Nothing to upload.")
        client.close()
        return 1

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = Path(tmp.name)

    with tarfile.open(tar_path, "w:gz") as tar:
        for f in to_upload:
            arc = f.relative_to(repo).as_posix()
            tar.add(f, arcname=arc)

    size_mb = tar_path.stat().st_size / (1024 * 1024)
    print(f"Bundle: {len(to_upload)} files, {size_mb:.1f} MB")

    run_output(client, f"mkdir -p {REPO}/data")
    sftp = client.open_sftp()
    print(f"Uploading -> {REMOTE_TAR}")
    sftp.put(str(tar_path), REMOTE_TAR)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    steps = [
        f"cd {REPO} && tar -xzf {REMOTE_TAR}",
        f"chown -R www-data:www-data {REPO}/public/covers",
        f"ls {REPO}/public/covers | wc -l",
        f"du -sh {REPO}/public/covers",
    ]
    for cmd in steps:
        code, _ = run_output(client, cmd)
        if code != 0:
            client.close()
            return code

    client.close()
    print("\nSYNC_OK literary covers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
