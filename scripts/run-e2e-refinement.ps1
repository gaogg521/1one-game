# 本地跑 refinement E2E：先 build + migrate，再起 prod server，最后 Playwright（PW_EXTERNAL=1）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./ci.sqlite" }
$env:E2E_REFINE_STUB = "1"
$env:PORT = "8888"

Write-Host "[e2e] prisma migrate deploy ($env:DATABASE_URL)"
npx prisma migrate deploy | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[e2e] npm run build"
npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$healthUrl = "http://localhost:8888/api/health"
try {
  $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
  if ($r.StatusCode -eq 200) {
    Write-Host "[e2e] server already up on :8888"
  }
} catch {
  Write-Host "[e2e] starting npm run start (background)"
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run start" -PassThru -WindowStyle Hidden -WorkingDirectory (Get-Location)
  $deadline = (Get-Date).AddMinutes(5)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) {
        Write-Host "[e2e] server ready (pid $($proc.Id))"
        break
      }
    } catch { }
  }
  if ((Get-Date) -ge $deadline) {
    Write-Error "[e2e] server did not become ready in 5 min"
    exit 1
  }
}

$env:PW_EXTERNAL = "1"
Write-Host "[e2e] playwright test e2e/refinement.smoke.spec.ts"
npx playwright test e2e/refinement.smoke.spec.ts
exit $LASTEXITCODE
