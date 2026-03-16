# LekhaFlow Database Migration Helper
# This script copies each SQL migration to your clipboard automatically

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  LekhaFlow Database Migration Helper" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Copy each SQL migration to your clipboard" -ForegroundColor Yellow
Write-Host "  2. Open Supabase SQL Editor in your browser" -ForegroundColor Yellow
Write-Host "  3. You just paste (Ctrl+V) and click Run!" -ForegroundColor Yellow
Write-Host ""

$migrations = @(
    @{
        Name = "RBAC Tables"
        File = "rbac.sql"
        Icon = "[1/3]"
    },
    @{
        Name = "Room Chat"
        File = "room_chat.sql"
        Icon = "[2/3]"
    },
    @{
        Name = "Notifications"
        File = "notifications.sql"
        Icon = "[3/3]"
    }
)

$supabaseUrl = "https://supabase.com/dashboard/project/khajsxndtqzfkdnpwqdk/sql/new"

foreach ($migration in $migrations) {
    Write-Host "`n=========================================" -ForegroundColor Green
    Write-Host "$($migration.Icon) Migration: $($migration.Name)" -ForegroundColor Green
    Write-Host "=========================================`n" -ForegroundColor Green
    
    $filePath = Join-Path $PSScriptRoot $migration.File
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[ERROR] File not found: $($migration.File)" -ForegroundColor Red
        continue
    }
    
    # Read SQL file
    $sql = Get-Content $filePath -Raw
    
    # Copy to clipboard
    Set-Clipboard -Value $sql
    
    Write-Host "[OK] Copied $($migration.Name) SQL to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Press ENTER to open Supabase SQL Editor" -ForegroundColor White
    Write-Host "  2. Paste (Ctrl+V) in the editor" -ForegroundColor White
    Write-Host "  3. Click 'Run' button" -ForegroundColor White
    Write-Host "  4. Come back here and press ENTER to continue" -ForegroundColor White
    Write-Host ""
    
    $null = Read-Host "Press ENTER when ready"
    
    # Open Supabase SQL Editor
    Start-Process $supabaseUrl
    
    Write-Host "`nWaiting for you to run the SQL..." -ForegroundColor Cyan
    $null = Read-Host "Press ENTER after you've run the SQL in Supabase"
    
    Write-Host "[OK] $($migration.Name) complete!`n" -ForegroundColor Green
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: All Migrations Complete!" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Refresh your browser at http://localhost:3000" -ForegroundColor White
Write-Host "  2. The chat should work now!" -ForegroundColor White
Write-Host "  3. Test all collaboration features`n" -ForegroundColor White

Read-Host "Press ENTER to exit"
