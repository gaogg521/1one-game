#!/usr/bin/env bash
# Operone 部署 — Linux 发行版识别、版本校验与差异化包管理
# 支持：Ubuntu · Debian · CentOS · RHEL · Rocky · AlmaLinux · Oracle Linux · Amazon Linux 等
#
# 暴露变量（os_detect 之后）：
#   OS_ID OS_VERSION_ID OS_VERSION_MAJOR OS_PRETTY_NAME OS_FAMILY PKG_MGR OS_ID_LIKE

OS_ID="${OS_ID:-}"
OS_VERSION_ID="${OS_VERSION_ID:-}"
OS_VERSION_MAJOR="${OS_VERSION_MAJOR:-0}"
OS_PRETTY_NAME="${OS_PRETTY_NAME:-unknown}"
OS_FAMILY="${OS_FAMILY:-}"       # debian | rhel
OS_ID_LIKE="${OS_ID_LIKE:-}"
PKG_MGR="${PKG_MGR:-}"           # apt | dnf | yum

os_die() {
  printf '\033[1;31m[operone-deploy]\033[0m %s\n' "$*" >&2
  exit 1
}

os_warn() {
  printf '\033[1;33m[operone-deploy]\033[0m %s\n' "$*"
}

os_load_release() {
  OS_ID="" OS_VERSION_ID="" OS_PRETTY_NAME="unknown" OS_ID_LIKE=""
  [[ -f /etc/os-release ]] || return 1
  # shellcheck source=/dev/null
  . /etc/os-release
  OS_ID="${ID:-}"
  OS_VERSION_ID="${VERSION_ID:-}"
  OS_PRETTY_NAME="${PRETTY_NAME:-unknown}"
  OS_ID_LIKE="${ID_LIKE:-}"
  # VERSION_ID 可能是 "22.04" / "12" / "8" / "2023"
  OS_VERSION_MAJOR="${OS_VERSION_ID%%.*}"
  [[ "$OS_VERSION_MAJOR" =~ ^[0-9]+$ ]] || OS_VERSION_MAJOR=0
  return 0
}

# 将 ID / ID_LIKE 映射到 debian 或 rhel 族
os_resolve_family() {
  case "$OS_ID" in
    ubuntu|debian|linuxmint|pop)
      OS_FAMILY=debian
      PKG_MGR=apt
      return 0
      ;;
    centos|rhel|rocky|almalinux|ol|fedora|amzn|tencentos|opencloudos|anolis|virtuozzo|eurolinux)
      OS_FAMILY=rhel
      return 0
      ;;
  esac
  # 衍生版回退 ID_LIKE
  if [[ "$OS_ID_LIKE" == *debian* || "$OS_ID_LIKE" == *ubuntu* ]]; then
    OS_FAMILY=debian
    PKG_MGR=apt
    return 0
  fi
  if [[ "$OS_ID_LIKE" == *rhel* || "$OS_ID_LIKE" == *fedora* || "$OS_ID_LIKE" == *centos* ]]; then
    OS_FAMILY=rhel
    return 0
  fi
  return 1
}

os_resolve_pkg_mgr() {
  if [[ "$OS_FAMILY" == debian ]]; then
    PKG_MGR=apt
    command -v apt-get >/dev/null 2>&1 || os_die "未找到 apt-get"
    return 0
  fi
  if [[ "$OS_FAMILY" == rhel ]]; then
    if command -v dnf >/dev/null 2>&1; then PKG_MGR=dnf
    elif command -v yum >/dev/null 2>&1; then PKG_MGR=yum
    else os_die "未找到 dnf/yum"
    fi
    return 0
  fi
  return 1
}

