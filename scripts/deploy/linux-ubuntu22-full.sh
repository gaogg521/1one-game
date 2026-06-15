#!/usr/bin/env bash
# Operone 内部部署流程 — 用户请用 install.sh 一键部署
#
#   curl -fsSL .../install.sh | bash
#
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
OPERONE_DEFAULT_GIT_REPO="${OPERONE_DEFAULT_GIT_REPO:-https://github.com/gaogg521/1one-game.git}"
GIT_REPO="${GIT_REPO:-$OPERONE_DEFAULT_GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"

# 独立 .sh（非仓库内）时：先 clone 再 re-exec
bootstrap_if_standalone() {
  local self script_dir
  self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -f "$script_dir/templates/nginx-operone.conf" ]] && [[ -f "$script_dir/../../package.json" ]]; then
    return 0
  fi
  if [[ "${OPERONE_BOOTSTRAPPED:-0}" == "1" ]]; then
    return 0
  fi
  if [[ -f "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" ]]; then
    export OPERONE_BOOTSTRAPPED=1
    exec bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" "$@"
  fi

  local install_sh="$script_dir/install.sh"
  if [[ -f "$install_sh" ]]; then
    exec bash "$install_sh" "$@"
  fi

  local _os_lib _raw="${OPERONE_RAW_BASE:-https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy}"
  _os_lib="$(mktemp /tmp/operone-os-lib.XXXXXX.sh)"
  curl -fsSL "${_raw}/lib/os-lib.sh" -o "$_os_lib"
  # shellcheck source=/dev/null
  source "$_os_lib"
  ensure_root_privileges "$self" "$@"

  printf '\033[1;34m[operone-deploy]\033[0m 独立模式：从 %s 拉取仓库 …\n' "$GIT_REPO"
  install_bootstrap_pkgs
  mkdir -p "$(dirname "$OPERONE_DIR")"
  git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
  export OPERONE_BOOTSTRAPPED=1
  export NON_INTERACTIVE=1
  exec bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" -y "$@"
}

bootstrap_if_standalone "$@"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export OPERONE_DEPLOY_SCRIPT="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}")"
# shellcheck source=lib/ubuntu-deploy-lib.sh
source "$SCRIPT_DIR/lib/ubuntu-deploy-lib.sh"

# 非 root 自动 sudo；已是 root 则跳过
ensure_root_privileges "$OPERONE_DEPLOY_SCRIPT" "$@"

NON_INTERACTIVE="${NON_INTERACTIVE:-1}"
ENABLE_NGINX="${ENABLE_NGINX:-auto}"
ENABLE_SSL="${ENABLE_SSL:-auto}"
ENABLE_FIREWALL="${ENABLE_FIREWALL:-auto}"
MODE="install"

usage() {
  cat <<EOF
Operone 一键部署（内部脚本，用户请用 install.sh）

  curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash

高级选项：--update  --no-nginx  --no-ssl  --interactive  -h
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes)
        NON_INTERACTIVE=1
        shift
        ;;
      --interactive)
        NON_INTERACTIVE=0
        shift
        ;;
      --update)
        MODE="update"
        shift
        ;;
      --no-nginx)
        ENABLE_NGINX=0
        shift
        ;;
      --no-ssl)
        ENABLE_SSL=0
        shift
        ;;
      --no-firewall)
        ENABLE_FIREWALL=0
        shift
        ;;
      --skip-seed)
        SKIP_SEED=1
        shift
        ;;
      --skip-preflight)
        SKIP_PREFLIGHT=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "未知参数: $1（--help 查看用法）"
        ;;
    esac
  done
}

prompt_if_empty() {
  local var_name="$1" prompt_text="$2" default_val="${3:-}"
  local current="${!var_name:-}"
  if [[ -n "$current" || "$NON_INTERACTIVE" == "1" ]]; then
    return 0
  fi
  read -r -p "$prompt_text${default_val:+ [$default_val]}: " input || true
  input="${input:-$default_val}"
  printf -v "$var_name" '%s' "$input"
}

preflight() {
  log "════════ 环境预检 ════════"
  need_root
  os_preflight
  check_resources
  check_port_available
  check_source_available

  local template="$SCRIPT_DIR/templates/nginx-operone.conf"
  if [[ "$ENABLE_NGINX" != "0" && -n "${OPERONE_DOMAIN:-}" && ! -f "$template" ]]; then
    die "缺少 $template — 请使用完整仓库（含 scripts/deploy/templates/）"
  fi
  ok "预检通过 ($OS_ID $OS_VERSION_ID · $PKG_MGR)"
}

