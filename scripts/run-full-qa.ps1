# 全量 QA：migrate → seed → build → 离线脚本 → dev:8888 → Playwright → 手测
# 可选：$env:RUN_LLM_QA="1" 跑 LiteLLM 三模块（约 15min）；$env:GODOT_E2E="1" 含 16 模板 Godot 矩阵
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:DATABASE_URL = "file:./prisma/ci.sqlite"
$env:E2E_REFINE_STUB = "1"
$env:E2E_AGENTIC_FALLBACK_ONLY = "1"
$env:E2E_COMIC_STUB = if ($env:E2E_COMIC_STUB) { $env:E2E_COMIC_STUB } else { "1" }
$env:PORT = "8888"

if ($env:RUN_LLM_QA -eq "1") {
  Write-Host "[full-qa] qa:llm-full-pipeline (LiteLLM 真实链路)"
  $env:SKIP_COMIC_PANELS = if ($env:SKIP_COMIC_PANELS) { $env:SKIP_COMIC_PANELS } else { "1" }
  npm run qa:llm-full-pipeline | Out-Host
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "[full-qa] prisma migrate deploy"
npx prisma migrate deploy | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-qa] seed samples"
npm run seed:samples | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-qa] npm run build"
npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$p = (netstat -ano | findstr ":8888" | findstr LISTENING | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }

Write-Host "[full-qa] npm run dev (background, ci.sqlite)"
$proc = Start-Process cmd.exe -ArgumentList "/c","set DATABASE_URL=file:./prisma/ci.sqlite&& set E2E_REFINE_STUB=1&& set E2E_AGENTIC_FALLBACK_ONLY=1&& set E2E_COMIC_STUB=1&& set PORT=8888&& npm run dev" -PassThru -WindowStyle Hidden -WorkingDirectory (Get-Location)
$healthUrl = "http://127.0.0.1:8888/api/health"
$deadline = (Get-Date).AddMinutes(4)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    if ((Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { break }
  } catch { }
}
if ((Get-Date) -ge $deadline) { Write-Error "server not ready"; exit 1 }
Write-Host "[full-qa] server ready pid $($proc.Id)"

$env:DATABASE_URL = "file:./prisma/ci.sqlite"
npm run qa:astrocade-pipeline | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run qa:director-spec | Out-Host
npm run qa:refinement-log | Out-Host
npm run qa:novel-comic-smoke | Out-Host
npm run qa:studio-duplicate | Out-Host
npm run qa:multilingual-locale | Out-Host
npm run qa:novel-locale | Out-Host
npm run qa:seed-en-fixtures | Out-Host
npm run qa:en-path | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run qa:b-tier-smoke | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run qa:admin-console | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:PW_EXTERNAL = "1"
Write-Host "[full-qa] playwright e2e"
if ($env:GODOT_E2E -eq "1") {
  npx playwright test e2e/ --reporter=line
} else {
  Write-Host "[full-qa] (skip Godot 16-template matrix; set GODOT_E2E=1 to include)"
  npx playwright test e2e/ --grep-invert "Godot 标签" --reporter=line
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:COMIC_HANDTEST = "1"
Write-Host "[full-qa] simulate-handtest"
node scripts/simulate-handtest.mjs
$code = $LASTEXITCODE

if ($proc -and -not $proc.HasExited) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

exit $code
