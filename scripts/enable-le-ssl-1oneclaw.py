#!/usr/bin/env python3
"""Ensure Let's Encrypt SSL for all 1oneclaw hosts on the production box.

Domains (today's four sites):
  - ai.1oneclaw.com       (OneRoute landing)
  - claw.1oneclaw.com     (OpenClaw landing)
  - work.1oneclaw.com     (1ONE Work landing)
  - operone.1oneclaw.com  (Operone app)

Usage (from game repo root):
  python scripts/enable-le-ssl-1oneclaw.py
  python scripts/enable-le-ssl-1oneclaw.py --domains ai.1oneclaw.com claw.1oneclaw.com
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, print_target, run, run_output

DEFAULT_DOMAINS = [
    "ai.1oneclaw.com",
    "claw.1oneclaw.com",
    "work.1oneclaw.com",
    "operone.1oneclaw.com",
]


def has_cert(client, domain: str) -> bool:
    _, out = run_output(
        client,
        f"test -f /etc/letsencrypt/live/{domain}/fullchain.pem && echo YES || echo NO",
    )
    return "YES" in (out or "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domains", nargs="+", default=DEFAULT_DOMAINS)
    args = parser.parse_args()

    print_target("Let's Encrypt SSL for 1oneclaw hosts")
    client = connect()
    try:
        run(
            client,
            "command -v certbot >/dev/null || "
            "(dnf install -y epel-release && dnf install -y certbot python3-certbot-nginx)",
        )
        for domain in args.domains:
            domain = domain.strip()
            if not domain:
                continue
            if has_cert(client, domain):
                print(f"OK already: {domain}")
                continue
            code = run(
                client,
                "certbot --nginx -d "
                + domain
                + " --non-interactive --agree-tos --register-unsafely-without-email --redirect",
            )
            if code != 0:
                print(f"FAIL: {domain}")
                return code
        run(client, "systemctl enable --now certbot-renew.timer")
        run(client, "nginx -t && systemctl reload nginx")
        for domain in args.domains:
            run(
                client,
                f"curl -skI --resolve {domain}:443:127.0.0.1 https://{domain}/ | head -5",
            )
        print("\nSSL_OK")
        for d in args.domains:
            print(f"  https://{d}/")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
