#!/usr/bin/env python3
"""Deploy OpenClaw marketing site (Vite static) + Nginx dual-host split.

Hosts (same server IP):
  claw.1oneclaw.com    →  /opt/website-display  (static)
  operone.1oneclaw.com →  127.0.0.1:8888        (Operone)

Prereq: local build of D:/website/openclaw/www → dist/
         scripts/deploy.local.env configured

Usage (from game repo root):
  python scripts/deploy-openclaw-www.py
  python scripts/deploy-openclaw-www.py --dist D:/website/openclaw/www/dist
"""
from __future__ import annotations

import argparse
import io
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run, run_output

DEFAULT_DIST = Path(r"D:\website\openclaw\www\dist")
REMOTE_WWW = "/opt/website-display"
OPERONE_INTERNAL_PORT = "8888"

NGINX_DEFAULT = """\
# Rocky/RHEL: conf.d includes this if present.
# Keep default server empty / fall through to host-based configs.
"""

NGINX_ONECLAW = f"""\
server {{
    listen 80;
    listen [::]:80;
    server_name claw.1oneclaw.com;

    root {REMOTE_WWW};
    index index.html;

    # Static assets long-cache; HTML no-cache
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

NGINX_OPERONE = f"""\
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name operone.1oneclaw.com;

    client_max_body_size 64m;

    location / {{
        proxy_pass http://127.0.0.1:{OPERONE_INTERNAL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }}
}}
"""


def pack_dist(dist: Path) -> Path:
    if not dist.is_dir() or not (dist / "index.html").is_file():
        raise SystemExit(f"Missing built site: {dist}/index.html — run npm run build first")
    tmp = Path(tempfile.mkstemp(suffix=".tar.gz", prefix="openclaw-www-")[1])
    with tarfile.open(tmp, "w:gz") as tar:
        for p in dist.rglob("*"):
            if p.is_file():
                tar.add(p, arcname=p.relative_to(dist).as_posix())
    mb = tmp.stat().st_size / 1024 / 1024
    print(f"Packed {dist} → {tmp.name} ({mb:.2f} MB)")
    return tmp


def put_text(sftp, remote: str, content: str) -> None:
    bio = io.BytesIO(content.encode("utf-8"))
    sftp.putfo(bio, remote)


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy OpenClaw www + Nginx split")
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST)
    parser.add_argument("--skip-nginx", action="store_true", help="Only upload static files")
    parser.add_argument(
        "--force-nginx",
        action="store_true",
        help="Rewrite nginx conf even if Let's Encrypt certs exist (would drop HTTPS until re-run enable-le-ssl)",
    )
    args = parser.parse_args()

    print_target("openclaw www deploy")
    tarball = pack_dist(args.dist.resolve())
    client = connect()
    repo = deploy_repo()
    try:
        # 1) Upload static site
        run(client, f"mkdir -p {REMOTE_WWW} /opt/data")
        remote_tar = "/opt/data/openclaw-www.tar.gz"
        sftp = client.open_sftp()
        print(f"Uploading → {remote_tar}")
        sftp.put(str(tarball), remote_tar)
        sftp.close()
        run(
            client,
            f"rm -rf {REMOTE_WWW}/* && tar -xzf {remote_tar} -C {REMOTE_WWW} && "
            f"chown -R nginx:nginx {REMOTE_WWW} 2>/dev/null || chown -R www-data:www-data {REMOTE_WWW} || true && "
            f"ls -la {REMOTE_WWW} | head -20",
        )

        if args.skip_nginx:
            print("SKIP nginx setup")
            return 0

        # 2) Install nginx
        code, _ = run_output(client, "command -v nginx")
        if code != 0:
            code_i, _ = run_output(
                client,
                "dnf install -y nginx || yum install -y nginx",
                timeout=300,
            )
            if code_i != 0:
                run(client, "apt-get update && apt-get install -y nginx", timeout=300)

        # 3) Move Operone off :80 → 127.0.0.1:8888
        run(
            client,
            f"cd {repo} && "
            f"(grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={OPERONE_INTERNAL_PORT}|' .env || echo 'PORT={OPERONE_INTERNAL_PORT}' >> .env) && "
            f"(grep -q '^HOSTNAME=' .env && sed -i 's|^HOSTNAME=.*|HOSTNAME=127.0.0.1|' .env || echo 'HOSTNAME=127.0.0.1' >> .env) && "
            f"grep -E '^(PORT|HOSTNAME)=' .env",
        )
        run(client, "systemctl stop operone || true")

        # 4) Write nginx site configs — skip if LE certs already manage HTTPS
        _, claw_cert = run_output(
            client,
            "test -f /etc/letsencrypt/live/claw.1oneclaw.com/fullchain.pem && echo YES || echo NO",
        )
        _, op_cert = run_output(
            client,
            "test -f /etc/letsencrypt/live/operone.1oneclaw.com/fullchain.pem && echo YES || echo NO",
        )
        sftp = client.open_sftp()
        if args.force_nginx or "YES" not in (claw_cert or ""):
            put_text(sftp, "/etc/nginx/conf.d/1oneclaw-www.conf", NGINX_ONECLAW)
            print("Wrote 1oneclaw-www.conf")
        else:
            print("Keeping 1oneclaw-www.conf (HTTPS/certbot managed)")
        if args.force_nginx or "YES" not in (op_cert or ""):
            put_text(sftp, "/etc/nginx/conf.d/operone.conf", NGINX_OPERONE)
            print("Wrote operone.conf")
        else:
            print("Keeping operone.conf (HTTPS/certbot managed)")
        # Remove noisy default if present
        try:
            sftp.remove("/etc/nginx/conf.d/default.conf")
        except OSError:
            pass
        sftp.close()

        # SELinux: allow nginx proxy + read web root
        run(
            client,
            "setsebool -P httpd_can_network_connect 1 2>/dev/null || true; "
            f"chcon -R -t httpd_sys_content_t {REMOTE_WWW} 2>/dev/null || true; "
            f"restorecon -Rv {REMOTE_WWW} 2>/dev/null || true",
        )

        run(client, "nginx -t")
        run(client, "systemctl enable nginx && systemctl restart nginx")
        run(client, "systemctl start operone && sleep 8")

        # 5) Verify
        checks = [
            f"curl -skf -o /dev/null -w '%{{http_code}}' --resolve claw.1oneclaw.com:443:127.0.0.1 https://claw.1oneclaw.com/ "
            f"|| curl -sf -o /dev/null -w '%{{http_code}}' -H 'Host: claw.1oneclaw.com' http://127.0.0.1/",
            f"curl -skf -o /dev/null -w '%{{http_code}}' --resolve operone.1oneclaw.com:443:127.0.0.1 https://operone.1oneclaw.com/api/health "
            f"|| curl -sf -o /dev/null -w '%{{http_code}}' -H 'Host: operone.1oneclaw.com' http://127.0.0.1/api/health",
            f"curl -sf http://127.0.0.1:{OPERONE_INTERNAL_PORT}/api/health",
            "systemctl is-active nginx operone",
        ]
        for cmd in checks:
            run(client, cmd)

        print("\nDEPLOY_OK")
        print("  Marketing: https://claw.1oneclaw.com/")
        print("  Operone:   https://operone.1oneclaw.com/")
        return 0
    finally:
        client.close()
        try:
            tarball.unlink(missing_ok=True)
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
