#!/usr/bin/env bash
# Operone 创作平台 — Ubuntu 22.04 / Debian 12 单机 SQLite 从零部署
#
# 用法（在目标 Linux 服务器上）：
#   curl -fsSL .../linux-ubuntu22-sqlite.sh | bash -s -- --all
#   或克隆仓库后：
#   sudo bash scripts/deploy/linux-ubuntu22-sqlite.sh --all
#
# 环境变量（可选，也可交互输入）：
#   OPERONE_DIR=/opt/operone
#   OPERONE_USER=www-data          # systemd 运行用户
#   GIT_REPO=https://github.com/you/game.git
#   GIT_BRANCH=main
#   OPERONE_DOMAIN=app.example.com # --phase nginx / ssl 时需要
#   CERTBOT_EMAIL=ops@example.com
#   OPENAI_API_KEY / OPENAI_BASE_URL / SUPER_ADMIN_SECRET — 写入 .env
#
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
OPERONE_USER="${OPERONE_USER:-www-data}"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
OPERONE_DOMAIN="${OPERONE_DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
PHASE="${PHASE:-all}"
SKIP_SEED="${SKIP_SEED:-0}"
SKIP_PREFLIGHT="${SKIP_PREFLIGHT:-0}"
NODE_MAJOR="${NODE_MAJOR:-22}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { printf '\033[1;34m[operone-deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[operone-deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[operone-deploy]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Operone — Ubuntu 22.04 单机 SQLite 部署脚本

  sudo bash scripts/deploy/linux-ubuntu22-sqlite.sh [选项]

选项：
  --phase deps       安装系统依赖 + Node.js 22
  --phase app        拉代码 / npm ci / .env / migrate / build / 可选 seed
  --phase systemd    安装并启动 systemd 单元
  --phase nginx      配置 Nginx 反代（需 OPERONE_DOMAIN）
  --phase ssl        Certbot 申请 HTTPS（需 OPERONE_DOMAIN + CERTBOT_EMAIL）
  --all              deps + app + systemd（不含 nginx/ssl，需单独指定域名）
  --all-public       deps + app + systemd + nginx + ssl
  --help

示例：
  export GIT_REPO=https://github.com/you/game.git
  export OPENAI_API_KEY=sk-...
  export OPENAI_BASE_URL=https://litellm.example.com
  export SUPER_ADMIN_SECRET='your-strong-secret'
  sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --all

  export OPERONE_DOMAIN=app.example.com
  export CERTBOT_EMAIL=ops@example.com
  sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --phase nginx
  sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --phase ssl

更新版本（已在 /opt/operone）：
  cd /opt/operone && sudo -u www-data git pull && sudo -u www-data npm ci \
    && sudo -u www-data npx prisma migrate deploy \
    && sudo -u www-data npm run build \
    && sudo systemctl restart operone
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

need_root() {
  [[ "$(id -u)" -eq 0 ]] || die "此步骤需要 root：sudo bash $0 --phase $1"
}

phase_deps() {
  need_root deps
  log "安装系统包 …"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y curl ca-certificates git build-essential openssl

  if command -v node >/dev/null 2>&1; then
    local ver
    ver="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$ver" -ge "$NODE_MAJOR" ]]; then
      log "Node 已满足要求: $(node -v)"
      return 0
    fi
    warn "Node $(node -v) 版本偏低，将安装 Node ${NODE_MAJOR}.x"
  fi

  log "安装 Node.js ${NODE_MAJOR}.x (NodeSource) …"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  log "Node $(node -v) · npm $(npm -v)"
}

ensure_operone_dir() {
  if [[ ! -d "$OPERONE_DIR" ]]; then
    mkdir -p "$OPERONE_DIR"
  fi
  if id "$OPERONE_USER" &>/dev/null; then
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
  fi
}

clone_or_update_repo() {
  ensure_operone_dir
  if [[ -d "$OPERONE_DIR/.git" ]]; then
    log "仓库已存在，git pull …"
    sudo -u "$OPERONE_USER" git -C "$OPERONE_DIR" fetch origin
    sudo -u "$OPERONE_USER" git -C "$OPERONE_DIR" checkout "$GIT_BRANCH"
    sudo -u "$OPERONE_USER" git -C "$OPERONE_DIR" pull --ff-only origin "$GIT_BRANCH" || true
    return 0
  fi

  if [[ -n "$GIT_REPO" ]]; then
    log "克隆 $GIT_REPO → $OPERONE_DIR"
    sudo -u "$OPERONE_USER" git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
    return 0
  fi

  if [[ -f "$REPO_ROOT/package.json" ]] && [[ "$REPO_ROOT" != "$OPERONE_DIR" ]]; then
    log "从当前仓库复制到 $OPERONE_DIR（未设 GIT_REPO）"
    rsync -a --exclude node_modules --exclude .next --exclude '*.db' --exclude '.git' \
      "$REPO_ROOT/" "$OPERONE_DIR/" 2>/dev/null \
      || cp -a "$REPO_ROOT/." "$OPERONE_DIR/"
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
    return 0
  fi

  die "请设置 GIT_REPO=... 或先在 $OPERONE_DIR 手动 git clone"
}

