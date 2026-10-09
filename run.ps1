# Start MAT-AH: sets up on first run, then serves http://127.0.0.1:8765 and opens it.
# Usage:  powershell -ExecutionPolicy Bypass -File .\run.ps1 [-Demo] [-Rebuild]
param([switch]$Demo, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$env:HF_HUB_DISABLE_XET = '1'  # plain HTTP model downloads (Xet stalled on this network)
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host 'Creating Python environment...'
    try {
        py -3.13 -m venv .venv
    } catch {
        Write-Host 'Python 3.13 not found; using default Python 3...'
        py -3 -m venv .venv
    }
    .\.venv\Scripts\python -m pip install --upgrade pip
    .\.venv\Scripts\python -m pip install -r requirements.txt
}

if ($Rebuild -or -not (Test-Path dist\index.html)) {
    Write-Host 'Building the web UI...'
    if (-not (Test-Path node_modules)) { npm install }
    npm run build
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