os_detect() {
  if [[ -n "$OS_FAMILY" && -n "$PKG_MGR" && -n "$OS_ID" ]]; then
    return 0
  fi

  os_load_release || true

  if ! os_resolve_family; then
    # 最后兜底：按包管理器猜测
    if command -v apt-get >/dev/null 2>&1; then
      OS_FAMILY=debian
      [[ -z "$OS_ID" ]] && OS_ID=debian
    elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
      OS_FAMILY=rhel
      [[ -z "$OS_ID" ]] && OS_ID=rhel
    else
      os_die "不支持的系统。请使用 Ubuntu/Debian/CentOS/RHEL/Rocky/AlmaLinux"
    fi
  fi

  os_resolve_pkg_mgr
}

os_pretty_name() {
  os_detect
  echo "$OS_PRETTY_NAME"
}

# 各发行版最低版本要求（未列出的 rhel/debian 衍生版仅警告）
os_validate() {
  os_detect
  local min_ok=1

  case "$OS_ID" in
    ubuntu)
      if [[ "$OS_VERSION_MAJOR" -lt 20 ]]; then
        os_die "Ubuntu 版本过低 ($OS_VERSION_ID)，需要 20.04+"
      fi
      if [[ "$OS_VERSION_MAJOR" -lt 22 ]]; then
        os_warn "推荐 Ubuntu 22.04+，当前 $OS_PRETTY_NAME"
      fi
      ;;
    debian)
      if [[ "$OS_VERSION_MAJOR" -gt 0 && "$OS_VERSION_MAJOR" -lt 11 ]]; then
        os_die "Debian 版本过低 ($OS_VERSION_ID)，需要 11+"
      fi
      ;;
    centos)
      if [[ "$OS_VERSION_MAJOR" -lt 7 ]]; then
        os_die "CentOS 版本过低 ($OS_VERSION_ID)，需要 7+"
      fi
      if [[ "$OS_VERSION_MAJOR" -eq 7 ]]; then
        if command -v node >/dev/null 2>&1; then
          local nv
          nv="$(node -v | sed 's/v//' | cut -d. -f1)"
          if [[ "$nv" -ge 20 ]]; then
            os_warn "CentOS 7 + 自装 Node $(node -v) — 可用；yum 无法装 Node 20+，请勿删除 /usr/local/bin/node"
          else
            os_warn "CentOS 7 需手动安装 node-v*-linux-x64-glibc-217（Node 20+），见部署文档"
          fi
        else
          os_warn "CentOS 7 已 EOL：请先手动安装 node-v*-linux-x64-glibc-217 到 /opt 并 ln -s 到 /usr/local/bin"
        fi
      fi
      ;;
    rocky|almalinux)
      if [[ "$OS_VERSION_MAJOR" -lt 8 ]]; then
        os_die "$OS_ID 版本过低 ($OS_VERSION_ID)，需要 8+"
      fi
      ;;
    rhel|ol)
      if [[ "$OS_VERSION_MAJOR" -gt 0 && "$OS_VERSION_MAJOR" -lt 8 ]]; then
        os_die "$OS_ID 版本过低 ($OS_VERSION_ID)，需要 8+"
      fi
      ;;
    amzn)
      # Amazon Linux 2 (VERSION_ID=2) 或 AL2023 (VERSION_ID=2023)
      if [[ "$OS_VERSION_ID" == "2" ]]; then
        os_warn "Amazon Linux 2 可用，推荐 Amazon Linux 2023"
      fi
      ;;
    fedora)
      if [[ "$OS_VERSION_MAJOR" -gt 0 && "$OS_VERSION_MAJOR" -lt 38 ]]; then
        os_warn "Fedora $OS_VERSION_ID 未充分测试，推荐 38+"
      fi
      ;;
    tencentos|opencloudos|anolis)
      os_warn "$OS_PRETTY_NAME 按 RHEL 兼容路径安装，如有问题请反馈"
      ;;
    *)
      if [[ "$OS_FAMILY" == debian ]]; then
        os_warn "未在清单中的 Debian 系发行版 ($OS_ID)，将尝试 apt 安装"
      elif [[ "$OS_FAMILY" == rhel ]]; then
        os_warn "未在清单中的 RHEL 系发行版 ($OS_ID)，将尝试 dnf/yum 安装"
      else
        min_ok=0
      fi
      ;;
  esac

  [[ "$min_ok" -eq 1 ]] || os_die "无法在此系统上部署: $OS_PRETTY_NAME ($OS_ID)"
}

