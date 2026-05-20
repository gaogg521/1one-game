# 下载 Godot 4.4.1 便携版到 tools/godot（无需管理员）
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $RepoRoot "tools\godot"
$Zip = Join-Path $ToolsDir "Godot_win64.zip"
$Exe = Join-Path $ToolsDir "Godot_v4.4.1-stable_win64_console.exe"

New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

if (Test-Path $Exe) {
  Write-Host "[godot:install] 已存在 $Exe"
  & $Exe --version
  $font = Join-Path $RepoRoot "godot-templates\ai-mother-universal\fonts\NotoSansSC-Regular.woff2"
  if (-not (Test-Path $font) -or (Get-Item $font).Length -lt 100000) {
    Write-Host "[godot:install] 提示: 运行 npm install 后首次 Godot 导出会自动拉取中文字体；或手动复制 node_modules\@fontsource\noto-sans-sc\files\*.woff2"
  }
  exit 0
}

$urls = @(
  "https://downloads.godotengine.org/?version=4.4.1&flavor=stable&slug=win64.exe.zip&platform=windows.64",
  "https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_win64.exe.zip"
)

foreach ($url in $urls) {
  Write-Host "[godot:install] 尝试下载: $url"
  try {
    curl.exe --ssl-no-revoke -L --retry 3 -o $Zip $url 2>$null
    if ((Test-Path $Zip) -and (Get-Item $Zip).Length -gt 1MB) { break }
  } catch {
    Write-Host "  失败: $($_.Exception.Message)"
  }
}

if (-not (Test-Path $Zip) -or (Get-Item $Zip).Length -lt 1MB) {
  Write-Host "[godot:install] 下载失败。可手动安装: winget install GodotEngine.GodotEngine"
  exit 1
}

Expand-Archive -Path $Zip -DestinationPath $ToolsDir -Force
& $Exe --version
Write-Host "[godot:install] 完成: $Exe"
