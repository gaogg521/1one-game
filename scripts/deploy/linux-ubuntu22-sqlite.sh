#!/usr/bin/env bash
# Operone — Ubuntu 22.04 分阶段部署（高级运维）
# 普通用户请用：curl -fsSL .../install.sh | bash
set -euo pipefail

PHASE="${PHASE:-all}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ubuntu-deploy-lib.sh
source "$SCRIPT_DIR/lib/ubuntu-deploy-lib.sh"

usage() {
  cat <<'EOF'
Operone — Ubuntu 22.04 单机 SQLite 分阶段部署

  sudo bash scripts/deploy/linux-ubuntu22-sqlite.sh [选项]

  推荐一条龙：sudo bash scripts/deploy/linux-ubuntu22-full.sh -y

选项：
  --phase deps       安装系统依赖 + Node.js 22
  --phase app        拉代码 / npm ci / .env / migrate / build / 可选 seed
  --phase systemd    安装并启动 systemd 单元
  --phase nginx      配置 Nginx 反代（需 OPERONE_DOMAIN）
  --phase ssl        Certbot 申请 HTTPS（需 OPERONE_DOMAIN + CERTBOT_EMAIL）
  --all              deps + app + systemd（不含 nginx/ssl）
  --all-public       deps + app + systemd + nginx + ssl
  --skip-seed / --skip-preflight
  --help
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --phase)
        PHASE="$2"
        shift 2
        ;;
      --all)
        PHASE="all"
        shift
        ;;
      --all-public)
        PHASE="all-public"
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
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "未知参数: $1（--help 查看用法）"
        ;;
    esac
  done
}

run_phase() {
  case "$PHASE" in
    deps) phase_deps ;;
    app) phase_app ;;
    systemd) install_systemd_unit ;;
    nginx) phase_nginx ;;
    ssl) phase_ssl ;;
    all)
      phase_deps
      phase_app
      install_systemd_unit
      log "完成。内网访问: http://$(server_primary_ip):${OPERONE_PORT}"
      log "对外 HTTPS: 使用 linux-ubuntu22-full.sh 或 --phase nginx && --phase ssl"
      ;;
    all-public)
      phase_deps
      phase_app
      install_systemd_unit
      phase_nginx
      phase_ssl
      log "完成: https://${OPERONE_DOMAIN}"
      ;;
    *)
      die "未知 PHASE=$PHASE"
      ;;
  esac
}

parse_args "$@"
run_phase
