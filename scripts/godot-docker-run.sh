#!/usr/bin/env bash
# CentOS 7 等 glibc 过旧时，在 Debian 容器内执行 Godot（与宿主机 glibc 无关）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT_IMAGE="${GODOT_DOCKER_IMAGE:-operone-godot:4.4.1}"
WORKDIR_IN_CONTAINER="${1:?workdir}"
shift
GODOT_ARGS=("$@")

ensure_image() {
  if docker image inspect "$GODOT_IMAGE" >/dev/null 2>&1; then
    return 0
  fi
  echo "[godot:docker] 构建镜像 $GODOT_IMAGE（首次约 1–2 分钟）…"
  docker build -f "$REPO_ROOT/scripts/deploy/Dockerfile.godot" -t "$GODOT_IMAGE" "$REPO_ROOT"
}

ensure_image

docker run --rm \
  -v "$REPO_ROOT:/app" \
  -w "/app/${WORKDIR_IN_CONTAINER#/}" \
  -e XDG_DATA_HOME=/app/.local/share \
  -e HOME=/app \
  "$GODOT_IMAGE" \
  "${GODOT_ARGS[@]}"
