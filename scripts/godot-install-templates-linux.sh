#!/usr/bin/env bash
# 安装 Godot 4.4.1 Web 导出模板（Linux CI：~/.local/share/godot/export_templates/）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/godot"
VERSION="4.4.1.stable"
TEMPLATES_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/godot/export_templates/$VERSION"
MARKER="$TEMPLATES_DIR/web_nothreads_release.zip"
MIN_BYTES=$((900 * 1024 * 1024))
ZIP_PATH="$TOOLS_DIR/export_templates.tpz"
TPZ_URL="https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_export_templates.tpz"

mkdir -p "$TOOLS_DIR" "$TEMPLATES_DIR"

if [[ -f "$MARKER" ]]; then
  echo "[godot:templates:linux] 已存在 $TEMPLATES_DIR"
  exit 0
fi

if [[ ! -f "$ZIP_PATH" ]] || [[ "$(wc -c < "$ZIP_PATH")" -lt "$MIN_BYTES" ]]; then
  echo "[godot:templates:linux] 下载 export_templates (~1.1GB)…"
  curl -fsSL --retry 3 -o "$ZIP_PATH" "$TPZ_URL"
fi

if [[ "$(wc -c < "$ZIP_PATH")" -lt "$MIN_BYTES" ]]; then
  echo "[godot:templates:linux] 下载不完整: $ZIP_PATH" >&2
  exit 1
fi

TMP="$TOOLS_DIR/templates_extract"
rm -rf "$TMP"
mkdir -p "$TMP"
unzip -o -q "$ZIP_PATH" -d "$TMP"
SRC="$TMP/templates"
if [[ ! -d "$SRC" ]]; then
  echo "[godot:templates:linux] 解压后未找到 templates/" >&2
  exit 1
fi
cp -a "$SRC/." "$TEMPLATES_DIR/"
rm -rf "$TMP"
echo "[godot:templates:linux] 已安装到 $TEMPLATES_DIR"
