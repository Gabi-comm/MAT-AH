# Start MAT-AH: sets up on first run, then serves http://127.0.0.1:8765 and opens it.
# Usage:  powershell -ExecutionPolicy Bypass -File .\run.ps1 [-Demo] [-Rebuild]
param([switch]$Demo, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host 'Creating Python environment...'
    py -3.13 -m venv .venv
    if (-not $?) { py -3 -m venv .venv }
    .\.venv\Scripts\python -m pip install --upgrade pip
    .\.venv\Scripts\python -m pip install -r requirements.txt
}

if ($Rebuild -or -not (Test-Path web\dist\index.html)) {
    Write-Host 'Building the web UI...'
    Push-Location web
    if (-not (Test-Path node_modules)) { npm install }
    npm run build
    Pop-Location
}

if ($Demo) {
    Write-Host 'Regenerating the synthetic demo folder...'
    .\.venv\Scripts\python scripts\make_demo_data.py --reset
}

try {
    Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 2 | Out-Null
} catch {
    Write-Warning 'Ollama is not running. Search, Linis and opening files still work; start Ollama for answers and Kilos.'
}

Start-Job { Start-Sleep 3; Start-Process 'http://127.0.0.1:8765' } | Out-Null
Write-Host 'MAT-AH on http://127.0.0.1:8765  (Ctrl+C to stop)'
.\.venv\Scripts\python -m uvicorn backend.app:app --host 127.0.0.1 --port 8765
