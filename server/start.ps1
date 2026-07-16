param(
  [switch]$install,
  [switch]$tunnel
)

$ServerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ServerDir

# Copy .env.local from project root if exists
if (-not (Test-Path ".env") -and (Test-Path "..\.env.local")) {
  Write-Host "Copying .env.local to server/.env ..." -ForegroundColor Yellow
  Copy-Item "..\.env.local" ".env"
}

if ($install) {
  Write-Host "Installing dependencies..." -ForegroundColor Green
  npm install
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Starting Source2Txt Server..." -ForegroundColor Cyan
Write-Host "  API: http://localhost:$($env:PORT -or 3001)" -ForegroundColor Cyan

if ($tunnel) {
  # Start Cloudflare Tunnel
  $process = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "index.js"
  Start-Sleep -Seconds 2

  Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Green
  Write-Host "Run this in another terminal:" -ForegroundColor Yellow
  Write-Host "  cloudflared tunnel --url http://localhost:$($env:PORT -or 3001)" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Or use the npm package:" -ForegroundColor Yellow
  Write-Host "  npx cloudflared tunnel --url http://localhost:$($env:PORT -or 3001)" -ForegroundColor Yellow

  # Try to use cloudflared if available
  $cloudflared = Get-Command "cloudflared.exe" -ErrorAction SilentlyContinue
  if ($cloudflared) {
    Write-Host "Found cloudflared, starting tunnel..." -ForegroundColor Green
    Invoke-Expression "cloudflared tunnel --url http://localhost:$($env:PORT -or 3001)"
  } else {
    Write-Host "cloudflared not found. Install it:" -ForegroundColor Yellow
    Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then run start.ps1 -tunnel again." -ForegroundColor Yellow
    Wait-Process -Id $process.Id
  }
} else {
  node index.js
}
