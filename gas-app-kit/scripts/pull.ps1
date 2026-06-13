# Non-interactive pull script for GAS App Kit (Windows PowerShell).
# Downloads the latest files from Google Apps Script.
# Exit codes: 0 = success, 1 = setup needed, 2 = error.

param(
    [string]$ProjectDir = "",
    [string]$ClaspPath = ""
)

$ErrorActionPreference = "Stop"

function Log($msg) { Write-Output "[gas-pull] $msg" }
function Err($msg) { Write-Error "[gas-pull] ERROR: $msg"; exit 2 }
function SetupNeeded($msg) { Write-Error "[gas-pull] ERROR: $msg"; exit 1 }

if ($ProjectDir) {
    if (-not (Test-Path $ProjectDir -PathType Container)) { Err "Project dir not found: $ProjectDir" }
    Set-Location $ProjectDir
}

# Read claspPath from state
if (-not $ClaspPath -and (Test-Path ".gas-app/state.json")) {
    try {
        $state = Get-Content ".gas-app/state.json" -Raw | ConvertFrom-Json
        if ($state.claspPath) { $ClaspPath = $state.claspPath }
    } catch { }
}

function Invoke-Clasp {
    param([string[]]$Args)
    if ($ClaspPath) { & $ClaspPath @Args 2>&1 }
    else { clasp @Args 2>&1 }
}

# Check clasp
$claspAvailable = $false
try { Invoke-Clasp "--version" | Out-Null; $claspAvailable = $true } catch { }
if (-not $claspAvailable) {
    SetupNeeded "clasp not found. Run: npm install -g @google/clasp"
}

# Check auth
$authTest = (Invoke-Clasp "list") -join " "
if ($authTest -match "not logged in|login required|ENOTLOGGEDIN|no credentials|authorize") {
    SetupNeeded "clasp not logged in. Run: clasp login"
}

if (-not (Test-Path ".clasp.json")) { Err "No .clasp.json found. Run gas-init-project first." }

Log "Pulling from Google Apps Script..."
$pullOutput = Invoke-Clasp "pull"
if ($LASTEXITCODE -ne 0) { Err "clasp pull failed: $($pullOutput -join ' ')" }
Log ($pullOutput -join "`n")
Log "Done."
exit 0
