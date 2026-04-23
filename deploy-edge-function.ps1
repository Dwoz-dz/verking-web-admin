# Deploy the updated make-server-ea36795c edge function to Supabase
# Prereq: set SUPABASE_ACCESS_TOKEN to your personal access token from
#   https://supabase.com/dashboard/account/tokens
#
# Usage (PowerShell from repo root):
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   .\deploy-edge-function.ps1

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Missing SUPABASE_ACCESS_TOKEN env var." -ForegroundColor Red
  Write-Host "Get one at https://supabase.com/dashboard/account/tokens, then:" -ForegroundColor Yellow
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_xxx..."' -ForegroundColor Yellow
  exit 1
}

Write-Host "Deploying make-server-ea36795c to project qvbskdjvnpjjmtufvnly..." -ForegroundColor Cyan
npx supabase@latest functions deploy make-server-ea36795c `
  --project-ref qvbskdjvnpjjmtufvnly `
  --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✓ Deploy complete." -ForegroundColor Green
} else {
  Write-Host "`n✗ Deploy failed (exit $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}
