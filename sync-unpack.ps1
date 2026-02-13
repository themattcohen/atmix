## sync-unpack.ps1 - Decrypt and restore Claude config + env files
## Run this on the target machine after pulling the repo
param(
    [string]$Password,
    [string]$RepoRoot = (Get-Location).Path,
    [string]$ClaudeDir = "$env:USERPROFILE\.claude"
)

$ErrorActionPreference = "Stop"
$encFile = Join-Path $RepoRoot "claude-sync.enc"
$tarFile = Join-Path $env:TEMP "claude-sync.tar"
$tempDir = Join-Path $env:TEMP "claude-sync-unpack-$(Get-Random)"

if (-not (Test-Path $encFile)) {
    Write-Host "ERROR: claude-sync.enc not found in $RepoRoot" -ForegroundColor Red
    exit 1
}

Write-Host "=== Claude Config Sync Unpacker ===" -ForegroundColor Cyan

# --- Find OpenSSL ---
$openssl = $null
foreach ($path in @(
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files\Git\mingw64\bin\openssl.exe",
    (Get-Command openssl -ErrorAction SilentlyContinue).Source
)) {
    if ($path -and (Test-Path $path)) { $openssl = $path; break }
}
if (-not $openssl) {
    Write-Host "ERROR: OpenSSL not found. Install Git for Windows or add openssl to PATH." -ForegroundColor Red
    exit 1
}

# --- Decrypt ---
Write-Host "Decrypting archive..." -ForegroundColor Yellow
& $openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 -in $encFile -out $tarFile -pass "pass:$Password"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Decryption failed! Wrong password?" -ForegroundColor Red
    exit 1
}

# --- Extract ---
Write-Host "Extracting files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Push-Location $tempDir
tar -xf $tarFile
Pop-Location

# --- Restore Claude config ---
Write-Host "Restoring Claude config to $ClaudeDir ..." -ForegroundColor Yellow

if (-not (Test-Path $ClaudeDir)) {
    New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null
}

# Copy root config files
Get-ChildItem "$tempDir\claude-config" -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $ClaudeDir $_.Name) -Force
    Write-Host "  + $($_.Name)" -ForegroundColor Green
}

# Copy directories (agents, commands, plugins)
foreach ($dir in @("agents", "commands", "plugins")) {
    $src = Join-Path "$tempDir\claude-config" $dir
    if (Test-Path $src) {
        $dest = Join-Path $ClaudeDir $dir
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item $src $dest -Recurse
        Write-Host "  + $dir/ directory" -ForegroundColor Green
    }
}

# --- Restore .env files ---
Write-Host "Restoring .env files to $RepoRoot ..." -ForegroundColor Yellow

Get-ChildItem "$tempDir\env-files" -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring("$tempDir\env-files\".Length)
    $destPath = Join-Path $RepoRoot $relativePath
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $_.FullName $destPath -Force
    Write-Host "  + $relativePath" -ForegroundColor Green
}

# --- Cleanup ---
Remove-Item $tempDir -Recurse -Force
Remove-Item $tarFile -Force

Write-Host ""
Write-Host "=== Done! All files restored. ===" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Verify your .env files and Claude config are correct before using." -ForegroundColor Yellow
