#!/usr/bin/env python3
"""Sync local sample game assets (sprites + backgrounds) to production."""
from __future__ import annotations

import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run_output

REPO = deploy_repo()
REMOTE_TAR = f"{REPO}/data/sample-assets-bundle.tar.gz"


def collect_local_assets(root: Path) -> list[Path]:
    items: list[Path] = []
    sprites = root / "public" / "game-sprites"
    bg_dir = root / "public" / "game-bg"
    for d in sorted(sprites.glob("sample-*")):
        if d.is_dir():
            items.append(d)
    for f in sorted(bg_dir.glob("sample-*.png")):
        items.append(f)
    return items


def build_tar(repo: Path, dest: Path) -> tuple[int, int]:
    items = collect_local_assets(repo)
    file_count = 0
    with tarfile.open(dest, "w:gz") as tar:
        for item in items:
            arc = item.relative_to(repo).as_posix()
            tar.add(item, arcname=arc)
            if item.is_dir():
                file_count += sum(1 for _ in item.rglob("*") if _.is_file())
            else:
                file_count += 1
    return len(items), file_count


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    print_target("sync samples")
    items = collect_local_assets(repo)
    if not items:
        print("No local sample assets found.")
        return 1

    print(f"Local sample asset roots: {len(items)}")
    for p in items[:5]:
        print(" ", p.relative_to(repo))
    if len(items) > 5:
        print(f"  ... +{len(items) - 5} more")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = Path(tmp.name)

    roots, files = build_tar(repo, tar_path)
    size_mb = tar_path.stat().st_size / (1024 * 1024)
    print(f"Bundle: {roots} roots, {files} files, {size_mb:.1f} MB")

    client = connect()
    run_output(client, f"mkdir -p {REPO}/data")
    sftp = client.open_sftp()
    print(f"Uploading -> {REMOTE_TAR}")
    sftp.put(str(tar_path), REMOTE_TAR)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    steps = [
        f"cd {REPO} && tar -xzf {REMOTE_TAR}",
        f"chown -R www-data:www-data {REPO}/public/game-sprites {REPO}/public/game-bg",
        f"ls {REPO}/public/game-sprites | grep -c '^sample-' || true",
        f"ls {REPO}/public/game-bg/sample-*.png 2>/dev/null | wc -l",
        f"du -sh {REPO}/public/game-sprites {REPO}/public/game-bg",
    ]
    for cmd in steps:
        code, _ = run_output(client, cmd)
        if code != 0 and "grep" not in cmd:
            client.close()
            return code

    client.close()
    print("\nSYNC_OK sample sprites + backgrounds")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
