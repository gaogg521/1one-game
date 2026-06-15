#!/usr/bin/env bash
# Operone — Docker 单机 SQLite 快速部署（任意 Linux）
#
#   export GIT_REPO=https://github.com/you/game.git   # 可选，默认用当前目录
#   export OPENAI_API_KEY=sk-...
#   sudo -E bash scripts/deploy/linux-docker-sqlite.sh
#
set -euo pipefail

OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"

log() { printf '\033[1;34m[operone-docker]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[operone-docker]\033[0m %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "请使用 sudo 运行"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git docker.io docker-compose-plugin curl
systemctl enable --now docker

mkdir -p "$OPERONE_DIR"
if [[ ! -f "$OPERONE_DIR/docker-compose.yml" ]]; then
  if [[ -n "$GIT_REPO" ]]; then
    git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
  else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    rsync -a --exclude node_modules --exclude .next "$REPO_ROOT/" "$OPERONE_DIR/" \
      || cp -a "$REPO_ROOT/." "$OPERONE_DIR/"
  fi
fi

cd "$OPERONE_DIR"
if [[ ! -f .env ]]; then
  cp .env.example .env
  log "已生成 .env，请确认 OPENAI_API_KEY / SUPER_ADMIN_SECRET"
fi

docker compose up -d --build
docker compose ps
log "访问 http://$(hostname -I | awk '{print $1}'):6666"
log "样品馆: docker compose exec web npm run seed:samples"
log "日志:   docker compose logs -f web"
