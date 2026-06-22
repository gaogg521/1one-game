"""Shared SSH configuration for production deploy / migration scripts.

Secrets and host-specific values must NOT live in git. Configure via:

  1. Environment variables (preferred in CI), or
  2. Local file `scripts/deploy.local.env` (copy from deploy.local.env.example)

Required:
  OPERONE_DEPLOY_HOST
  OPERONE_DEPLOY_PASSWORD  — unless OPERONE_DEPLOY_KEY_PATH is set

Optional:
  OPERONE_DEPLOY_USER      — default root
  OPERONE_DEPLOY_REPO      — default /opt/operone
  OPERONE_DEPLOY_APP_PORT  — default 80
  OPERONE_DEPLOY_DOMAIN    — logging only
  OPERONE_DEPLOY_KEY_PATH  — SSH private key (instead of password)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

DEFAULT_USER = "root"
DEFAULT_REPO = "/opt/operone"
DEFAULT_APP_PORT = "80"

_SCRIPTS_DIR = Path(__file__).resolve().parent
_LOCAL_ENV = _SCRIPTS_DIR / "deploy.local.env"
_loaded_local = False


def _load_local_env() -> None:
    global _loaded_local
    if _loaded_local:
        return
    _loaded_local = True
    if not _LOCAL_ENV.is_file():
        return
    for line in _LOCAL_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _require(name: str) -> str:
    _load_local_env()
    val = os.environ.get(name, "").strip()
    if not val:
        print(
            f"Missing {name}. Set environment variable or add to scripts/deploy.local.env "
            f"(see scripts/deploy.local.env.example)",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return val


def _optional(name: str, default: str = "") -> str:
    _load_local_env()
    return os.environ.get(name, default).strip() or default


def deploy_host() -> str:
    return _require("OPERONE_DEPLOY_HOST")


def deploy_user() -> str:
    return _optional("OPERONE_DEPLOY_USER", DEFAULT_USER)


def deploy_repo() -> str:
    return _optional("OPERONE_DEPLOY_REPO", DEFAULT_REPO)


def deploy_app_port() -> str:
    return _optional("OPERONE_DEPLOY_APP_PORT", DEFAULT_APP_PORT)


def deploy_domain() -> str:
    return _optional("OPERONE_DEPLOY_DOMAIN")


def deploy_key_path() -> str | None:
    p = _optional("OPERONE_DEPLOY_KEY_PATH")
    return p or None


def load_password() -> str:
    _load_local_env()
    if deploy_key_path():
        return ""
    return _require("OPERONE_DEPLOY_PASSWORD")


def site_url() -> str:
    """Human-readable base URL for logs (domain if set, else http://host)."""
    domain = deploy_domain()
    if domain:
        return f"https://{domain}" if not domain.startswith("http") else domain
    port = deploy_app_port()
    host = deploy_host()
    if port in ("80", "443"):
        return f"http://{host}"
    return f"http://{host}:{port}"


def connect(
    host: str | None = None,
    user: str | None = None,
    password: str | None = None,
    timeout: int = 30,
) -> paramiko.SSHClient:
    _load_local_env()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key_path = deploy_key_path()
    connect_kwargs: dict = {
        "hostname": host or deploy_host(),
        "port": 22,
        "username": user or deploy_user(),
        "timeout": timeout,
        "allow_agent": False,
        "look_for_keys": False,
    }
    if key_path:
        connect_kwargs["key_filename"] = key_path
    else:
        connect_kwargs["password"] = password if password is not None else load_password()
    client.connect(**connect_kwargs)
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
    _load_local_env()
    label = f"{prefix} " if prefix else ""
    try:
        host = deploy_host()
    except SystemExit:
        host = "(unset OPERONE_DEPLOY_HOST)"
    print(
        f"{label}target {deploy_user()}@{host} repo={deploy_repo()} port={deploy_app_port()}",
        flush=True,
    )


def shell_source_env(repo: str | None = None) -> str:
    """Bash snippet to source .env without Windows CRLF breaking systemd-style scripts."""
    r = repo or deploy_repo()
    return f"set -a && . <(sed 's/\\r$//' {r}/.env) && set +a"


def ensure_git_safe(
    client: paramiko.SSHClient,
    repo: str | None = None,
    app_user: str = "www-data",
) -> None:
    """Avoid 'dubious ownership' when root runs git in www-data-owned repo."""
    r = repo or deploy_repo()
    run(client, f"git config --global --add safe.directory {r} 2>/dev/null || true", timeout=30)
    run(
        client,
        f"runuser -u {app_user} -- git config --global --add safe.directory {r} 2>/dev/null || true",
        timeout=30,
    )


def sanitize_remote_env(client: paramiko.SSHClient, repo: str | None = None) -> None:
    """Strip CRLF and Windows-only Prisma engine setting on server."""
    r = repo or deploy_repo()
    run(
        client,
        f"sed -i 's/\\r$//' {r}/.env 2>/dev/null; "
        f"sed -i '/^PRISMA_CLIENT_ENGINE_TYPE=/d' {r}/.env 2>/dev/null || true",
        timeout=30,
    )
