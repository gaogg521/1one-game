#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Operone 一键部署 — 空机只需一条命令，装完改 .env 即可
#
#    curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
#
#  支持：Ubuntu / Debian / CentOS / RHEL / Rocky / AlmaLinux
#  已部署过再次执行 = 自动更新版本
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
OPERONE_USER="${OPERONE_USER:-www-data}"
OPERONE_INSTALL_URL="${OPERONE_INSTALL_URL:-https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh}"
OPERONE_RAW_BASE="${OPERONE_RAW_BASE:-https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy}"
OPERONE_DEFAULT_GIT_REPO="${OPERONE_DEFAULT_GIT_REPO:-https://github.com/gaogg521/1one-game.git}"
GIT_REPO="${GIT_REPO:-$OPERONE_DEFAULT_GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"

log() { printf '\033[1;36m[一键部署]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[一键部署]\033[0m %s\n' "$*" >&2; exit 1; }

load_os_lib() {
  local lib_path=""
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    local dir
    dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$dir/lib/os-lib.sh" ]]; then
      lib_path="$dir/lib/os-lib.sh"
    fi
  fi
  if [[ -z "$lib_path" ]]; then
    lib_path="$(mktemp /tmp/operone-os-lib.XXXXXX.sh)"
    if ! curl -fsSL "${OPERONE_RAW_BASE}/lib/os-lib.sh" -o "$lib_path" 2>/dev/null; then
      # 仓库尚未同步 os-lib 时的最小兜底（CentOS/Ubuntu 装 git/curl）
      cat > "$lib_path" <<'FALLBACK'
os_die() { printf '[operone-deploy] ERROR: %s\n' "$*" >&2; exit 1; }
os_load_release() { [[ -f /etc/os-release ]] && . /etc/os-release; OS_ID=${ID:-}; OS_VERSION_ID=${VERSION_ID:-}; OS_PRETTY_NAME=${PRETTY_NAME:-unknown}; OS_VERSION_MAJOR=${VERSION_ID%%.*}; }
os_detect() {
  OS_FAMILY=""; PKG_MGR=""
  os_load_release
  case "${OS_ID:-}" in ubuntu|debian) OS_FAMILY=debian; PKG_MGR=apt ;; centos|rhel|rocky|almalinux|ol|fedora|amzn) OS_FAMILY=rhel ;; esac
  command -v apt-get >/dev/null 2>&1 && OS_FAMILY=debian PKG_MGR=apt
  command -v dnf >/dev/null 2>&1 && OS_FAMILY=rhel PKG_MGR=dnf
  command -v yum >/dev/null 2>&1 && OS_FAMILY=rhel PKG_MGR=yum
  [[ -n "$OS_FAMILY" ]] || os_die "不支持的系统"
}
os_validate() { os_detect; }
os_print_info() { os_detect; echo "  发行版: $OS_PRETTY_NAME ($OS_ID $OS_VERSION_ID) · $PKG_MGR"; }
os_check_network() { curl -fsSL --max-time 15 https://github.com >/dev/null || os_die "网络不可用"; }
os_preflight() { os_validate; os_print_info; os_check_network; }
pkg_update() { case "$PKG_MGR" in apt) DEBIAN_FRONTEND=noninteractive apt-get update -qq ;; dnf) dnf makecache -q ;; yum) yum makecache -q || true ;; esac; }
pkg_install() { case "$PKG_MGR" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" ;; dnf) dnf install -y "$@" ;; yum) yum install -y "$@" ;; esac; }
install_bootstrap_pkgs() { os_detect; pkg_update; pkg_install curl ca-certificates git; }
ensure_app_user() {
  local user="$1" home="$2"
  id "$user" &>/dev/null && return 0
  useradd --system -d "$home" --shell /sbin/nologin "$user" 2>/dev/null || useradd --system --home-dir "$home" --shell /sbin/nologin "$user"
}
FALLBACK
    fi
  fi
  # shellcheck source=/dev/null
  source "$lib_path"
}

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

# 已部署 → 自动更新
if [[ -f "$FULL_SH" ]] && systemctl is-active --quiet operone 2>/dev/null; then
  log "检测到已有运行中的服务，自动更新 …"
  exec bash "$FULL_SH" --update "$@"
fi

if [[ -f "$FULL_SH" ]]; then
  log "继续安装 …"
  exec bash "$FULL_SH" "$@"
fi

log "Operone 一键部署开始"
log "拉取代码: $GIT_REPO → $OPERONE_DIR"

load_os_lib
os_preflight
install_bootstrap_pkgs
ensure_app_user "$OPERONE_USER" "$OPERONE_DIR"

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
