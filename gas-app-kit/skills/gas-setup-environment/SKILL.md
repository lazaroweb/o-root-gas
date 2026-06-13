---
name: gas-setup-environment
description: Set up the environment for GAS App Kit projects. Ensure Node.js >= 22, install clasp CLI, authenticate with Google, enable Apps Script API. Use before first deploy or when hitting setup/auth errors.
---

# Setup Environment

Ensures the user's machine has everything needed before creating or deploying a project. Four prerequisites, checked in order. **Handle each one silently when possible; only involve the user when their action is required (e.g. browser login).**

## Tone guidance

**The user may not know what any of these tools are.** Follow these rules:

- **Never say** "install clasp" without context. Explain *why* first: "I need to install a small tool that lets me upload your app to Google."
- **Run commands yourself** whenever possible. Only ask the user to do something when it requires a browser (e.g. login).
- **If something fails, diagnose and fix it** before asking the user. Try fallbacks.
- **Encouraging language.** "Almost ready!" / "One more quick step." / "All set!"

## Detecting the operating system

Before running any commands, detect the OS:

```bash
# Mac/Linux
uname -s   # Darwin = Mac, Linux = Linux
```

```powershell
# Windows
$env:OS    # "Windows_NT" on Windows
# Or:
[System.Environment]::OSVersion.Platform   # "Win32NT"
```

Use the appropriate commands and paths for the detected OS throughout this skill.

## State tracking (internal — do not mention to user)

**Mac/Linux:**
```bash
mkdir -p ~/.gas-app-kit && touch ~/.gas-app-kit/setup-state
# Check: grep -q "STEP_KEY" ~/.gas-app-kit/setup-state && echo "done" || echo "pending"
# Mark done: echo "STEP_KEY" >> ~/.gas-app-kit/setup-state
```

**Windows:**
```powershell
$stateFile = "$env:USERPROFILE\.gas-app-kit\setup-state"
New-Item -ItemType Directory "$env:USERPROFILE\.gas-app-kit" -Force | Out-Null
New-Item -ItemType File $stateFile -Force | Out-Null
# Check: Select-String -Path $stateFile -Pattern "STEP_KEY" -Quiet
# Mark done: Add-Content $stateFile "STEP_KEY"
```

Skip any step already marked as done.

---

## Step 0 — Node.js version (silent)

Run `node --version` silently and parse the major version number.

- **>= 22:** Move on.
- **< 22 or not installed:** Tell the user:

  > "Your Node.js version needs to be updated — this project requires version 22 or newer. Please download and install it from [nodejs.org](https://nodejs.org) (choose the LTS version) and tell me when it's done."

  Do not proceed until Node.js >= 22 is confirmed. After confirmation, re-run `node --version`.

---

## Step 1 — clasp (Google Apps Script uploader)

**State key:** `clasp_installed`

Run `clasp --version` silently.

- **Pass:** Move on.
- **Fail:** Install it globally:

  **Mac/Linux:**
  ```bash
  npm install -g @google/clasp
  ```

  **Windows:**
  ```powershell
  npm install -g @google/clasp
  ```

  If npm fails with a registry error, try:
  ```bash
  npm install -g @google/clasp --registry https://registry.npmjs.org
  ```

  Tell the user only if all attempts fail: "I'm having trouble installing a tool. Could you open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac) and run: `npm install -g @google/clasp`?"

  **Note for Windows users:** After installing, if `clasp` is not found, npm's global bin folder may not be in the PATH. Fix:
  ```powershell
  # Find clasp location
  $claspPath = (npm root -g).Replace("\node_modules", "\clasp.cmd")
  # Test it
  & $claspPath --version
  ```
  Store the full path in `.gas-app/state.json` as `claspPath` if bare `clasp` is not available.

### clasp installed but not in PATH (any OS)

After installing, if `clasp --version` still fails:

**Mac/Linux:**
```bash
CLASP_PATH="$(npm root -g | sed 's|/lib/node_modules||')/bin/clasp"
"$CLASP_PATH" --version
```

**Windows:**
```powershell
$claspPath = (npm root -g).Replace("\node_modules", "") + "\clasp.cmd"
& $claspPath --version
```

If it works, store the full path in `.gas-app/state.json` → `claspPath`. **Use this full path in all subsequent clasp commands** in this skill, gas-init-project, gas-push, and gas-pull.

---

## Step 2 — Google login

**State key:** `clasp_logged_in`

**Mac/Linux:** Check `test -f ~/.clasprc.json`
**Windows:** Check `Test-Path "$env:USERPROFILE\.clasprc.json"`

- **File exists:** Move on.
- **File missing:** This step **requires the user's action**. Say:

  > "I need you to log in to Google so I can upload apps on your behalf. Please run this in your terminal:
  >
  > `clasp login`
  >
  > A browser window will open — sign in with your Google account and click Allow. Tell me when you see 'Logged in!' in the terminal."

  If clasp is not in the user's PATH, give them the full path (from `claspPath` in state).

  **Do not run `clasp login` yourself** — it is interactive. Wait for the user to confirm. Then verify with `clasp list 2>&1` (success if it returns without auth errors).

---

## Step 3 — Apps Script API

**State key:** `apps_script_api_enabled`

Try creating a temporary test project silently:

**Mac/Linux:**
```bash
ORIG_PWD=$(pwd)
TMPDIR=$(mktemp -d)
cd "$TMPDIR" && clasp create --type standalone --title "api-test" 2>&1
cd "$ORIG_PWD" && rm -rf "$TMPDIR"
```

**Windows:**
```powershell
$origPwd = Get-Location
$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory $tmpDir | Out-Null
Set-Location $tmpDir
clasp create --type standalone --title "api-test" 2>&1
Set-Location $origPwd
Remove-Item $tmpDir -Recurse -Force
```

- **Pass** (`.clasp.json` created): API is enabled. Clean up and move on.
- **Fail** (output mentions "Apps Script API"): Say:

  > "One more quick step: I need you to turn on a setting in Google.
  >
  > 1. Open this link: https://script.google.com/home/usersettings
  > 2. Find **Google Apps Script API** and switch it to **On**
  > 3. Tell me when done."

  Wait, re-check, clean up.

- **Fail** (other error): Try `--type webapp`. If both fail for non-API reasons, assume the API is enabled and continue.

---

## Troubleshooting (internal — do NOT show to user)

| Problem | Fix |
|---------|-----|
| `SyntaxError: Cannot use import statement outside a module` | Node.js < 22 — update to 22+ (Step 0) |
| `npm install` 401/403 | Use `--registry https://registry.npmjs.org` |
| `clasp: command not found` after install (Mac/Linux) | npm global bin not in PATH — find real path, store as `claspPath` (Step 1) |
| `clasp` not recognized (Windows) | Use `clasp.cmd` or full path to `clasp.cmd` in npm global bin |
| `clasp list` → "not logged in" | `clasp login` (Step 2, one-time) |
| `clasp create` → "Apps Script API" | Enable API at script.google.com/home/usersettings (Step 3) |

## After setup

Do not tell the user "proceed to gas-init-project." Transition naturally:

- "Everything is set up! Let me now get your project ready." → invoke **gas-init-project**
- If already initialized: "Your environment looks good and the project is ready. Want me to deploy it?" → invoke **gas-push**
