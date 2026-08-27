#!/usr/bin/env python3
"""Rename + upload 1ONE Work installers to production /opt/data/1onework-releases/.

Default sources (2.1.47 / 20260721):
  Win:  D:/aionui-m0/1oneUI/out/1ONE-Code-2.1.47-win-x64.exe
  Mac:  D:/aionui-m0/mac-builds/2.1.47/macos-build-*-2a0849f/*.dmg

Target names:
  1ONE-Code-{version}-{YYYYMMDD}-{os}-{arch}.{ext}

Usage:
  python scripts/upload-1onework-releases.py
  python scripts/upload-1onework-releases.py --version 2.1.47 --date 20260721
"""
from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prod_ssh import connect, print_target, run, run_output

REMOTE_DIR = "/opt/data/1onework-releases"
WWW_RELEASES = "/opt/website-1onework/releases"

DEFAULTS = {
    "version": "2.1.47",
    "date": "20260721",
    "win": Path(r"D:\aionui-m0\1oneUI\out\1ONE-Code-2.1.47-win-x64.exe"),
    "mac_arm": Path(
        r"D:\aionui-m0\mac-builds\2.1.47\macos-build-arm64-2a0849f\1ONE-Code-2.1.47-mac-arm64.dmg"
    ),
    "mac_x64": Path(
        r"D:\aionui-m0\mac-builds\2.1.47\macos-build-x64-2a0849f\1ONE-Code-2.1.47-mac-x64.dmg"
    ),
}


def artifact(version: str, date: str, os_name: str, arch: str, ext: str) -> str:
    return f"1ONE-Code-{version}-{date}-{os_name}-{arch}.{ext}"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--version", default=DEFAULTS["version"])
    p.add_argument("--date", default=DEFAULTS["date"])
    p.add_argument("--win", type=Path, default=DEFAULTS["win"])
    p.add_argument("--mac-arm", type=Path, default=DEFAULTS["mac_arm"])
    p.add_argument("--mac-x64", type=Path, default=DEFAULTS["mac_x64"])
    args = p.parse_args()

    items = [
        (args.win, artifact(args.version, args.date, "win", "x64", "exe")),
        (args.mac_arm, artifact(args.version, args.date, "mac", "arm64", "dmg")),
        (args.mac_x64, artifact(args.version, args.date, "mac", "x64", "dmg")),
    ]
    for src, _name in items:
        if not src.is_file():
            print(f"Missing: {src}", file=sys.stderr)
            return 1

    print_target("1onework releases upload")
    staging = Path(tempfile.mkdtemp(prefix="1onework-rel-"))
    try:
        staged: list[tuple[Path, str]] = []
        for src, name in items:
            dest = staging / name
            print(f"Stage {src.name} → {name} ({src.stat().st_size / 1e6:.1f} MB)")
            shutil.copy2(src, dest)
            staged.append((dest, name))

        client = connect()
        try:
            run(client, f"mkdir -p {REMOTE_DIR} {WWW_RELEASES}")
            sftp = client.open_sftp()
            for local, name in staged:
                remote = f"{REMOTE_DIR}/{name}"
                print(f"Uploading → {remote}")
                sftp.put(str(local), remote)
            sftp.close()
            run(
                client,
                f"ln -sfn {REMOTE_DIR} {WWW_RELEASES} 2>/dev/null || "
                f"(rm -rf {WWW_RELEASES} && ln -s {REMOTE_DIR} {WWW_RELEASES}); "
                f"chown -R nginx:nginx {REMOTE_DIR} 2>/dev/null || "
                f"chown -R www-data:www-data {REMOTE_DIR} || true; "
                f"ls -lh {REMOTE_DIR}",
            )
            # smoke: HEAD one file via local nginx host
            sample = staged[0][1]
            code, out = run_output(
                client,
                f"curl -skI -o /dev/null -w '%{{http_code}}' "
                f"--resolve work.1oneclaw.com:443:127.0.0.1 "
                f"https://work.1oneclaw.com/releases/{sample} || echo FAIL",
            )
            print("release HEAD:", out)
            print("UPLOAD_OK")
            for _, name in staged:
                print(f"  https://work.1oneclaw.com/releases/{name}")
            return 0
        finally:
            client.close()
    finally:
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
