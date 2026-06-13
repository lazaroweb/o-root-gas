# Non-interactive init script for GAS App Kit (Windows PowerShell).
# Copies the template into the project directory and runs npm install.
# Exit codes: 0 = success, 1 = setup needed, 2 = error.
#
# Parameters:
#   -TemplateDir <path>   Path to the plugin's template/ directory (required)
#   -ProjectDir <path>    Destination directory (default: current directory)

param(
    [string]$TemplateDir = "",
    [string]$ProjectDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Log($msg) { Write-Output "[gas-init] $msg" }
function Err($msg) { Write-Error "[gas-init] ERROR: $msg"; exit 2 }
function SetupNeeded($msg) { Write-Error "[gas-init] ERROR: $msg"; exit 1 }

if (-not $TemplateDir) {
    Err "TemplateDir is required. Pass -TemplateDir <path>"
}

if (-not (Test-Path $TemplateDir -PathType Container)) {
    Err "Template directory not found: $TemplateDir"
}

# Check Node.js
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    SetupNeeded "node not installed. Download from https://nodejs.org"
}

$nodeVersion = (node -e "process.stdout.write(process.versions.node.split('.')[0])").Trim()
if ([int]$nodeVersion -lt 22) {
    SetupNeeded "Node.js >= 22 required (found v$nodeVersion). Download from https://nodejs.org"
}

# Create and enter project directory
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
Set-Location $ProjectDir

Log "Copying template files..."

# Copy all template files including hidden files (like .gitignore)
Get-ChildItem -Path $TemplateDir -Force | ForEach-Object {
    $destPath = Join-Path $ProjectDir $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
    } else {
        Copy-Item -Path $_.FullName -Destination $destPath -Force
    }
}

# Remove any git history from the template
if (Test-Path ".git") {
    Remove-Item ".git" -Recurse -Force
}

Log "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Log "Standard install failed, trying public registry..."
    npm install --registry https://registry.npmjs.org
    if ($LASTEXITCODE -ne 0) {
        Err "npm install failed. Please run manually: npm install"
    }
}

# Create state directory and file
$stateDir = ".gas-app"
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$statePath = Join-Path $stateDir "state.json"
if (-not (Test-Path $statePath)) {
    $state = [ordered]@{
        initialized     = $false
        hasSpreadsheet  = $null
        spreadsheetId   = $null
        scriptId        = $null
        published       = $false
        projectDir      = "."
        access          = "MYSELF"
        claspPath       = $null
        deploymentId    = $null
        spreadsheetSchema = $null
    }
    $state | ConvertTo-Json | Set-Content $statePath -Encoding UTF8
}

Log "Project ready at: $ProjectDir"
exit 0
