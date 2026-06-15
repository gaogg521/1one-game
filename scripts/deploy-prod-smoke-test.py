#!/usr/bin/env python3
"""Production smoke test on CentOS deploy server (SSH)."""
from __future__ import annotations

import json
import os
import sys

import paramiko

HOST = os.environ.get("OPERONE_DEPLOY_HOST", "43.163.105.71")
USER = os.environ.get("OPERONE_DEPLOY_USER", "root")
PASSWORD = os.environ.get("OPERONE_DEPLOY_PASSWORD", "")
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str]:
    print("\n>>>", cmd[:200])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(combined[-4000:] if len(combined) > 4000 else combined)
    print(f"[exit {code}]")
    return code, combined


def parse_json_line(text: str) -> dict:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    return {}


def main() -> int:
    if not PASSWORD:
        pw_file = os.path.join(os.path.dirname(__file__), "upload-literary-samples-to-server.py")
        if os.path.isfile(pw_file):
            import re

            raw = open(pw_file, encoding="utf-8").read()
            m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', raw, re.M)
            password = m.group(1) if m else ""
        else:
            print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
            return 2
        if not password:
            print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
            return 2
    else:
        password = PASSWORD

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, password, timeout=30, allow_agent=False, look_for_keys=False)

    local_df = os.path.join(REPO_ROOT, "scripts", "deploy", "Dockerfile.godot")
    sftp = client.open_sftp()
    sftp.put(local_df, "/opt/operone/scripts/deploy/Dockerfile.godot")
    sftp.close()
    print("Uploaded Dockerfile.godot")

    results: list[tuple[str, bool]] = []

    code, text = run(
        client,
        "cd /opt/operone && docker build --no-cache -f scripts/deploy/Dockerfile.godot -t operone-godot:4.4.1 .",
        timeout=3600,
    )
    results.append(("godot docker build", code == 0))

    code, text = run(client, "docker run --rm operone-godot:4.4.1 --version")
    results.append(("godot docker --version", code == 0 and "4.4.1" in text))

    code, text = run(client, "cd /opt/operone && sudo -u www-data bash scripts/godot-docker-run.sh . --version")
    results.append(("www-data godot-docker-run", code == 0 and "4.4.1" in text))

    http_checks: list[tuple[str, str, callable[[str], bool] | None]] = [
        ("health", "curl -sf http://127.0.0.1:6666/api/health", lambda t: "db" in t.lower() or "ok" in t.lower()),
        (
            "session anon",
            "curl -sf http://127.0.0.1:6666/api/auth/session",
            lambda t: parse_json_line(t).get("user") is None,
        ),
        (
            "novel list",
            "curl -sf 'http://127.0.0.1:6666/api/novel?limit=1'",
            lambda t: parse_json_line(t).get("total", 0) >= 1,
        ),
        (
            "comic list",
            "curl -sf 'http://127.0.0.1:6666/api/comic?limit=1'",
            lambda t: parse_json_line(t).get("total", 0) >= 1,
        ),
        ("discover", "curl -sf http://127.0.0.1:6666/api/discover", lambda t: len(t) > 10),
        ("homepage", "curl -sfL -o /dev/null -w '%{http_code}' http://127.0.0.1:6666/", lambda t: "200" in t),
        ("public health", "curl -sf --max-time 10 http://127.0.0.1:6666/api/health", lambda t: '"ok":true' in t),
    ]

    for name, cmd, validator in http_checks:
        code, text = run(client, cmd)
        ok = code == 0 and (validator(text) if validator else True)
        results.append((name, ok))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")

    code, text = run(client, "systemctl is-active operone")
    results.append(("systemd operone active", code == 0 and "active" in text))

    code, text = run(client, "grep GODOT_USE_DOCKER /etc/systemd/system/operone.service || true")
    results.append(("GODOT_USE_DOCKER=1", "GODOT_USE_DOCKER=1" in text))

    code, text = run(
        client,
        "test -d /opt/operone/.local/share/godot/export_templates/4.4.1.stable && echo TEMPLATES_OK",
    )
    results.append(("godot export templates", code == 0 and "TEMPLATES_OK" in text))

    code, text = run(client, "sudo -u www-data docker ps >/dev/null 2>&1 && echo DOCKER_OK")
    results.append(("www-data can docker", code == 0 and "DOCKER_OK" in text))

    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"\n======== SUMMARY: {passed}/{total} passed ========")
    for name, ok in results:
        print(f"  {'PASS' if ok else 'FAIL'} {name}")

    client.close()
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
