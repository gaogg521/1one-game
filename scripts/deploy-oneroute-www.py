#!/usr/bin/env python3
"""Deploy OneRoute ads landing page → ai.1oneclaw.com (static + HTTPS).

CTAs on the page always open https://ai.oneroute.vip/ (product), not this host.

SSL: Let's Encrypt via certbot (same free CA family as common public HTTPS sites).
Redeploys preserve /etc/nginx/conf.d/oneroute-www.conf when a live cert exists.

Prereq:
  - npm run build in D:/website/oneroute
  - DNS A: ai.1oneclaw.com → server IP
  - scripts/deploy.local.env
  - (once) certbot + python3-certbot-nginx on the server

Usage:
  python scripts/deploy-oneroute-www.py
  python scripts/deploy-oneroute-www.py --ensure-ssl   # issue/renew LE if missing
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

DEFAULT_DIST = Path(r"D:\website\oneroute\dist")
REMOTE_WWW = "/opt/website-oneroute"
DOMAIN = "ai.1oneclaw.com"
NGINX_PATH = "/etc/nginx/conf.d/oneroute-www.conf"


def nginx_http_only(domain: str) -> str:
    return f"""\
server {{
    listen 80;
    listen [::]:80;
    server_name {domain};

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


def nginx_with_le(domain: str) -> str:
    return f"""\
server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {domain};

    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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

server {{
    listen 80;
    listen [::]:80;
    server_name {domain};
    return 301 https://$host$request_uri;
}}
"""


def pack_dist(dist: Path) -> Path:
    if not dist.is_dir() or not (dist / "index.html").is_file():
        raise SystemExit(f"Missing {dist}/index.html — run npm run build in D:/website/oneroute")
    tmp = Path(tempfile.mkstemp(suffix=".tar.gz", prefix="oneroute-www-")[1])
    with tarfile.open(tmp, "w:gz") as tar:
        for p in dist.rglob("*"):
            if p.is_file():
                tar.add(p, arcname=p.relative_to(dist).as_posix())
    print(f"Packed {dist} ({tmp.stat().st_size / 1024:.0f} KB)")
    return tmp


def remote_has_cert(client, domain: str) -> bool:
    code, out = run_output(
        client,
        f"test -f /etc/letsencrypt/live/{domain}/fullchain.pem && echo YES || echo NO",
    )
    return "YES" in (out or "")


def ensure_ssl(client, domain: str) -> None:
    run(
        client,
        "command -v certbot >/dev/null || "
        "(dnf install -y epel-release && dnf install -y certbot python3-certbot-nginx)",
    )
    if remote_has_cert(client, domain):
        print(f"SSL cert already present for {domain}")
        return
    run(
        client,
        "certbot --nginx -d "
        + domain
        + " --non-interactive --agree-tos --register-unsafely-without-email --redirect",
    )
    run(client, "systemctl enable --now certbot-renew.timer")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST)
    parser.add_argument("--domain", default=DOMAIN)
    parser.add_argument(
        "--ensure-ssl",
        action="store_true",
        help="Install certbot if needed and obtain Let's Encrypt cert",
    )
    parser.add_argument(
        "--force-nginx",
        action="store_true",
        help="Rewrite nginx conf even when cert exists (uses LE paths if cert present)",
    )
    args = parser.parse_args()

    domain = args.domain.strip()

    print_target("oneroute landing deploy")
    tarball = pack_dist(args.dist.resolve())
    client = connect()
    try:
        run(client, f"mkdir -p {REMOTE_WWW} /opt/data")
        sftp = client.open_sftp()
        sftp.put(str(tarball), "/opt/data/oneroute-www.tar.gz")

        has_cert = remote_has_cert(client, domain)
        if args.force_nginx or not has_cert:
            conf = nginx_with_le(domain) if has_cert else nginx_http_only(domain)
            sftp.putfo(io.BytesIO(conf.encode("utf-8")), NGINX_PATH)
            print(f"Wrote {NGINX_PATH} ({'https' if has_cert else 'http'})")
        else:
            print(f"Keeping existing {NGINX_PATH} (HTTPS/certbot managed)")
        sftp.close()

        run(
            client,
            f"rm -rf {REMOTE_WWW}/* && tar -xzf /opt/data/oneroute-www.tar.gz -C {REMOTE_WWW} && "
            f"chown -R nginx:nginx {REMOTE_WWW} 2>/dev/null || true && "
            f"chcon -R -t httpd_sys_content_t {REMOTE_WWW} 2>/dev/null || true && "
            f"ls {REMOTE_WWW} | head",
        )
        run(client, "nginx -t && systemctl reload nginx")

        if args.ensure_ssl:
            ensure_ssl(client, domain)
            # After first cert issue, rewrite conf to our clean HTTPS template
            if remote_has_cert(client, domain):
                sftp = client.open_sftp()
                sftp.putfo(io.BytesIO(nginx_with_le(domain).encode("utf-8")), NGINX_PATH)
                sftp.close()
                run(client, "nginx -t && systemctl reload nginx")

        run(
            client,
            f"curl -sf -o /dev/null -w '%{{http_code}}\\n' "
            f"--resolve {domain}:443:127.0.0.1 https://{domain}/ "
            f"|| curl -sf -o /dev/null -w '%{{http_code}}\\n' -H 'Host: {domain}' http://127.0.0.1/",
        )
        print(f"\nDEPLOY_OK  https://{domain}/")
        print("  CTA targets → https://ai.oneroute.vip/")
        return 0
    finally:
        client.close()
        try:
            tarball.unlink(missing_ok=True)
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