os_print_info() {
  os_detect
  echo "────────────────────────────────────────"
  printf "  发行版:     %s\n" "$OS_PRETTY_NAME"
  printf "  ID:         %s %s\n" "$OS_ID" "$OS_VERSION_ID"
  printf "  族/包管理:  %s / %s\n" "$OS_FAMILY" "$PKG_MGR"
  printf "  内核/架构:  %s / %s\n" "$(uname -r)" "$(uname -m)"
  if is_root; then
    printf "  运行权限:   root（无需 sudo）\n"
  else
    printf "  运行权限:   %s（将自动 sudo 提权）\n" "$(id -un)"
  fi
  echo "────────────────────────────────────────"
}

os_nginx_conf_path() {
  os_detect
  if [[ "$OS_FAMILY" == debian ]]; then
    echo "/etc/nginx/sites-available/operone"
  else
    echo "/etc/nginx/conf.d/operone.conf"
  fi
}

os_check_network() {
  os_detect
  local url
  if [[ "$OS_FAMILY" == debian ]]; then
    url="https://deb.nodesource.com"
  else
    url="https://rpm.nodesource.com"
  fi
  curl -fsSL --max-time 15 "$url" >/dev/null 2>&1 \
    || os_die "无法访问 $url，请检查网络/DNS/防火墙"
}

# ── 包管理 ──────────────────────────────────────────────

pkg_update() {
  os_detect
  case "$PKG_MGR" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      ;;
    dnf) dnf makecache -q ;;
    yum) yum makecache -q 2>/dev/null || yum check-update -q 2>/dev/null || true ;;
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

# RHEL 8+ 编译依赖常在 PowerTools/CRB 仓库
ensure_rhel_build_repos() {
  os_detect
  [[ "$OS_FAMILY" == rhel ]] || return 0
  [[ "$PKG_MGR" == dnf ]] || return 0

  dnf install -y dnf-plugins-core 2>/dev/null || true
  case "$OS_ID" in
    rocky|almalinux)
      dnf config-manager --set-enabled powertools 2>/dev/null \
        || dnf config-manager --set-enabled crb 2>/dev/null \
        || true
      ;;
    centos)
      if [[ "$OS_VERSION_MAJOR" -ge 8 ]]; then
        dnf config-manager --set-enabled powertools 2>/dev/null \
          || dnf config-manager --set-enabled crb 2>/dev/null \
          || true
      fi
      ;;
    rhel|ol)
      subscription-manager repos --enable "codeready-builder-for-rhel-${OS_VERSION_MAJOR}-$(uname -m)-rpms" 2>/dev/null || true
      ;;
  esac
}

ensure_epel() {
  os_detect
  [[ "$OS_FAMILY" == rhel ]] || return 0

  case "$OS_ID" in
    amzn)
      if [[ "$OS_VERSION_ID" == "2" ]]; then
        amazon-linux-extras install epel -y 2>/dev/null \
          || pkg_install epel-release 2>/dev/null \
          || true
      else
        pkg_install epel-release 2>/dev/null || true
      fi
      ;;
    rhel)
      # RHEL 需先启用 EPEL，部分镜像已预装
      pkg_install "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${OS_VERSION_MAJOR}.noarch.rpm" 2>/dev/null \
        || pkg_install epel-release 2>/dev/null \
        || true
      ;;
    *)
      pkg_install epel-release 2>/dev/null || true
      ;;
  esac
}

