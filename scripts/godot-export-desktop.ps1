# 本地 Windows：按 GameSpec 打出 PC 可执行 zip
# 用法: npm run godot:export:desktop -- "保卫萝卜塔防"
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Prompt = if ($args.Count -gt 0) { $args -join " " } else { "保卫萝卜塔防" }

Push-Location $RepoRoot
try {
  npx tsx scripts/qa-godot-export-desktop.ts $Prompt
} finally {
  Pop-Location
}
