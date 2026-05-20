# 导出母版 Web 构建到 public/godot-builds/mother-platformer/
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$GodotScript = Join-Path $RepoRoot "scripts\godot.ps1"
$Proj = Join-Path $RepoRoot "godot-templates\ai-mother-platformer"
$OutDir = Join-Path $RepoRoot "public\godot-builds\mother-platformer"
$TemplatesVer = "4.4.1.stable"
$TemplatesDir = Join-Path $env:APPDATA "Godot\export_templates\$TemplatesVer"
$MinTemplatesBytes = 900MB

function Ensure-ExportTemplates {
  if (Test-Path (Join-Path $TemplatesDir "web_nothreads_release.zip")) {
    Write-Host "[godot:export] 导出模板已存在: $TemplatesDir"
    return
  }
  $zip = Join-Path $RepoRoot "tools\godot\export_templates.zip"
  $cdn = "https://downloads.godotengine.org/?version=4.4.1&flavor=stable&slug=export_templates.tpz&platform=templates"
  if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt $MinTemplatesBytes) {
    Write-Host "[godot:export] 下载 export_templates (~1.1GB)，请耐心等待..."
    curl.exe --ssl-no-revoke -L --retry 5 -o $zip $cdn
    if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt $MinTemplatesBytes) {
      throw "export_templates 下载不完整"
    }
  }
  $tmp = Join-Path $RepoRoot "tools\godot\templates_extract"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $src = Join-Path $tmp "templates"
  if (-not (Test-Path $src)) { throw "解压后未找到 templates 目录" }
  New-Item -ItemType Directory -Force -Path $TemplatesDir | Out-Null
  Copy-Item -Path (Join-Path $src "*") -Destination $TemplatesDir -Force
  Write-Host "[godot:export] 模板已安装到 $TemplatesDir"
}

Ensure-ExportTemplates
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

& $GodotScript --headless --path $Proj --import | Out-Null
Write-Host "[godot:export] 导出 Web -> $OutDir"
& $GodotScript --headless --path $Proj --export-release "Web" (Join-Path $OutDir "index.html")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[godot:export] 完成。可在静态服务下打开 index.html"