install_bootstrap_pkgs() {
  os_detect
  pkg_update
  case "$OS_FAMILY" in
    debian) pkg_install curl ca-certificates git ;;
    rhel)   pkg_install curl ca-certificates git ;;
  esac
}

install_build_deps() {
  os_detect
  pkg_update

  case "$OS_FAMILY" in
    debian)
      pkg_install curl ca-certificates git build-essential openssl rsync procps dnsutils
      ;;
    rhel)
      ensure_epel
      ensure_rhel_build_repos
      # CentOS 7 无 gcc-c++ 包名差异
      if [[ "$OS_ID" == centos && "$OS_VERSION_MAJOR" -eq 7 ]]; then
        pkg_install curl ca-certificates git gcc gcc-c++ make openssl rsync procps-ng bind-utils
      else
        pkg_install curl ca-certificates git gcc gcc-c++ make openssl rsync procps-ng bind-utils
      fi
      ;;
  esac
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

  case "$OS_FAMILY" in
    debian)
      curl -fsSL "https://deb.nodesource.com/setup_${major}.x" | bash -
      pkg_install nodejs
      ;;
    rhel)
      if [[ "$OS_ID" == centos && "$OS_VERSION_MAJOR" -eq 7 ]]; then
        os_die "CentOS 7 无法用 yum 安装 Node ${major}.x（glibc 过旧）。请使用 node-v${major}*-linux-x64-glibc-217 自解压包并 ln -s 到 /usr/local/bin"
      fi
      curl -fsSL "https://rpm.nodesource.com/setup_${major}.x" | bash -
      pkg_install nodejs
      ;;
  esac
}

install_nginx_pkg() {
  os_detect
  command -v nginx >/dev/null 2>&1 && return 0

  case "$OS_ID" in
    amzn)
      if [[ "$OS_VERSION_ID" == "2" ]]; then
        amazon-linux-extras install nginx1 -y 2>/dev/null || pkg_install nginx
      else
        pkg_install nginx
      fi
      ;;
    *)
      if [[ "$OS_FAMILY" == rhel ]]; then
        ensure_epel
      fi
      pkg_install nginx
      ;;
  esac
}

install_certbot_pkgs() {
  os_detect
  case "$OS_FAMILY" in
    debian)
      pkg_install certbot python3-certbot-nginx
      ;;
    rhel)
      ensure_epel
      pkg_install certbot python3-certbot-nginx 2>/dev/null \
        || pkg_install certbot python-certbot-nginx 2>/dev/null \
        || os_die "无法安装 certbot，请手动: $PKG_MGR install certbot python3-certbot-nginx"
      ;;
  esac
}

