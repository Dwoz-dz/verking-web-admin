# ═══════════════════════════════════════════════════════════════════════════
# Deploy Edge Function Fix: Categories UUID Bug
# ═══════════════════════════════════════════════════════════════════════════
# What this fixes: POST /categories was silently failing because the edge
# function's uid() generator produced non-UUID strings that Postgres rejected.
# This script deploys the patched edge function that lets Postgres generate
# the UUID itself (and returns real error messages on failure).
#
# Requirements: Supabase Personal Access Token (PAT)
# Get one: https://supabase.com/dashboard/account/tokens
#
# Usage:
#   .\deploy-categories-fix.ps1 -Token "sbp_xxx..."
#   # or set env var: $env:SUPABASE_ACCESS_TOKEN = "sbp_..."; .\deploy-categories-fix.ps1
# ═══════════════════════════════════════════════════════════════════════════

param(
    [string]$Token = $env:SUPABASE_ACCESS_TOKEN,
    [string]$ProjectRef = "qvbskdjvnpjjmtufvnly",
    [string]$FunctionName = "make-server-ea36795c"
)

if (-not $Token) {
    Write-Host "ERROR: No access token provided." -ForegroundColor Red
    Write-Host "Get a token at https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
    Write-Host "Then run: .\deploy-categories-fix.ps1 -Token 'sbp_...'" -ForegroundColor Yellow
    exit 1
}

$ScriptRoot = Split-Path -Parent $PSCommandPath
$FunctionDir = Join-Path $ScriptRoot "supabase\functions\$FunctionName"

if (-not (Test-Path $FunctionDir)) {
    Write-Host "ERROR: Function directory not found at $FunctionDir" -ForegroundColor Red
    exit 1
}

Write-Host "Reading function files from $FunctionDir ..." -ForegroundColor Cyan

$files = @()
Get-ChildItem -Path $FunctionDir -File | Where-Object {
    $_.Extension -in '.ts', '.tsx' -and $_.Name -notlike '*.bak'
} | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw -Encoding UTF8
    $files += @{
        name    = $_.Name
        content = $content
    }
    Write-Host "  + $($_.Name) ($($content.Length) chars)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Total files: $($files.Count)" -ForegroundColor Green
Write-Host "Deploying to project $ProjectRef ..." -ForegroundColor Cyan

# Build metadata for the multipart form
$metadata = @{
    entrypoint_path = "index.ts"
    verify_jwt      = $false
    name            = $FunctionName
} | ConvertTo-Json -Compress

# Supabase Management API: POST /v1/projects/{ref}/functions/deploy
$uri = "https://api.supabase.com/v1/projects/$ProjectRef/functions/deploy?slug=$FunctionName"

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = New-Object System.Collections.ArrayList

# metadata part
[void]$bodyLines.Add("--$boundary")
[void]$bodyLines.Add('Content-Disposition: form-data; name="metadata"')
[void]$bodyLines.Add('Content-Type: application/json')
[void]$bodyLines.Add('')
[void]$bodyLines.Add($metadata)

# file parts
foreach ($f in $files) {
    [void]$bodyLines.Add("--$boundary")
    [void]$bodyLines.Add("Content-Disposition: form-data; name=`"file`"; filename=`"$($f.name)`"")
    [void]$bodyLines.Add('Content-Type: application/typescript')
    [void]$bodyLines.Add('')
    [void]$bodyLines.Add($f.content)
}
[void]$bodyLines.Add("--$boundary--")

$body = $bodyLines -join $LF

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "multipart/form-data; boundary=$boundary"
}

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host ""
    Write-Host "SUCCESS — edge function deployed" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host ""
    Write-Host "DEPLOY FAILED:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Try creating a category in the admin panel"
Write-Host "  2. Check it appears in the Categories list"
Write-Host "  3. Check it appears in the Product editor dropdown"
