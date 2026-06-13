---
name: gas-push
description: Build and deploy the app to Google Apps Script. Use when the user asks to deploy, push, publish, or ship. Chains to gas-init-project if not initialized.
---

# Push (Build + Deploy)

Builds the React app and pushes it to Google Apps Script.

## Tone guidance

- "Deploying your app..." → progress update
- "Your app is live! Here's the link: ..." → success
- "Something went wrong — let me fix that." → on error, diagnose and fix before asking user

## Prerequisites (check silently)

- Project initialized (`.gas-app/state.json` with `initialized: true` and `.clasp.json` present)
- gas-setup-environment completed (clasp installed, logged in)

If not initialized, invoke **gas-init-project** first.

## Getting the clasp path

Check `.gas-app/state.json` → `claspPath`. If set, use that full path for all clasp commands.

## Running the push script

Detect OS, then run the appropriate script:

**Mac/Linux:**
```bash
bash "<plugin-dir>/scripts/push.sh" \
  --project-dir "<project-dir>" \
  [--deploy] \
  [--deploy-id <id>] \
  [--deploy-desc "<description>"]
```

**Windows (PowerShell):**
```powershell
& "<plugin-dir>/scripts/push.ps1" `
  -ProjectDir "<project-dir>" `
  [-Deploy] `
  [-DeployId "<id>"] `
  [-DeployDesc "<description>"]
```

## Script exit codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Report success with links |
| 1 | Setup needed | Invoke **gas-setup-environment** |
| 2 | Build/push error | Read error output, diagnose, fix |

## Common errors and fixes

| Error | Fix |
|-------|-----|
| `SETUP_NEEDED: node not installed` | Invoke gas-setup-environment |
| `SETUP_NEEDED: clasp not installed` | Invoke gas-setup-environment |
| `SETUP_NEEDED: clasp not logged in` | Invoke gas-setup-environment Step 2 |
| `No .clasp.json` | Invoke gas-init-project |
| `rootDir` is not `./dist` | Fix `.clasp.json` → `"rootDir": "./dist"` |
| `npm install failed` | Try `npm install --registry https://registry.npmjs.org` |
| `Build failed` | Check TypeScript errors; invoke gas-typescript-pro |
| `BUNDLE TOO LARGE` | Reduce imports; see gas-guardrails |
| `clasp push failed` | Check auth; run `clasp login` again |

## After a successful push

The script outputs:
- `Edit: https://script.google.com/home/projects/<scriptId>/edit`
- (if `--deploy` used) Deployment URL

Tell the user:
> "Your app is deployed! Open it in the Apps Script editor here: [link]"

If a deployment was created:
> "Your app is live at: [deployment-url]"

To create a shareable web app URL, the user must:
1. Open the Apps Script editor
2. Click **Deploy** → **Manage deployments** → use the **Web app** URL

**Explain this in plain language** — never say "versioned deployment". Say: "To get a shareable link, open the editor link above, click 'Deploy' at the top, and copy the web app URL."

## Update state after push

Update `.gas-app/state.json`:
- `published: true`
- `deploymentId`: if a deployment was created (extract from clasp output)
