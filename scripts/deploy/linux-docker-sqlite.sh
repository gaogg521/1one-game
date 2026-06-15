#!/usr/bin/env bash
# 已合并到 install-docker.sh — 保留本文件作兼容入口
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/install-docker.sh" "$@"
