# 全量 QA：migrate → build → start :8888(ci.sqlite) → 离线脚本 → Playwright → 手测模拟
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:DATABASE_URL = "file:./prisma/ci.sqlite"
$env:E2E_REFINE_STUB = "1"
$env:PORT = "8888"

Write-Host "[full-qa] prisma migrate deploy"
npx prisma migrate deploy | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-qa] npm run build"
npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$p = (netstat -ano | findstr ":8888" | findstr LISTENING | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }

Write-Host "[full-qa] npm run start (background)"
$proc = Start-Process cmd.exe -ArgumentList "/c","set DATABASE_URL=file:./prisma/ci.sqlite&& set E2E_REFINE_STUB=1&& set PORT=8888&& npm run start" -PassThru -WindowStyle Hidden -WorkingDirectory (Get-Location)
$healthUrl = "http://127.0.0.1:8888/api/health"
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    if ((Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { break }
  } catch { }
}
if ((Get-Date) -ge $deadline) { Write-Error "server not ready"; exit 1 }
Write-Host "[full-qa] server ready pid $($proc.Id)"

$env:DATABASE_URL = "file:./prisma/ci.sqlite"
npm run qa:template-matrix | Out-Host
npm run qa:director-spec | Out-Host
npm run qa:refinement-log | Out-Host
npm run qa:novel-comic-smoke | Out-Host
$env:DATABASE_URL = "file:./prisma/ci.sqlite"
npm run qa:studio-duplicate | Out-Host

$env:PW_EXTERNAL = "1"
Write-Host "[full-qa] playwright e2e"
npx playwright test e2e/ --reporter=line
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:COMIC_HANDTEST = "1"
Write-Host "[full-qa] simulate-handtest (含 8 页分镜 HTTP)"
node scripts/simulate-handtest.mjs
exit $LASTEXITCODE