check_resources() {
  local free_kb free_gb mem_mb
  free_kb="$(df -Pk "$OPERONE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || df -Pk / | awk 'NR==2 {print $4}')"
  free_gb=$((free_kb / 1024 / 1024))
  mem_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 0)"

  log "磁盘可用: ~${free_gb}GB · 内存: ~${mem_mb}MB"
  if [[ "$free_gb" -lt 3 ]]; then
    warn "磁盘不足 3GB，npm build 可能失败"
  fi
  if [[ "$mem_mb" -gt 0 && "$mem_mb" -lt 1800 ]]; then
    warn "内存 < 2GB，build 可能 OOM，建议加 swap"
  fi
}

check_port_available() {
  if port_in_use "$OPERONE_PORT"; then
    if systemctl is-active --quiet operone 2>/dev/null; then
      log "端口 ${OPERONE_PORT} 已被 operone 使用（正常）"
      return 0
    fi
    warn "端口 ${OPERONE_PORT} 已被其他进程占用，尝试继续 …"
  fi
}

check_source_available() {
  if [[ -d "$OPERONE_DIR/.git" || -f "$OPERONE_DIR/package.json" ]]; then
    ok "目标目录已有源码: $OPERONE_DIR"
    return 0
  fi
  if [[ -f "$REPO_ROOT/package.json" && "$REPO_ROOT" != "$OPERONE_DIR" ]]; then
    ok "将复制当前仓库: $REPO_ROOT → $OPERONE_DIR"
    return 0
  fi
  ok "将从 Git 拉取: ${GIT_REPO:-$OPERONE_DEFAULT_GIT_REPO}"
}

collect_config() {
  # 默认全自动：不设域名 = 内网 6666；设域名 = 自动 Nginx/HTTPS
  if [[ -n "$OPERONE_DOMAIN" && "$ENABLE_NGINX" == "auto" ]]; then
    ENABLE_NGINX=1
  fi
  if [[ -n "$OPERONE_DOMAIN" && -n "$CERTBOT_EMAIL" && "$ENABLE_SSL" == "auto" ]]; then
    ENABLE_SSL=1
  elif [[ "$ENABLE_SSL" == "auto" ]]; then
    ENABLE_SSL=0
  fi
  if [[ "$ENABLE_FIREWALL" == "auto" ]]; then
    ENABLE_FIREWALL=$([[ -n "$OPERONE_DOMAIN" ]] && echo 1 || echo 0)
  fi
  if [[ -z "${SUPER_ADMIN_SECRET:-}" ]]; then
    SUPER_ADMIN_SECRET="$(generate_secret)"
  fi
}

run_update() {
  need_root
  [[ -d "$OPERONE_DIR" ]] || die "未找到 $OPERONE_DIR，请先完整部署"

  log "════════ 更新部署 ════════"
  phase_deps

  if [[ -d "$OPERONE_DIR/.git" ]]; then
    git_as_user_in_repo "$OPERONE_USER" fetch origin
    git_as_user_in_repo "$OPERONE_USER" checkout "$GIT_BRANCH"
    git_as_user_in_repo "$OPERONE_USER" pull --ff-only origin "$GIT_BRANCH" || true
  fi

  run_as_app_user "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm ci"
  run_as_app_user "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npx prisma migrate deploy"
  run_as_app_user "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npx prisma generate"
  run_as_app_user "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm run build"
  systemctl restart operone
  wait_for_health 30 || true
  ok "更新完成"
  print_deploy_summary
}

run_full_install() {
  preflight
  collect_config

  log "════════ 开始安装 ════════"
  phase_deps
  phase_app
  install_systemd_unit

  if [[ "$ENABLE_NGINX" == "1" && -n "$OPERONE_DOMAIN" ]]; then
    phase_nginx
  elif [[ -n "$OPERONE_DOMAIN" ]]; then
    warn "已设 OPERONE_DOMAIN 但 --no-nginx，请手动配置反代到 127.0.0.1:${OPERONE_PORT}"
  fi

  if [[ "$ENABLE_SSL" == "1" && -n "$OPERONE_DOMAIN" && -n "$CERTBOT_EMAIL" ]]; then
    phase_ssl || warn "HTTPS 申请失败，可稍后手动: certbot --nginx -d $OPERONE_DOMAIN"
  fi

  if [[ "$ENABLE_FIREWALL" == "1" ]]; then
    configure_firewall_if_needed || warn "防火墙配置失败，请手动放行 80/443"
  fi

  print_deploy_summary
}

main() {
  parse_args "$@"
  if [[ "$MODE" == "update" ]]; then
    run_update
  else
    run_full_install
  fi
}

main "$@"
