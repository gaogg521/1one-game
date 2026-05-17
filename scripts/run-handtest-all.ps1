# 模拟人工验收一键脚本（需先 build + start :8888）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./ci.sqlite" }
$env:E2E_REFINE_STUB = "1"

Write-Host "[handtest] prisma migrate deploy"
npx prisma migrate deploy | Out-Host

Write-Host "[handtest] offline QA"
npm run qa:template-matrix | Out-Host
npm run qa:director-spec | Out-Host
npm run qa:refinement-log | Out-Host
npm run qa:studio-duplicate | Out-Host
npm run qa:novel-comic-smoke | Out-Host

$healthUrl = "http://localhost:8888/api/health"
try {
  Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
} catch {
  Write-Host "[handtest] starting npm run start (background)"
  Start-Process cmd.exe -ArgumentList "/c","set DATABASE_URL=file:./ci.sqlite&& set E2E_REFINE_STUB=1&& set PORT=8888&& npm run start" -WindowStyle Hidden -WorkingDirectory (Get-Location)
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
      if ((Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { break }
    } catch { }
  }
}

$env:PW_EXTERNAL = "1"
Write-Host "[handtest] playwright e2e"
npx playwright test e2e/ --reporter=line
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:COMIC_HANDTEST = "1"
Write-Host "[handtest] comic 8-page (LLM, may take several minutes)"
node scripts/simulate-handtest.mjs
exit $LASTEXITCODE
