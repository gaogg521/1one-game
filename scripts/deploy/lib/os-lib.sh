#!/usr/bin/env bash
# Operone 部署 — 跨发行版包管理（Ubuntu/Debian + CentOS/RHEL/Rocky/Alma）
# 由 install.sh / ubuntu-deploy-lib.sh 引用

OS_FAMILY="${OS_FAMILY:-}"   # debian | rhel
PKG_MGR="${PKG_MGR:-}"       # apt | dnf | yum

os_detect() {
  [[ -n "$OS_FAMILY" && -n "$PKG_MGR" ]] && return 0

  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    case "${ID:-}" in
      ubuntu|debian)
        OS_FAMILY=debian
        PKG_MGR=apt
        ;;
      centos|rhel|rocky|almalinux|ol|fedora|amzn|tencentos|opencloudos|anolis)
        OS_FAMILY=rhel
        ;;
    esac
  fi

  if [[ -z "$OS_FAMILY" ]]; then
    command -v apt-get >/dev/null 2>&1 && OS_FAMILY=debian PKG_MGR=apt
    command -v dnf >/dev/null 2>&1 && OS_FAMILY=rhel PKG_MGR=dnf
    command -v yum >/dev/null 2>&1 && OS_FAMILY=rhel PKG_MGR=yum
  elif [[ "$OS_FAMILY" == rhel && -z "$PKG_MGR" ]]; then
    if command -v dnf >/dev/null 2>&1; then PKG_MGR=dnf
    elif command -v yum >/dev/null 2>&1; then PKG_MGR=yum
    fi
  fi

  [[ -n "$OS_FAMILY" && -n "$PKG_MGR" ]] || {
    printf '\033[1;31m[operone-deploy]\033[0m 不支持的系统，请使用 Ubuntu/Debian 或 CentOS/RHEL 系\n' >&2
    exit 1
  }
}

os_pretty_name() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    echo "${PRETTY_NAME:-unknown}"
  else
    echo "unknown"
  fi
}

pkg_update() {
  os_detect
  case "$PKG_MGR" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      ;;
    dnf) dnf makecache -q ;;
    yum) yum makecache -q || yum check-update -q || true ;;
  esac
}

pkg_install() {
  os_detect
  case "$PKG_MGR" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get install -y "$@"
      ;;
    dnf) dnf install -y "$@" ;;
    yum) yum install -y "$@" ;;
  esac
}

ensure_epel() {
  os_detect
  [[ "$OS_FAMILY" == rhel ]] || return 0
  pkg_install epel-release 2>/dev/null || true
}

install_bootstrap_pkgs() {
  os_detect
  pkg_update
  pkg_install curl ca-certificates git
}

install_build_deps() {
  os_detect
  pkg_update
  if [[ "$OS_FAMILY" == debian ]]; then
    pkg_install curl ca-certificates git build-essential openssl rsync procps dnsutils
  else
    ensure_epel
    pkg_install curl ca-certificates git gcc gcc-c++ make openssl rsync procps-ng bind-utils
  fi
}

install_nodejs() {
  local major="${1:-22}"
  os_detect

  if command -v node >/dev/null 2>&1; then
    local ver
    ver="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$ver" -ge "$major" ]]; then
      return 0
    fi
  fi

  if [[ "$OS_FAMILY" == debian ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${major}.x" | bash -
    pkg_install nodejs
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${major}.x" | bash -
    pkg_install nodejs
  fi
}

install_nginx_pkg() {
  os_detect
  if command -v nginx >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$OS_FAMILY" == rhel ]]; then
    ensure_epel
  fi
  pkg_install nginx
}

install_certbot_pkgs() {
  os_detect
  if [[ "$OS_FAMILY" == debian ]]; then
    pkg_install certbot python3-certbot-nginx
  else
    ensure_epel
    pkg_install certbot python3-certbot-nginx 2>/dev/null \
      || pkg_install certbot python-certbot-nginx
  fi
}

nginx_write_operone_site() {
  local template="$1" domain="$2" port="$3"
  os_detect

  if [[ "$OS_FAMILY" == debian ]]; then
    local conf="/etc/nginx/sites-available/operone"
    sed -e "s/__DOMAIN__/${domain}/g" -e "s/__PORT__/${port}/g" "$template" > "$conf"
    mkdir -p /etc/nginx/sites-enabled
    ln -sf "$conf" /etc/nginx/sites-enabled/operone
    if [[ -f /etc/nginx/sites-enabled/default ]]; then
      rm -f /etc/nginx/sites-enabled/default
    fi
  else
    local conf="/etc/nginx/conf.d/operone.conf"
    sed -e "s/__DOMAIN__/${domain}/g" -e "s/__PORT__/${port}/g" "$template" > "$conf"
    if [[ -f /etc/nginx/conf.d/default.conf ]]; then
      mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak.operone 2>/dev/null || true
    fi
  fi
}

configure_firewall_ports() {
  local port="${1:-6666}" with_http="${2:-0}"
  os_detect

  if command -v ufw >/dev/null 2>&1; then
    if ufw status 2>/dev/null | grep -qi "Status: active"; then
      :
    else
      ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
      ufw --force enable
    fi
    [[ "$with_http" == "1" ]] && ufw allow 80/tcp && ufw allow 443/tcp
    ufw allow "${port}/tcp" || true
    return 0
  fi

  if systemctl is-active firewalld >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="${port}/tcp" || true
    if [[ "$with_http" == "1" ]]; then
      firewall-cmd --permanent --add-service=http || true
      firewall-cmd --permanent --add-service=https || true
    fi
    firewall-cmd --reload || true
    return 0
  fi

  return 1
}

ensure_app_user() {
  local user="${1:-www-data}" home="${2:-/opt/operone}"
  if id "$user" &>/dev/null; then
    return 0
  fi
  os_detect
  if [[ "$OS_FAMILY" == rhel && "$user" == "www-data" ]]; then
    # CentOS 上创建与 Debian 一致的运行用户
    useradd --system --home-dir "$home" --shell /sbin/nologin "$user" 2>/dev/null \
      || useradd --system -d "$home" --shell /sbin/nologin "$user"
  else
    useradd --system --home "$home" --shell /usr/sbin/nologin "$user" 2>/dev/null \
      || useradd --system --home-dir "$home" --shell /sbin/nologin "$user"
  fi
}
