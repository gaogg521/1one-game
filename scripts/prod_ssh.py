"""Shared SSH configuration for production deploy / migration scripts.

Environment variables (all optional except password when not in fallback file):
  OPERONE_DEPLOY_HOST      — default 43.163.105.71
  OPERONE_DEPLOY_USER      — default root
  OPERONE_DEPLOY_REPO      — default /opt/operone
  OPERONE_DEPLOY_APP_PORT  — default 80
  OPERONE_DEPLOY_PASSWORD  — SSH password (preferred)
  OPERONE_DEPLOY_DOMAIN    — e.g. operone.1oneclaw.com (logging only)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

DEFAULT_HOST = "43.163.105.71"
DEFAULT_USER = "root"
DEFAULT_REPO = "/opt/operone"
DEFAULT_APP_PORT = "80"
DEFAULT_DOMAIN = "operone.1oneclaw.com"

_SCRIPTS_DIR = Path(__file__).resolve().parent


def deploy_host() -> str:
    return __import__("os").environ.get("OPERONE_DEPLOY_HOST", DEFAULT_HOST).strip()


def deploy_user() -> str:
    return __import__("os").environ.get("OPERONE_DEPLOY_USER", DEFAULT_USER).strip()


def deploy_repo() -> str:
    return __import__("os").environ.get("OPERONE_DEPLOY_REPO", DEFAULT_REPO).strip()


def deploy_app_port() -> str:
    return __import__("os").environ.get("OPERONE_DEPLOY_APP_PORT", DEFAULT_APP_PORT).strip()


def deploy_domain() -> str:
    return __import__("os").environ.get("OPERONE_DEPLOY_DOMAIN", DEFAULT_DOMAIN).strip()


def load_password() -> str:
    if pw := __import__("os").environ.get("OPERONE_DEPLOY_PASSWORD"):
        return pw
    fallback = _SCRIPTS_DIR / "upload-literary-samples-to-server.py"
    if fallback.is_file():
        m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', fallback.read_text(encoding="utf-8"), re.M)
        if m and m.group(1):
            return m.group(1)
    print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
    raise SystemExit(1)


def connect(
    host: str | None = None,
    user: str | None = None,
    password: str | None = None,
    timeout: int = 30,
) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        host or deploy_host(),
        22,
        user or deploy_user(),
        password or load_password(),
        timeout=timeout,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> int:
    print("\n>>>", cmd[:240])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(combined[-8000:])
    print(f"[exit {code}]")
    return code


def run_output(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str]:
    print("\n>>>", cmd[:240])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace").strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-4000:])
    print(f"[exit {code}]")
    return code, out


def print_target(prefix: str = "") -> None:
    label = f"{prefix} " if prefix else ""
    print(
        f"{label}target {deploy_user()}@{deploy_host()} repo={deploy_repo()} port={deploy_app_port()}",
        flush=True,
    )