nginx_write_operone_site() {
  local template="$1" domain="$2" port="$3"
  os_detect

  if [[ "$OS_FAMILY" == debian ]]; then
    local conf="/etc/nginx/sites-available/operone"
    sed -e "s/__DOMAIN__/${domain}/g" -e "s/__PORT__/${port}/g" "$template" > "$conf"
    mkdir -p /etc/nginx/sites-enabled
    ln -sf "$conf" /etc/nginx/sites-enabled/operone
    [[ -f /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default
  else
    local conf="/etc/nginx/conf.d/operone.conf"
    sed -e "s/__DOMAIN__/${domain}/g" -e "s/__PORT__/${port}/g" "$template" > "$conf"
    [[ -f /etc/nginx/conf.d/default.conf ]] && \
      mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak.operone 2>/dev/null || true
  fi
}

configure_firewall_ports() {
  local port="${1:-6666}" with_http="${2:-0}"
  os_detect

  # Debian/Ubuntu 优先 ufw
  if [[ "$OS_FAMILY" == debian ]] && command -v ufw >/dev/null 2>&1; then
    ufw status 2>/dev/null | grep -qi "Status: active" || {
      ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
      ufw --force enable
    }
    [[ "$with_http" == "1" ]] && ufw allow 80/tcp && ufw allow 443/tcp
    ufw allow "${port}/tcp" || true
    return 0
  fi

  # RHEL 系默认 firewalld
  if systemctl is-active firewalld >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="${port}/tcp" || true
    [[ "$with_http" == "1" ]] && {
      firewall-cmd --permanent --add-service=http || true
      firewall-cmd --permanent --add-service=https || true
    }
    firewall-cmd --reload || true
    return 0
  fi

  # Ubuntu 无 ufw 时尝试 firewalld
  if [[ "$OS_FAMILY" == debian ]] && systemctl is-active firewalld >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="${port}/tcp" || true
    firewall-cmd --reload || true
    return 0
  fi

  return 1
}

ensure_app_user() {
  local user="${1:-www-data}" home="${2:-/opt/operone}"
  id "$user" &>/dev/null && return 0
  os_detect

  local shell="/sbin/nologin"
  [[ "$OS_FAMILY" == debian ]] && shell="/usr/sbin/nologin"

  useradd --system --home-dir "$home" --shell "$shell" "$user" 2>/dev/null \
    || useradd --system -d "$home" --shell "$shell" "$user" 2>/dev/null \
    || useradd --system --home "$home" --shell "$shell" "$user"
}

# ── 权限：root 直接执行，非 root 自动 sudo ─────────────────

is_root() {
  [[ "$(id -u)" -eq 0 ]]
}

# 已是 root → 直接返回；非 root → sudo 重新执行本脚本（exec，不返回）
# 用法：ensure_root_privileges /path/to/script.sh "$@"
ensure_root_privileges() {
  local script="${1:?缺少脚本路径}"
  shift || true

  if is_root; then
    return 0
  fi

  if [[ "${OPERONE_ROOT_REEXEC:-0}" == "1" ]]; then
    os_die "提权失败：sudo 后仍非 root，请直接用 root 登录执行"
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    os_die "需要 root 权限。当前用户: $(id -un)（uid=$(id -u)），系统未安装 sudo，请 root 登录后重试"
  fi

  if sudo -n true 2>/dev/null; then
    os_warn "当前用户 $(id -un) → 使用 sudo 继续（已缓存密码）"
  else
    os_warn "当前用户 $(id -un) → 需要管理员权限，请输入 sudo 密码 …"
  fi

  export OPERONE_ROOT_REEXEC=1
  exec sudo -E env OPERONE_ROOT_REEXEC=1 bash "$script" "$@"
}

# curl | bash 管道执行时无本地脚本文件，下载后 sudo
ensure_root_privileges_piped() {
  local install_url="${1:?缺少 install.sh URL}"
  shift || true

  is_root && return 0

  if [[ "${OPERONE_ROOT_REEXEC:-0}" == "1" ]]; then
    os_die "提权失败，请 root 登录后重试"
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    os_die "需要 root 权限。请 root 登录，或安装 sudo"
  fi

  os_warn "当前用户 $(id -un) → 下载脚本并以 sudo 执行 …"
  local tmp
  tmp="$(mktemp /tmp/operone-install.XXXXXX.sh)"
  curl -fsSL "$install_url" -o "$tmp"
  chmod +x "$tmp"
  export OPERONE_ROOT_REEXEC=1
  exec sudo -E env OPERONE_ROOT_REEXEC=1 bash "$tmp" "$@"
}

# 以应用用户执行命令；已是 root 时优先 runuser/sudo -u
run_as_app_user() {
  local user="$1"
  shift
  if is_root; then
    if command -v runuser >/dev/null 2>&1; then
      runuser -u "$user" -- "$@"
    elif command -v sudo >/dev/null 2>&1; then
      sudo -u "$user" "$@"
    else
      su -s /bin/bash "$user" -c "$(printf '%q ' "$@")"
    fi
  else
    sudo -u "$user" "$@"
  fi
}

# 预检入口（install / full 共用）
os_preflight() {
  os_detect
  os_validate
  os_print_info
  os_check_network
}
