#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Operone 一键部署 — 空机只需一条命令，装完改 .env 即可
#
#    curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
#
#  也支持：sudo bash install.sh
#  已部署过再次执行 = 自动更新版本
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
OPERONE_USER="${OPERONE_USER:-www-data}"
OPERONE_INSTALL_URL="${OPERONE_INSTALL_URL:-https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh}"
OPERONE_DEFAULT_GIT_REPO="${OPERONE_DEFAULT_GIT_REPO:-https://github.com/gaogg521/1one-game.git}"
GIT_REPO="${GIT_REPO:-$OPERONE_DEFAULT_GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"

log() { printf '\033[1;36m[一键部署]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[一键部署]\033[0m %s\n' "$*" >&2; exit 1; }

# curl | bash 时 BASH_SOURCE 不可用，需重新下载自身再 sudo 执行
ensure_root() {
  [[ "$(id -u)" -eq 0 ]] && return 0
  local src="${BASH_SOURCE[0]:-}"
  if [[ -n "$src" && -f "$src" ]]; then
    exec sudo -E bash "$src" "$@"
  fi
  log "需要 root 权限，正在提权 …"
  local tmp
  tmp="$(mktemp /tmp/operone-install.XXXXXX.sh)"
  curl -fsSL "$OPERONE_INSTALL_URL" -o "$tmp"
  chmod +x "$tmp"
  exec sudo -E bash "$tmp" "$@"
}

ensure_root "$@"

FULL_SH="$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh"
export NON_INTERACTIVE=1
export OPERONE_BOOTSTRAPPED=1

# 已部署 → 自动更新，无需用户记命令
if [[ -f "$FULL_SH" ]] && systemctl is-active --quiet operone 2>/dev/null; then
  log "检测到已有运行中的服务，自动更新 …"
  exec bash "$FULL_SH" --update "$@"
fi

# 已有代码目录 → 继续完成安装
if [[ -f "$FULL_SH" ]]; then
  log "继续安装 …"
  exec bash "$FULL_SH" "$@"
fi

log "Operone 一键部署开始"
log "拉取代码: $GIT_REPO → $OPERONE_DIR"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl ca-certificates git

id "$OPERONE_USER" &>/dev/null || useradd --system --home "$OPERONE_DIR" --shell /usr/sbin/nologin "$OPERONE_USER"

if [[ -d "$OPERONE_DIR" ]]; then
  if [[ -d "$OPERONE_DIR/.git" ]]; then
    log "代码目录已存在"
  elif [[ -n "$(ls -A "$OPERONE_DIR" 2>/dev/null)" ]]; then
    die "$OPERONE_DIR 非空，请清空后重试或设置 OPERONE_DIR 到其他路径"
  else
    rm -rf "$OPERONE_DIR"
  fi
fi

if [[ ! -f "$FULL_SH" ]]; then
  mkdir -p "$(dirname "$OPERONE_DIR")"
  git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
  chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
fi

exec bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" "$@"
