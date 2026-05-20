# 仓库内 Godot 便携版入口（Windows）
# 用法: .\scripts\godot.ps1 --headless --path godot-templates\ai-mother-platformer --import

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$GodotBin = if ($env:GODOT_BIN) { $env:GODOT_BIN } else {
  Join-Path $RepoRoot "tools\godot\Godot_v4.4.1-stable_win64_console.exe"
}

if (-not (Test-Path $GodotBin)) {
  Write-Host "[godot] 未找到 $GodotBin"
  Write-Host "  运行: npm run godot:install"
  exit 1
}

& $GodotBin @args
