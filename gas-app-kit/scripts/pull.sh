#!/usr/bin/env bash
# Non-interactive pull script for GAS App Kit.
# Downloads the latest files from Google Apps Script.
# Exit codes: 0 = success, 1 = setup needed, 2 = error.

set -uo pipefail

PROJECT_DIR=""
CLASP_BIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --clasp-path)  CLASP_BIN="$2"; shift 2 ;;
    *)             echo "[gas-pull] Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$PROJECT_DIR" ]]; then
  [[ ! -d "$PROJECT_DIR" ]] && { echo "[gas-pull] ERROR: Project dir not found: $PROJECT_DIR" >&2; exit 2; }
  cd "$PROJECT_DIR" || exit 2
fi

log() { echo "[gas-pull] $1"; }
err() { echo "[gas-pull] ERROR: $1" >&2; }

# Read claspPath from state if not passed
if [[ -z "$CLASP_BIN" ]] && [[ -f ".gas-app/state.json" ]]; then
  CLASP_BIN=$(node -e "try{const s=require('./.gas-app/state.json');process.stdout.write(s.claspPath||'')}catch{}" 2>/dev/null || true)
fi
CLASP="${CLASP_BIN:-clasp}"

# Pre-flight
if ! command -v "$CLASP" &>/dev/null 2>&1; then
  err "SETUP_NEEDED: clasp not found. Run: npm install -g @google/clasp"
  exit 1
fi

AUTH_TEST=$("$CLASP" list 2>&1) || true
if echo "$AUTH_TEST" | grep -qiE "not logged in|login required|ENOTLOGGEDIN|no credentials|authorize"; then
  err "SETUP_NEEDED: clasp not logged in. Run: clasp login"
  exit 1
fi

if [[ ! -f ".clasp.json" ]]; then
  err "No .clasp.json in $(pwd). Run gas-init-project first."
  exit 2
fi

log "Pulling from Google Apps Script..."
PULL_OUTPUT=$("$CLASP" pull 2>&1) || {
  err "clasp pull failed: $PULL_OUTPUT"
  exit 2
}
log "$PULL_OUTPUT"
log "Done."
