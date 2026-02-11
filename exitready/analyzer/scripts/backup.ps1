# scripts/backup.ps1

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipPath = "backups/accounting-analyzer_backup_$timestamp.zip"

$itemsToZip = Get-ChildItem -Recurse -File |
    Where-Object {
        $_.FullName -notmatch '\\backups\\' -and
        $_.FullName -notmatch '\\\.git\\' -and
        $_.FullName -notmatch '\\venv\\' -and
        $_.FullName -notmatch '\\__pycache__\\' -and
        $_.Extension -ne '.pyc'
    }

Compress-Archive -Path $itemsToZip.FullName -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "✅ Backup created at $zipPath"
