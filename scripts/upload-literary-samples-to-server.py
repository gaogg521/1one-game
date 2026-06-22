#!/usr/bin/env python3
"""Upload literary samples + apply server fixes (import, godot, deploy update)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run

BUNDLE = Path(__file__).resolve().parent.parent / "data" / "literary-samples-bundle"


def upload_dir(sftp, local: str, remote: str) -> None:
    for root, _, files in os.walk(local):
        rel = os.path.relpath(root, local).replace("\\", "/")
        rdir = remote if rel == "." else f"{remote}/{rel}"
        try:
            sftp.stat(rdir)
        except OSError:
            parts = rdir.split("/")
            cur = ""
            for p in parts:
                if not p:
                    continue
                cur += "/" + p
                try:
                    sftp.stat(cur)
                except OSError:
                    sftp.mkdir(cur)
        for f in files:
            lp = os.path.join(root, f)
            rp = f"{rdir}/{f}"
            print("upload", rp)
            sftp.put(lp, rp)


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    remote_dir = f"{repo}/data/literary-samples-bundle"
    print_target("upload literary samples")

    client = connect()
    run(client, f"rm -rf {remote_dir} && mkdir -p {remote_dir}")
    sftp = client.open_sftp()
    upload_dir(sftp, str(BUNDLE.resolve()), remote_dir)
    sftp.close()

    cmds = [
        f"cd {repo} && git fetch origin && git pull --ff-only origin main || true",
        f"cd {repo} && python3 scripts/import-literary-samples.py --in {remote_dir}",
        f"chown -R www-data:www-data {repo}/public {repo}/data",
        f"cd {repo} && sudo -u www-data bash -lc 'bash scripts/godot-install-linux.sh'",
        f"cd {repo} && sudo -u www-data bash -lc 'XDG_DATA_HOME={repo}/.local/share bash scripts/godot-install-templates-linux.sh'",
        f"chown -R www-data:www-data {repo}/tools {repo}/.local",
        f"cd {repo} && sudo -u www-data bash -lc 'npm run build'",
        f"bash {repo}/scripts/deploy/linux-ubuntu22-full.sh --systemd-only",
        f"curl -sf http://127.0.0.1:{port}/api/novel?limit=3",
        f"curl -sf http://127.0.0.1:{port}/api/comic?limit=3",
        f"test -x {repo}/tools/godot/Godot_v4.4.1-stable_linux.x86_64 && echo GODOT_OK",
    ]
    for c in cmds:
        code = run(client, c, timeout=7200)
        if code != 0 and "git pull" not in c and "import-literary" not in c:
            print("WARN non-zero:", c)

    client.close()
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
