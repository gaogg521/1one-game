#!/usr/bin/env python3
"""Sync novel/comic cover files referenced by production DB from local public/covers/."""
from __future__ import annotations

import json
import re
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
REPO = "/opt/operone"
REMOTE_TAR = f"{REPO}/data/literary-covers-bundle.tar.gz"


def load_password() -> str:
    if pw := __import__("os").environ.get("OPERONE_DEPLOY_PASSWORD"):
        return pw
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else sys.exit("Set OPERONE_DEPLOY_PASSWORD")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str]:
    print("\n>>>", cmd[:220])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace").strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-4000:])
    print(f"[exit {code}]")
    return code, out


def fetch_prod_cover_paths(client: paramiko.SSHClient) -> list[str]:
    sql = (
        "SELECT coverPath FROM Novel WHERE coverPath IS NOT NULL AND coverPath != '' "
        "UNION SELECT coverPath FROM Comic WHERE coverPath IS NOT NULL AND coverPath != '';"
    )
    _, out = run(client, f'sqlite3 {REPO}/prisma/prod.db "{sql}"')
    paths = [ln.strip() for ln in out.splitlines() if ln.strip().startswith("/covers/")]
    return sorted(set(paths))


def local_rel(path: str) -> str:
    return path.lstrip("/")


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    covers_dir = repo / "public" / "covers"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    prod_paths = fetch_prod_cover_paths(client)
    print(f"Production coverPath refs: {len(prod_paths)}")

    to_upload: list[Path] = []
    missing_local: list[str] = []
    for p in prod_paths:
        rel = local_rel(p)
        local = covers_dir / rel.replace("/", "\\") if "\\" in str(covers_dir) else covers_dir / rel
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

    run(client, f"mkdir -p {REPO}/data")
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
        code, _ = run(client, cmd)
        if code != 0:
            client.close()
            return code

    # verify a few from user's screenshot
    for rel in [
        "/covers/cmpawu0hx0008bxbbfkehkiy1.jpg",
        "/covers/cmpawegjq0005bxbbm9yibuce.jpg",
        "/covers/composed-1779112837591.jpg",
    ]:
        code, out = run(client, f"test -f {REPO}/public{rel} && echo OK || echo MISSING")
        print("verify", rel, out.splitlines()[-1] if out else "?")

    client.close()
    print("\nSYNC_OK literary covers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
