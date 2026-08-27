#!/usr/bin/env python3
"""Deploy 1ONE Work static site (Vite) to work.1oneclaw.com.

Prereq: local build of D:/website/1onework → dist/
        Nginx already on server (see deploy-openclaw-www.py)
        scripts/deploy.local.env configured

Usage (from game repo root):
  python scripts/deploy-1onework-www.py
"""
from __future__ import annotations

import argparse
import io
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, print_target, run, run_output

DEFAULT_DIST = Path(r"D:\website\1onework\dist")
REMOTE_WWW = "/opt/website-1onework"
REMOTE_RELEASES = "/opt/data/1onework-releases"
DOMAIN = "work.1oneclaw.com"

NGINX_CONF = f"""\
server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN};

    root {REMOTE_WWW};
    index index.html;

    location ~* \\.(?:css|js|webp|png|jpg|jpeg|gif|svg|ico|woff2?)$ {{
        expires 7d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
"""


def pack_dist(dist: Path) -> Path:
    if not dist.is_dir() or not (dist / "index.html").is_file():
        raise SystemExit(f"Missing built site: {dist}/index.html — run npm run build first")
    tmp = Path(tempfile.mkstemp(suffix=".tar.gz", prefix="1onework-www-")[1])
    with tarfile.open(tmp, "w:gz") as tar:
        for p in dist.rglob("*"):
            if p.is_file():
                tar.add(p, arcname=p.relative_to(dist).as_posix())
    mb = tmp.stat().st_size / 1024 / 1024
    print(f"Packed {dist} → {tmp.name} ({mb:.2f} MB)")
    return tmp


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy 1ONE Work www")
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST)
    parser.add_argument(
        "--force-nginx",
        action="store_true",
        help="Rewrite nginx conf even if Let's Encrypt cert exists",
    )
    args = parser.parse_args()

    print_target("1onework www deploy")
    tarball = pack_dist(args.dist.resolve())
    client = connect()
    try:
        run(client, f"mkdir -p {REMOTE_WWW} /opt/data")
        remote_tar = "/opt/data/1onework-www.tar.gz"
        sftp = client.open_sftp()
        print(f"Uploading → {remote_tar}")
        sftp.put(str(tarball), remote_tar)
        _, cert = run_output(
            client,
            f"test -f /etc/letsencrypt/live/{DOMAIN}/fullchain.pem && echo YES || echo NO",
        )
        if args.force_nginx or "YES" not in (cert or ""):
            sftp.putfo(io.BytesIO(NGINX_CONF.encode("utf-8")), "/etc/nginx/conf.d/1onework-www.conf")
            print("Wrote 1onework-www.conf")
        else:
            print("Keeping 1onework-www.conf (HTTPS/certbot managed)")
        sftp.close()

        run(
            client,
            f"rm -rf {REMOTE_WWW}/* && tar -xzf {remote_tar} -C {REMOTE_WWW} && "
            # 大安装包不进站点 tarball：持久目录软链到 /releases/
            f"mkdir -p {REMOTE_RELEASES} && ln -sfn {REMOTE_RELEASES} {REMOTE_WWW}/releases && "
            f"chown -R nginx:nginx {REMOTE_WWW} 2>/dev/null || chown -R www-data:www-data {REMOTE_WWW} || true && "
            f"chcon -R -t httpd_sys_content_t {REMOTE_WWW} 2>/dev/null || true && "
            f"restorecon -Rv {REMOTE_WWW} 2>/dev/null || true && "
            f"ls -la {REMOTE_WWW} | head -20 && ls -lh {REMOTE_RELEASES} 2>/dev/null | head -10 || true",
        )
        run(client, "nginx -t && systemctl reload nginx")
        run(
            client,
            f"curl -skf -o /dev/null -w '%{{http_code}}\\n' --resolve {DOMAIN}:443:127.0.0.1 https://{DOMAIN}/ "
            f"|| curl -sf -o /dev/null -w '%{{http_code}}\\n' -H 'Host: {DOMAIN}' http://127.0.0.1/",
        )

        print("\nDEPLOY_OK")
        print(f"  1ONE Work: https://{DOMAIN}/")
        return 0
    finally:
        client.close()
        try:
            tarball.unlink(missing_ok=True)
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
