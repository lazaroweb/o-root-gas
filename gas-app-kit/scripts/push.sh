#!/usr/bin/env bash
# Non-interactive push script for GAS App Kit.
# Build + push the React app to Google Apps Script.
# Exit codes: 0 = success, 1 = setup needed, 2 = build/push error.
#
# Options:
#   --project-dir <dir>   Run from this directory (default: cwd)
#   --deploy              Create or update a versioned deployment after push
#   --deploy-id <id>      Update an existing deployment in-place (same URL)
#   --deploy-desc <text>  Description (default: "GAS App deployment")
#   --clasp-path <path>   Full path to clasp binary (if not in PATH)
set -uo pipefail

PROJECT_DIR=""
DO_DEPLOY=""
DEPLOY_ID=""
DEPLOY_DESC="GAS App deployment"
CLASP_BIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
    --deploy)       DO_DEPLOY="1"; shift ;;
    --deploy-id)    DO_DEPLOY="1"; DEPLOY_ID="$2"; shift 2 ;;
    --deploy-desc)  DEPLOY_DESC="$2"; shift 2 ;;
    --clasp-path)   CLASP_BIN="$2"; shift 2 ;;
    *)              echo "[gas-push] Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$PROJECT_DIR" ]]; then
  [[ ! -d "$PROJECT_DIR" ]] && { echo "[gas-push] ERROR: Project dir not found: $PROJECT_DIR" >&2; exit 2; }
  cd "$PROJECT_DIR" || exit 2
fi

log() { echo "[gas-push] $1"; }
err() { echo "[gas-push] ERROR: $1" >&2; }

# ── Read claspPath from state if not passed ──────────────────────────────────
if [[ -z "$CLASP_BIN" ]] && [[ -f ".gas-app/state.json" ]]; then
  CLASP_BIN=$(node -e "try{const s=require('./.gas-app/state.json');process.stdout.write(s.claspPath||'')}catch{}" 2>/dev/null || true)
fi
CLASP="${CLASP_BIN:-clasp}"

# ── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  err "SETUP_NEEDED: node not installed. Download from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  err "SETUP_NEEDED: Node.js >= 22 required (found v${NODE_MAJOR}). Download from https://nodejs.org"
  exit 1
fi

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

if [[ ! -f "package.json" ]]; then
  err "No package.json found. Is this a GAS App Kit project?"
  exit 2
fi

ROOT_DIR=$(node -e "try{const c=require('./.clasp.json');process.stdout.write(c.rootDir||'')}catch{}" 2>/dev/null || true)
if [[ "$ROOT_DIR" != "./dist" && "$ROOT_DIR" != "dist" ]]; then
  err "DANGER: .clasp.json rootDir is '${ROOT_DIR:-<missing>}' — must be './dist'. Fix before pushing."
  exit 2
fi

# ── DEPENDENCIES ─────────────────────────────────────────────────────────────

if [[ ! -d "node_modules" ]]; then
  log "Installing dependencies..."
  if ! npm install; then
    err "npm install failed. Try: npm install --registry https://registry.npmjs.org"
    exit 2
  fi
fi

# ── BUILD ────────────────────────────────────────────────────────────────────

if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)" 2>/dev/null; then
  log "Building..."
  if ! npm run build; then
    err "Build failed. Check TypeScript errors above."
    exit 2
  fi
else
  err "No 'build' script in package.json. Add: \"build\": \"node esbuild.mjs\""
  exit 2
fi

# ── BUNDLE SIZE CHECK ────────────────────────────────────────────────────────

if [[ -f "dist/App.html" ]]; then
  SIZE_BYTES=$(wc -c < "dist/App.html" | tr -d ' ')
  SIZE_KB=$((SIZE_BYTES / 1024))
  HARD_LIMIT_KB=1536
  WARN_LIMIT_KB=1331
  if [[ "$SIZE_BYTES" -gt $((HARD_LIMIT_KB * 1024)) ]]; then
    err "BUNDLE TOO LARGE: dist/App.html is ${SIZE_KB}KB (limit: ${HARD_LIMIT_KB}KB / 1.5MB). Reduce dependencies."
    exit 2
  fi
  if [[ "$SIZE_BYTES" -gt $((WARN_LIMIT_KB * 1024)) ]]; then
    log "WARNING: dist/App.html is ${SIZE_KB}KB — approaching 1.5MB GAS limit."
  else
    log "Bundle OK: dist/App.html is ${SIZE_KB}KB."
  fi
fi

# ── PUSH ─────────────────────────────────────────────────────────────────────

log "Pushing to Google Apps Script..."
PUSH_OUTPUT=$("$CLASP" push --force 2>&1) || {
  err "clasp push failed: $PUSH_OUTPUT"
  exit 2
}
log "$PUSH_OUTPUT"

SCRIPT_ID=$(node -e "try{const c=require('./.clasp.json');process.stdout.write(c.scriptId||'')}catch{}" 2>/dev/null || true)
log "Push complete."

# ── VERSIONED DEPLOYMENT (optional) ──────────────────────────────────────────

if [[ -n "$DO_DEPLOY" ]]; then
  if [[ -n "$DEPLOY_ID" ]]; then
    log "Updating deployment ${DEPLOY_ID}..."
    DEPLOY_OUTPUT=$("$CLASP" deploy --deploymentId "$DEPLOY_ID" --description "$DEPLOY_DESC" 2>&1) || {
      err "clasp deploy (update) failed: $DEPLOY_OUTPUT"
      exit 2
    }
  else
    log "Creating new deployment..."
    DEPLOY_OUTPUT=$("$CLASP" deploy --description "$DEPLOY_DESC" 2>&1) || {
      err "clasp deploy (new) failed: $DEPLOY_OUTPUT"
      exit 2
    }
  fi
  log "$DEPLOY_OUTPUT"
fi

log "Done."
if [[ -n "$SCRIPT_ID" ]]; then
  log "Edit: https://script.google.com/home/projects/${SCRIPT_ID}/edit"
fi
