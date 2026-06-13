# Non-interactive push script for GAS App Kit (Windows PowerShell).
# Build + push the React app to Google Apps Script.
# Exit codes: 0 = success, 1 = setup needed, 2 = build/push error.
#
# Parameters:
#   -ProjectDir <path>    Run from this directory (default: current directory)
#   -Deploy               Create or update a versioned deployment after push
#   -DeployId <id>        Update an existing deployment in-place (same URL)
#   -DeployDesc <text>    Description (default: "GAS App deployment")
#   -ClaspPath <path>     Full path to clasp.cmd if not in PATH

param(
    [string]$ProjectDir = "",
    [switch]$Deploy,
    [string]$DeployId = "",
    [string]$DeployDesc = "GAS App deployment",
    [string]$ClaspPath = ""
)

$ErrorActionPreference = "Stop"

function Log($msg) { Write-Output "[gas-push] $msg" }
function Err($msg) {
    Write-Error "[gas-push] ERROR: $msg"
    exit 2
}
function SetupNeeded($msg) {
    Write-Error "[gas-push] ERROR: $msg"
    exit 1
}

# Navigate to project directory
if ($ProjectDir) {
    if (-not (Test-Path $ProjectDir -PathType Container)) {
        Err "Project dir not found: $ProjectDir"
    }
    Set-Location $ProjectDir
}

# ── Read claspPath from state if not passed ──────────────────────────────────
if (-not $ClaspPath -and (Test-Path ".gas-app/state.json")) {
    try {
        $state = Get-Content ".gas-app/state.json" -Raw | ConvertFrom-Json
        if ($state.claspPath) { $ClaspPath = $state.claspPath }
    } catch { }
}

$claspCmd = if ($ClaspPath) { $ClaspPath } else { "clasp" }

function Invoke-Clasp {
    param([string[]]$Args)
    if ($ClaspPath) {
        & $ClaspPath @Args 2>&1
    } else {
        clasp @Args 2>&1
    }
}

# ── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────────

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    SetupNeeded "node not installed. Download from https://nodejs.org"
}

$nodeVersion = (node -e "process.stdout.write(process.versions.node.split('.')[0])").Trim()
if ([int]$nodeVersion -lt 22) {
    SetupNeeded "Node.js >= 22 required (found v$nodeVersion). Download from https://nodejs.org"
}

# Check clasp
$claspAvailable = $false
try {
    Invoke-Clasp "--version" | Out-Null
    $claspAvailable = $true
} catch { }

if (-not $claspAvailable) {
    # Try finding clasp.cmd in npm global bin
    try {
        $npmGlobal = (npm root -g 2>$null).Trim()
        $npmBin = $npmGlobal -replace "\\node_modules$", "\clasp.cmd"
        if (Test-Path $npmBin) {
            $ClaspPath = $npmBin
            $claspAvailable = $true
        }
    } catch { }
}

if (-not $claspAvailable) {
    SetupNeeded "clasp not found. Run: npm install -g @google/clasp"
}

# Check auth
$authTest = Invoke-Clasp "list"
$authOutput = $authTest -join " "
if ($authOutput -match "not logged in|login required|ENOTLOGGEDIN|no credentials|authorize") {
    SetupNeeded "clasp not logged in. Run: clasp login"
}

if (-not (Test-Path ".clasp.json")) {
    Err "No .clasp.json in $(Get-Location). Run gas-init-project first."
}

if (-not (Test-Path "package.json")) {
    Err "No package.json found. Is this a GAS App Kit project?"
}

# Check rootDir
try {
    $claspJson = Get-Content ".clasp.json" -Raw | ConvertFrom-Json
    $rootDir = $claspJson.rootDir
    if ($rootDir -ne "./dist" -and $rootDir -ne "dist") {
        Err "DANGER: .clasp.json rootDir is '$rootDir' — must be './dist'. Fix before pushing."
    }
} catch {
    Err "Could not parse .clasp.json: $_"
}

# ── DEPENDENCIES ─────────────────────────────────────────────────────────────

if (-not (Test-Path "node_modules")) {
    Log "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Err "npm install failed. Try: npm install --registry https://registry.npmjs.org"
    }
}

# ── BUILD ────────────────────────────────────────────────────────────────────

$hasBuildScript = node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)" 2>$null
if ($LASTEXITCODE -eq 0) {
    Log "Building..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Err "Build failed. Check TypeScript errors above." }
} else {
    Err "No 'build' script in package.json. Add: `"build`": `"node esbuild.mjs`""
}

# ── BUNDLE SIZE CHECK ────────────────────────────────────────────────────────

if (Test-Path "dist/App.html") {
    $sizeBytes = (Get-Item "dist/App.html").Length
    $sizeKb = [math]::Floor($sizeBytes / 1024)
    $hardLimitKb = 1536
    $warnLimitKb = 1331

    if ($sizeBytes -gt ($hardLimitKb * 1024)) {
        Err "BUNDLE TOO LARGE: dist/App.html is ${sizeKb}KB (limit: ${hardLimitKb}KB / 1.5MB). Reduce dependencies."
    }
    if ($sizeBytes -gt ($warnLimitKb * 1024)) {
        Log "WARNING: dist/App.html is ${sizeKb}KB — approaching 1.5MB GAS limit."
    } else {
        Log "Bundle OK: dist/App.html is ${sizeKb}KB."
    }
}

# ── PUSH ─────────────────────────────────────────────────────────────────────

Log "Pushing to Google Apps Script..."
$pushOutput = Invoke-Clasp "push", "--force"
$pushStr = $pushOutput -join "`n"
if ($LASTEXITCODE -ne 0) { Err "clasp push failed: $pushStr" }
Log $pushStr

try {
    $scriptId = (Get-Content ".clasp.json" -Raw | ConvertFrom-Json).scriptId
} catch { $scriptId = "" }

Log "Push complete."

# ── VERSIONED DEPLOYMENT (optional) ──────────────────────────────────────────

if ($Deploy) {
    if ($DeployId) {
        Log "Updating deployment $DeployId..."
        $deployOutput = Invoke-Clasp "deploy", "--deploymentId", $DeployId, "--description", $DeployDesc
    } else {
        Log "Creating new deployment..."
        $deployOutput = Invoke-Clasp "deploy", "--description", $DeployDesc
    }
    if ($LASTEXITCODE -ne 0) { Err "clasp deploy failed: $($deployOutput -join ' ')" }
    Log ($deployOutput -join "`n")
}

Log "Done."
if ($scriptId) {
    Log "Edit: https://script.google.com/home/projects/$scriptId/edit"
}

exit 0
