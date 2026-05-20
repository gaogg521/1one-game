#!/usr/bin/env bash
# CI 一键：Godot 引擎 + 导出模板（Linux）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/godot-install-linux.sh"
bash "$SCRIPT_DIR/godot-install-templates-linux.sh"
