#!/usr/bin/env python3
"""Production smoke test on deploy server (SSH)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run_output

REPO_ROOT = Path(__file__).resolve().parent.parent


def parse_json_line(text: str) -> dict:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    return {}


def godot_uses_docker(client) -> bool:
    """Docker Godot export is legacy CentOS 7 only; Rocky/Ubuntu use native GODOT_BIN."""
    code, text = run_output(
        client,
        "grep -q 'GODOT_USE_DOCKER=1' /etc/systemd/system/operone.service 2>/dev/null && echo docker_mode",
    )
    return code == 0 and "docker_mode" in text


def main() -> int:
    remote = deploy_repo()
    port = deploy_app_port()
    base = f"http://127.0.0.1:{port}"
    print_target("production smoke test")
    client = connect()

    results: list[tuple[str, bool]] = []
    use_docker = godot_uses_docker(client)

    if use_docker:
        local_df = REPO_ROOT / "scripts" / "deploy" / "Dockerfile.godot"
        sftp = client.open_sftp()
        sftp.put(str(local_df), f"{remote}/scripts/deploy/Dockerfile.godot")
        sftp.close()
        print("Godot export: Docker (CentOS 7 legacy)")

        code, text = run_output(
            client,
            f"cd {remote} && docker build --no-cache -f scripts/deploy/Dockerfile.godot -t operone-godot:4.4.1 .",
            timeout=3600,
        )
        results.append(("godot docker build", code == 0))

        code, text = run_output(client, "docker run --rm operone-godot:4.4.1 --version")
        results.append(("godot docker --version", code == 0 and "4.4.1" in text))

        code, text = run_output(
            client, f"cd {remote} && sudo -u www-data bash scripts/godot-docker-run.sh . --version"
        )
        results.append(("www-data godot-docker-run", code == 0 and "4.4.1" in text))

        code, text = run_output(client, "sudo -u www-data docker ps >/dev/null 2>&1 && echo DOCKER_OK")
        results.append(("www-data can docker", code == 0 and "DOCKER_OK" in text))
    else:
        print("Godot export: native binary (no Docker required)")
        code, text = run_output(
            client,
            "grep GODOT_BIN= /etc/systemd/system/operone.service 2>/dev/null | head -1",
        )
        m = None
        for part in text.strip().split():
            if part.startswith("GODOT_BIN="):
                m = part.split("=", 1)[1]
                break
        if not m and "GODOT_BIN=" in text:
            m = text.strip().split("GODOT_BIN=", 1)[1].split()[0]
        godot_bin = m or ""
        if godot_bin:
            code, text = run_output(client, f"test -x {godot_bin} && {godot_bin} --version 2>&1 | head -1")
            results.append(("godot native --version", code == 0 and "4.4.1" in text))
        else:
            results.append(("godot native --version", False))

    http_checks: list[tuple[str, str, callable[[str], bool] | None]] = [
        ("health", f"curl -sf {base}/api/health", lambda t: "db" in t.lower() or "ok" in t.lower()),
        (
            "session anon",
            f"curl -sf {base}/api/auth/session",
            lambda t: parse_json_line(t).get("user") is None,
        ),
        (
            "novel list",
            f"curl -sf '{base}/api/novel?limit=1'",
            lambda t: parse_json_line(t).get("total", 0) >= 1,
        ),
        (
            "comic list",
            f"curl -sf '{base}/api/comic?limit=1'",
            lambda t: parse_json_line(t).get("total", 0) >= 1,
        ),
        ("discover", f"curl -sf {base}/api/discover", lambda t: len(t) > 10),
        ("homepage", f"curl -sfL -o /dev/null -w '%{{http_code}}' {base}/", lambda t: "200" in t),
        ("public health", f"curl -sf --max-time 10 {base}/api/health", lambda t: '"ok":true' in t),
    ]

    for name, cmd, validator in http_checks:
        code, text = run_output(client, cmd)
        ok = code == 0 and (validator(text) if validator else True)
        results.append((name, ok))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")

    code, text = run_output(client, "systemctl is-active operone")
    results.append(("systemd operone active", code == 0 and "active" in text))

    code, text = run_output(
        client,
        f"test -d {remote}/.local/share/godot/export_templates/4.4.1.stable && echo TEMPLATES_OK",
    )
    results.append(("godot export templates", code == 0 and "TEMPLATES_OK" in text))

    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"\n======== SUMMARY: {passed}/{total} passed ========")
    for name, ok in results:
        print(f"  {'PASS' if ok else 'FAIL'} {name}")

    client.close()
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
