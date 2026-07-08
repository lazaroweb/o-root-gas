---
name: gas-init-project
description: Initialize a GAS App Kit project. Copy the template, run npm install, create a GAS project with clasp, and configure .clasp.json. Use after gas-start and gas-setup-environment.
---

# Initialize Project

Gets the project files onto the user's machine and connects them to Google Apps Script.
Run **after** **gas-start** and **gas-setup-environment**.

## Tone guidance

**The user may be non-technical.** Follow these rules:

- **Do as much as possible without asking.** Only ask when you genuinely need input.
- **Never mention** `.clasp.json`, `scriptId`, `rootDir`, `state.json`, or any internal file.
- **Use plain language.** "I'll set up your project" not "I'll copy the template and run npm install."
- **Give progress updates.** "Setting up your project... almost there!"

## Prerequisites (check silently)

- gas-start has run (constitution and `.gas-app/state.json` exist). If not, create minimal state now.
- gas-setup-environment completed (clasp installed, logged in, API enabled). If not, run it first.

## Getting the clasp path

Before running any clasp command, check `.gas-app/state.json` → `claspPath`. If set, use that full path instead of bare `clasp` for all clasp invocations.

```bash
# Mac/Linux: read from state
CLASP=$(node -e "try{const s=require('./.gas-app/state.json');console.log(s.claspPath||'clasp')}catch{console.log('clasp')}")
```

```powershell
# Windows
$state = Get-Content ".gas-app/state.json" | ConvertFrom-Json
$claspCmd = if ($state.claspPath) { $state.claspPath } else { "clasp" }
```

---

## 1. Copy template into project directory

The plugin includes a ready-to-use template at `<plugin-dir>/template/`. Copy it into the project directory.

Tell the user: "Setting up your project — this takes a minute..."

**Option A — Use the script (recommended):**

Detect OS, then run the appropriate script:

**Mac/Linux:**
```bash
bash "<plugin-dir>/scripts/init-from-template.sh" \
  --template-dir "<plugin-dir>/template" \
  --project-dir "<project-dir>"
```

**Windows (PowerShell):**
```powershell
& "<plugin-dir>/scripts/init-from-template.ps1" `
  -TemplateDir "<plugin-dir>/template" `
  -ProjectDir "<project-dir>"
```

Exit code 0 = success, 1 = setup needed, 2 = error.

**Option B — Manual (if script fails):**

```bash
# Mac/Linux
cp -r "<plugin-dir>/template/." "<project-dir>/"
cd "<project-dir>"
npm install
```

```powershell
# Windows
Copy-Item -Path "<plugin-dir>/template/*" -Destination "<project-dir>" -Recurse -Force
Set-Location "<project-dir>"
npm install
```

### If `npm install` fails

Tell the user: "I'm having trouble downloading some packages. Could you run this in your terminal: `npm install --registry https://registry.npmjs.org` — then tell me when it's done."

---

## 2. Create or link the Google Apps Script project

From inside the project directory.

**New project (default):**
```bash
clasp create --type webapp --title "<project-name>"
```

If `--type webapp` fails, try `--type standalone`. If it fails with "Apps Script API", go back to **gas-setup-environment** Step 3.

Tell the user: "Project created on Google!"

**After `clasp create`: ALWAYS verify `.clasp.json` has `"rootDir": "./dist"`.**

`clasp create` may drop the `rootDir` field. If it's missing or wrong, add it back:
```json
{
  "scriptId": "<the-script-id>",
  "rootDir": "./dist"
}
```

**This is non-negotiable.** Without `rootDir: "./dist"`, clasp push uploads `node_modules/src/` and freezes Google Apps Script completely.

**Existing project:**

If the user provides a link like `https://script.google.com/home/projects/<SCRIPT_ID>/edit`, extract the Script ID and update `.clasp.json`:
```json
{
  "scriptId": "<extracted-script-id>",
  "rootDir": "./dist"
}
```
Tell the user: "Connected to your existing project!"

---

## 3. Configure `appsscript.json`

Update `appsscript.json` in the project root with the access level from state:

```json
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "access": "<access-from-state>",
    "executeAs": "USER_ACCESSING"
  }
}
```

Access levels:
| User said | `access` value |
|-----------|----------------|
| "just me" | `"MYSELF"` |
| "my team" / "my company" (Google Workspace) | `"DOMAIN"` |
| "anyone with a link" (Google account required) | `"ANYONE"` |
| "anyone, no login needed" | `"ANYONE_ANONYMOUS"` |

`executeAs` must always be `"USER_ACCESSING"`.

**Add OAuth scopes** based on data usage:

| Data usage | Scope |
|---|---|
| App saves no data | `https://www.googleapis.com/auth/script.container.ui` |
| App saves data (auto-created spreadsheet via **gas-sheet-db** — the default) | `https://www.googleapis.com/auth/spreadsheets` |
| User's existing spreadsheet by ID (`openById`) | `https://www.googleapis.com/auth/spreadsheets` |
| Container-bound (attached to spreadsheet) | `https://www.googleapis.com/auth/spreadsheets.currentonly` |

---

## 4. Update state (silently)

Update `.gas-app/state.json`:
- `initialized: true`
- `projectDir`: absolute path to the project directory
- `scriptId`: from `.clasp.json`
- `hasSpreadsheet`, `spreadsheetId`: as determined in gas-start
- `access`: the chosen access level

---

## After init

**Transition naturally:**

- "Your project is ready! Want to see it in the browser? I can start a local preview." → invoke **gas-run-project**
- "Everything is set up. Want to start building your app?" → start coding with **gas-frontend-patterns** / **gas-ant-design**
- "Ready to publish? I can deploy it right now." → invoke **gas-push**
