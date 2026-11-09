$ErrorActionPreference = 'Stop'
$lock = Join-Path $PSScriptRoot 'package-lock.json'
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host 'Se retiro package-lock.json antiguo para permitir resolver firebase-admin 13.5.0.' -ForegroundColor Yellow
}
Write-Host 'Hotfix V4.15.2 preparado. Revisa package.json y publica esta version en Vercel.' -ForegroundColor Green
