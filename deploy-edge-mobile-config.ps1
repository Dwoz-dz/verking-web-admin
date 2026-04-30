# Deploy admin-mobile-config edge function (Phase 12 — media + quick chips).
#
# Usage:
#   1. Install Supabase CLI once:  npm i -g supabase
#   2. supabase login
#   3. supabase link --project-ref qvbskdjvnpjjmtufvnly
#   4. .\deploy-edge-mobile-config.ps1
#
# This script keeps the existing v12 contract:
#   • verify_jwt = false  (auth via X-Admin-Token header)
#   • all 3 files (index.ts, handlers.ts, validators.ts) deploy together

$ErrorActionPreference = "Stop"

$projectRef = "qvbskdjvnpjjmtufvnly"
$functionName = "admin-mobile-config"
$srcDir = "$PSScriptRoot\supabase\functions\$functionName"

if (!(Test-Path "$srcDir\index.ts")) {
    throw "index.ts not found at $srcDir"
}

Write-Host "Deploying $functionName to project $projectRef..." -ForegroundColor Cyan
& supabase functions deploy $functionName `
    --project-ref $projectRef `
    --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    throw "supabase functions deploy failed (exit $LASTEXITCODE)"
}

Write-Host "Deploy complete." -ForegroundColor Green
