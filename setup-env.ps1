# Setup script to create .env symlink for Strapi
# Run this after creating root .env file

Write-Host "=== Environment Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if root .env exists
if (-not (Test-Path ".\.env")) {
    Write-Host "✗ Root .env file not found!" -ForegroundColor Red
    Write-Host "  Please create .env file from .env.example first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Root .env file found" -ForegroundColor Green

# Check if backend/.env already exists
if (Test-Path "backend\.env") {
    Write-Host ""
    Write-Host "⚠ backend/.env already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to replace it with a symlink to root .env? (y/n)"
    if ($response -ne "y") {
        Write-Host "Skipping symlink creation" -ForegroundColor Gray
        exit 0
    }
    Remove-Item "backend\.env" -Force
}

# Create symlink (requires admin privileges on Windows)
Write-Host ""
Write-Host "Creating symlink: backend\.env -> ..\.env" -ForegroundColor Yellow

try {
    # Try creating symlink
    $target = Resolve-Path ".\.env"
    New-Item -ItemType SymbolicLink -Path "backend\.env" -Target $target -Force | Out-Null
    Write-Host "✓ Symlink created successfully!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create symlink: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Copy root .env to backend/.env manually" -ForegroundColor Yellow
    Write-Host "  Copy-Item .\.env backend\.env" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan

