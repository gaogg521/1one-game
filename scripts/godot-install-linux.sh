#!/usr/bin/env bash
# 安装 Godot 4.4.1 Linux 便携版到 tools/godot（CI / Linux 开发机）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/godot"
VERSION="4.4.1"
BIN_NAME="Godot_v${VERSION}-stable_linux.x86_64"
BIN_PATH="$TOOLS_DIR/$BIN_NAME"
ZIP_URL="https://github.com/godotengine/godot/releases/download/${VERSION}-stable/Godot_v${VERSION}-stable_linux.x86_64.zip"
ZIP_PATH="$TOOLS_DIR/godot-linux.zip"

mkdir -p "$TOOLS_DIR"

if [[ -x "$BIN_PATH" ]]; then
  echo "[godot:install:linux] 已存在 $BIN_PATH"
  "$BIN_PATH" --version
  exit 0
fi

echo "[godot:install:linux] 下载 $ZIP_URL"
curl -fsSL --retry 3 -o "$ZIP_PATH" "$ZIP_URL"
unzip -o -q "$ZIP_PATH" -d "$TOOLS_DIR"
chmod +x "$TOOLS_DIR"/Godot_v"${VERSION}"-stable_linux.x86_64 2>/dev/null || true
if [[ ! -x "$BIN_PATH" ]]; then
  # 部分 zip 仅含单层可执行文件
  FOUND="$(find "$TOOLS_DIR" -maxdepth 2 -name 'Godot_v*-linux.x86_64' -type f | head -1)"
  if [[ -n "$FOUND" && "$FOUND" != "$BIN_PATH" ]]; then
    mv "$FOUND" "$BIN_PATH"
  fi
fi
chmod +x "$BIN_PATH"
rm -f "$ZIP_PATH"
"$BIN_PATH" --version
echo "[godot:install:linux] 完成: $BIN_PATH"
echo "export GODOT_BIN=$BIN_PATH"
