#!/usr/bin/env bash
# Operone 一键部署 — Docker 版（任意 Linux，含 CentOS 7）
#
#   curl -fsSL .../install-docker.sh | bash
#
# 流程：装 Docker → 拉代码 → 写 .env → docker compose build → migrate → 启动
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
OPERONE_PORT="${OPERONE_PORT:-6666}"
OPERONE_DEFAULT_GIT_REPO="${OPERONE_DEFAULT_GIT_REPO:-https://github.com/gaogg521/1one-game.git}"
GIT_REPO="${GIT_REPO:-$OPERONE_DEFAULT_GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"
OPERONE_RAW_BASE="${OPERONE_RAW_BASE:-https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy}"

log() { printf '\033[1;36m[一键部署·Docker]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[一键部署·Docker]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[一键部署·Docker]\033[0m %s\n' "$*" >&2; exit 1; }

ensure_root() {
  [[ "$(id -u)" -eq 0 ]] || die "请 root 执行，或: curl ... | sudo bash"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    die "未找到 docker compose，请安装 Docker Compose 插件"
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && (docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1); then
    log "Docker 已就绪: $(docker --version 2>/dev/null | head -1)"
    return 0
  fi
  log "安装 Docker（get.docker.com）…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker 2>/dev/null || true
  systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
  command -v docker >/dev/null || die "Docker 安装失败"
  log "Docker: $(docker --version)"
}

clone_or_update() {
  if [[ -d "$OPERONE_DIR/.git" ]]; then
    log "更新代码: $OPERONE_DIR"
    (cd "$OPERONE_DIR" && git fetch origin && git checkout "$GIT_BRANCH" && git pull --ff-only origin "$GIT_BRANCH") || true
    return 0
  fi
  if [[ -d "$OPERONE_DIR" ]] && [[ -n "$(ls -A "$OPERONE_DIR" 2>/dev/null)" ]]; then
    die "$OPERONE_DIR 非空，请清空或换 OPERONE_DIR"
  fi
  mkdir -p "$(dirname "$OPERONE_DIR")"
  log "克隆 $GIT_REPO → $OPERONE_DIR"
  git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
}

write_env() {
  local env_file="$OPERONE_DIR/.env"
  if [[ -f "$env_file" ]]; then
    log ".env 已存在，跳过"
    return 0
  fi
  [[ -f "$OPERONE_DIR/.env.example" ]] || die "缺少 .env.example"
  cp "$OPERONE_DIR/.env.example" "$env_file"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:/app/data/prod.db\"|" "$env_file"
  grep -q '^PORT=' "$env_file" && sed -i "s|^PORT=.*|PORT=${OPERONE_PORT}|" "$env_file" || echo "PORT=${OPERONE_PORT}" >> "$env_file"
  grep -q '^NODE_ENV=' "$env_file" || echo 'NODE_ENV=production' >> "$env_file"
  log "已从 .env.example 生成 .env（容器内路径 file:/app/data/prod.db）"
  warn "装完后编辑 $env_file 填 OPENAI_API_KEY，再: cd $OPERONE_DIR && docker compose up -d --build"
}

wait_health() {
  local url="http://127.0.0.1:${OPERONE_PORT}/api/health" i
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "健康检查通过: $url"
      return 0
    fi
    sleep 3
  done
  warn "健康检查超时，查看日志: cd $OPERONE_DIR && docker compose logs -f web"
  return 1
}

main() {
  ensure_root
  install_docker
  clone_or_update
  write_env

  log "构建并启动（首次约 5–15 分钟，在容器内完成 build，与宿主机 glibc 无关）…"
  cd "$OPERONE_DIR"
  export OPERONE_PORT
  compose up -d --build

  wait_health || true

  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║       Operone Docker 部署完成                        ║"
  echo "╠══════════════════════════════════════════════════════╣"
  printf "║  访问: http://%-38s ║\n" "${ip:-127.0.0.1}:${OPERONE_PORT}"
  printf "║  健康: curl -s http://127.0.0.1:%-5s/api/health       ║\n" "$OPERONE_PORT"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║  改 API Key: nano /opt/operone/.env                  ║"
  echo "║  重启:      cd /opt/operone && docker compose up -d  ║"
  echo "║  日志:      cd /opt/operone && docker compose logs -f ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"
