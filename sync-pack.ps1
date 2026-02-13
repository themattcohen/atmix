## sync-pack.ps1 - Bundle Claude config + env files into encrypted archive
param(
    [string]$Password
)

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\1matt\OneDrive\Documents\atmix"
$claudeDir = "C:\Users\1matt\.claude"
$tempDir = Join-Path $env:TEMP "claude-sync-$(Get-Random)"
$tarFile = Join-Path $env:TEMP "claude-sync.tar"
$outputFile = Join-Path $repoRoot "claude-sync.enc"

Write-Host "=== Claude Config Sync Packer ===" -ForegroundColor Cyan

# Create temp staging directory
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\claude-config" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\env-files" -Force | Out-Null

# --- Copy Claude config files ---
Write-Host "Copying Claude config files..." -ForegroundColor Yellow

# Root-level config files
$rootFiles = @(
    "CLAUDE.md", "FLAGS.md", "PRINCIPLES.md", "RULES.md",
    "BUSINESS_PANEL_EXAMPLES.md", "BUSINESS_SYMBOLS.md",
    "MCP_Context7.md", "MCP_Magic.md", "MCP_Morphllm.md",
    "MCP_Playwright.md", "MCP_Sequential.md", "MCP_Serena.md", "MCP_Tavily.md",
    "MODE_Brainstorming.md", "MODE_Business_Panel.md", "MODE_DeepResearch.md",
    "MODE_Introspection.md", "MODE_Orchestration.md", "MODE_Task_Management.md",
    "MODE_Token_Efficiency.md", "RESEARCH_CONFIG.md",
    "settings.json", "settings.local.json",
    ".credentials.json", ".superclaude-metadata.json"
)
foreach ($f in $rootFiles) {
    $src = Join-Path $claudeDir $f
    if (Test-Path $src) {
        Copy-Item $src "$tempDir\claude-config\$f"
        Write-Host "  + $f" -ForegroundColor Green
    }
}

# agents/ directory
if (Test-Path "$claudeDir\agents") {
    Copy-Item "$claudeDir\agents" "$tempDir\claude-config\agents" -Recurse
    Write-Host "  + agents/ directory" -ForegroundColor Green
}

# commands/ directory
if (Test-Path "$claudeDir\commands") {
    Copy-Item "$claudeDir\commands" "$tempDir\claude-config\commands" -Recurse
    Write-Host "  + commands/ directory" -ForegroundColor Green
}

# plugins/ directory
if (Test-Path "$claudeDir\plugins") {
    Copy-Item "$claudeDir\plugins" "$tempDir\claude-config\plugins" -Recurse
    Write-Host "  + plugins/ directory" -ForegroundColor Green
}

# --- Copy .env files with relative paths ---
Write-Host "Copying .env files..." -ForegroundColor Yellow

$envFiles = @(
    ".env",
    "bluebucket\.env",
    "bluebucket\server\.env",
    "bluebucket\server\.env.test",
    "exitready\backend\.env",
    "exitready\frontend\.env",
    "someday\.env"
)
foreach ($envPath in $envFiles) {
    $src = Join-Path $repoRoot $envPath
    if (Test-Path $src) {
        $destDir = Join-Path "$tempDir\env-files" (Split-Path $envPath -Parent)
        if ($destDir -and -not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item $src (Join-Path "$tempDir\env-files" $envPath)
        Write-Host "  + $envPath" -ForegroundColor Green
    } else {
        Write-Host "  - $envPath (not found, skipping)" -ForegroundColor DarkGray
    }
}

# --- Create tar archive ---
Write-Host "Creating tar archive..." -ForegroundColor Yellow
Push-Location $tempDir
& "$env:SystemRoot\System32\tar.exe" -cf $tarFile *
Pop-Location

$tarSize = [math]::Round((Get-Item $tarFile).Length / 1KB, 1)
Write-Host "  Archive size: ${tarSize} KB" -ForegroundColor Cyan

# --- Encrypt with OpenSSL ---
Write-Host "Encrypting with AES-256-CBC..." -ForegroundColor Yellow
$openssl = "C:\Program Files\Git\usr\bin\openssl.exe"

& $openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in $tarFile -out $outputFile -pass "pass:$Password"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Encryption failed!" -ForegroundColor Red
    exit 1
}

$encSize = [math]::Round((Get-Item $outputFile).Length / 1KB, 1)
Write-Host "  Encrypted file: $outputFile (${encSize} KB)" -ForegroundColor Cyan

# --- Cleanup ---
Remove-Item $tempDir -Recurse -Force
Remove-Item $tarFile -Force

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Encrypted bundle saved to: claude-sync.enc" -ForegroundColor Green
Write-Host "Decrypt on another machine with:" -ForegroundColor Yellow
Write-Host "  openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 -in claude-sync.enc -out claude-sync.tar -pass pass:YOUR_PASSWORD" -ForegroundColor White
Write-Host "  tar -xf claude-sync.tar" -ForegroundColor White