write_env_if_missing() {
  local env_file="$OPERONE_DIR/.env"
  if [[ -f "$env_file" ]]; then
    log ".env 已存在，跳过生成"
    return 0
  fi

  log "从 .env.example 生成 .env"
  sudo -u "$OPERONE_USER" cp "$OPERONE_DIR/.env.example" "$env_file"

  # 生产最小集
  sudo -u "$OPERONE_USER" sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./prod.db"|' "$env_file"

  append_env() {
    local key="$1" val="$2"
    [[ -z "$val" ]] && return 0
    if grep -q "^${key}=" "$env_file"; then
      sudo -u "$OPERONE_USER" sed -i "s|^${key}=.*|${key}=${val}|" "$env_file"
    else
      echo "${key}=${val}" >> "$env_file"
    fi
  }

  append_env "NODE_ENV" "production"
  append_env "PORT" "8888"
  append_env "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
  append_env "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-https://litellm-internal.123u.com}"
  append_env "SUPER_ADMIN_SECRET" "${SUPER_ADMIN_SECRET:-}"
  append_env "RUNTIME_CONFIG_SECRET" "${RUNTIME_CONFIG_SECRET:-${SUPER_ADMIN_SECRET:-}}"

  if [[ -z "${SUPER_ADMIN_SECRET:-}" ]]; then
    warn "未设置 SUPER_ADMIN_SECRET，请编辑 $env_file 后再启动服务"
  fi
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    warn "未设置 OPENAI_API_KEY，LLM/文生图将走 mock，不适合生产"
  fi
}

phase_app() {
  need_root app
  id "$OPERONE_USER" &>/dev/null || useradd --system --home "$OPERONE_DIR" --shell /usr/sbin/nologin "$OPERONE_USER" || true

  clone_or_update_repo
  write_env_if_missing

  log "npm ci …"
  sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm ci"

  log "prisma migrate deploy …"
  sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npx prisma migrate deploy"
  sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npx prisma generate"

  if [[ "$SKIP_PREFLIGHT" != "1" ]]; then
    log "qa:deploy-preflight …"
    sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm run qa:deploy-preflight" || warn "预检未全过，请查看日志后决定是否继续"
  fi

  log "npm run build …"
  sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm run build"

  mkdir -p "$OPERONE_DIR/public/covers" "$OPERONE_DIR/public/comic-panels" "$OPERONE_DIR/public/game-bg"
  chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"

  if [[ "$SKIP_SEED" != "1" ]]; then
    log "seed:samples（样品馆）…"
    sudo -u "$OPERONE_USER" bash -lc "cd '$OPERONE_DIR' && npm run seed:samples" || warn "seed 失败（可稍后手动 npm run seed:samples）"
  fi

  log "app 阶段完成 → $OPERONE_DIR"
}

install_systemd_unit() {
  need_root systemd
  local unit="/etc/systemd/system/operone.service"
  local npm_bin
  npm_bin="$(command -v npm)"

  cat > "$unit" <<EOF
[Unit]
Description=Operone 创作平台
Documentation=file://${OPERONE_DIR}/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${OPERONE_USER}
Group=${OPERONE_USER}
WorkingDirectory=${OPERONE_DIR}
EnvironmentFile=-${OPERONE_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=8888
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${npm_bin} run start
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable operone
  systemctl restart operone
  sleep 2
  if systemctl is-active --quiet operone; then
    log "operone.service 已启动"
  else
    systemctl status operone --no-pager || true
    die "operone 启动失败，执行: journalctl -u operone -n 80 --no-pager"
  fi

  if curl -sf "http://127.0.0.1:8888/api/health" >/dev/null; then
    log "健康检查 OK: http://127.0.0.1:8888/api/health"
  else
    warn "健康检查未通过，稍候: curl -v http://127.0.0.1:8888/api/health"
  fi
}

phase_nginx() {
  need_root nginx
  [[ -n "$OPERONE_DOMAIN" ]] || die "请设置 OPERONE_DOMAIN=app.example.com"

  apt-get install -y nginx
  local conf="/etc/nginx/sites-available/operone"
  sed "s/__DOMAIN__/${OPERONE_DOMAIN}/g" "$SCRIPT_DIR/templates/nginx-operone.conf" > "$conf"
  ln -sf "$conf" /etc/nginx/sites-enabled/operone
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t
  systemctl reload nginx
  log "Nginx 已配置: http://${OPERONE_DOMAIN} → 127.0.0.1:8888"
}

phase_ssl() {
  need_root ssl
  [[ -n "$OPERONE_DOMAIN" ]] || die "请设置 OPERONE_DOMAIN"
  [[ -n "$CERTBOT_EMAIL" ]] || die "请设置 CERTBOT_EMAIL"

  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$OPERONE_DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
  log "HTTPS 已启用: https://${OPERONE_DOMAIN}"
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
      log "完成。内网访问: http://$(hostname -I | awk '{print $1}'):8888"
      log "对外 HTTPS: 设置 OPERONE_DOMAIN 后执行 --phase nginx && --phase ssl"
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
