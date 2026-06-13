#!/usr/bin/env bash
# Non-interactive init script for GAS App Kit.
# Copies the template into the project directory and runs npm install.
# Exit codes: 0 = success, 1 = setup needed, 2 = error.
#
# Options:
#   --template-dir <dir>   Path to the plugin's template/ directory (required)
#   --project-dir <dir>    Destination directory (default: current directory)

set -uo pipefail

TEMPLATE_DIR=""
PROJECT_DIR="$(pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --template-dir) TEMPLATE_DIR="$2"; shift 2 ;;
    --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
    *)              echo "[gas-init] Unknown option: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[gas-init] $1"; }
err() { echo "[gas-init] ERROR: $1" >&2; }

if [[ -z "$TEMPLATE_DIR" ]]; then
  err "TEMPLATE_DIR is required. Pass --template-dir <path>"
  exit 2
fi

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  err "Template directory not found: $TEMPLATE_DIR"
  exit 2
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  err "SETUP_NEEDED: node not installed. Download from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  err "SETUP_NEEDED: Node.js >= 22 required (found v${NODE_MAJOR}). Download from https://nodejs.org"
  exit 1
fi

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR" || exit 2

log "Copying template files..."
cp -r "${TEMPLATE_DIR}/." .

# Remove any git history from the template
rm -rf .git 2>/dev/null || true

log "Installing dependencies..."
if ! npm install; then
  log "Standard install failed, trying public registry..."
  if ! npm install --registry https://registry.npmjs.org; then
    err "npm install failed. Please run manually: npm install"
    exit 2
  fi
fi

# Create state directory and file
mkdir -p .gas-app
if [[ ! -f ".gas-app/state.json" ]]; then
  cat > .gas-app/state.json << 'EOF'
{
  "initialized": false,
  "hasSpreadsheet": null,
  "spreadsheetId": null,
  "scriptId": null,
  "published": false,
  "projectDir": ".",
  "access": "MYSELF",
  "claspPath": null,
  "deploymentId": null,
  "spreadsheetSchema": null
}
EOF
fi

log "Project ready at: $PROJECT_DIR"
exit 0
