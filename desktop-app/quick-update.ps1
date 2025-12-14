# Quick Update Script for Testing
# Run this to update the installed app without reinstalling

# Build the React app
Write-Host "Building React app..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\src"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Set-Location "$PSScriptRoot"

# Find installed app location (handles nested UniConsulting folder)
$installPaths = @(
    "C:\Program Files\UniConsulting\UniConsulting\resources\app",
    "C:\Program Files\UniConsulting\resources\app",
    "$env:LOCALAPPDATA\Programs\UniConsulting\resources\app"
)

$installPath = $null
foreach ($path in $installPaths) {
    Write-Host "Checking: $path" -ForegroundColor Gray
    if (Test-Path "$path\main.js") {
        $installPath = $path
        Write-Host "Found at: $path" -ForegroundColor Green
        break
    }
}

if (-not $installPath) {
    Write-Host "UniConsulting not installed or uses ASAR!" -ForegroundColor Red
    Write-Host "Please rebuild with: npx electron-builder --win nsis" -ForegroundColor Yellow
    exit 1
}

Write-Host "Updating installed app at: $installPath" -ForegroundColor Cyan

# Copy dist-react
$source = "$PSScriptRoot\dist-react"
$dest = "$installPath\dist-react"
if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}
Copy-Item -Recurse $source $dest
Write-Host "Updated dist-react" -ForegroundColor Green

# Copy main.js and preload.js
Copy-Item "$PSScriptRoot\main.js" "$installPath\main.js" -Force
Copy-Item "$PSScriptRoot\preload.js" "$installPath\preload.js" -Force
Write-Host "Updated main.js and preload.js" -ForegroundColor Green

Write-Host ""
Write-Host "Update complete! Restart UniConsulting to see changes." -ForegroundColor Green
