---
name: gas-push
description: Build and deploy the app to Google Apps Script with ONE command and a URL that never changes. Use when the user asks to deploy, push, publish, ship, or update the live app. Chains to gas-init-project if not initialized.
---

# Push (Build + Deploy)

Builds the React app and publishes it to Google Apps Script. The user runs
**nothing manually**: you run the script, the app updates, **the URL never
changes**. This flow is battle-tested — the same pattern shipped 500+ versions
of a production app.

## Tone guidance

- "Deploying your app..." → progress update
- "Your app is live! Here's the link: ..." → success
- "Something went wrong — let me fix that." → on error, diagnose and fix before asking user

## Prerequisites (check silently)

- Project initialized (`.gas-app/state.json` with `initialized: true` and `.clasp.json` present)
- gas-setup-environment completed (clasp installed, logged in)

If not initialized, invoke **gas-init-project** first.

## The stable-URL rule (non-negotiable)

**Create ONE deployment the first time, save its `deploymentId` in
`.gas-app/state.json`, and ALWAYS redeploy with `--deploy-id` after that.**

- First push ever: `--deploy` (creates the deployment) → extract the
  deployment ID (`AKfycb...`) from the output and save it to state.
- Every push after: `--deploy-id <saved-id>` → same URL, new content.

If you skip `--deploy-id`, every push creates a NEW deployment with a NEW URL
and the user's bookmarks/shared links silently break. Never do that.

## Getting the clasp path

Check `.gas-app/state.json` → `claspPath`. If set, use that full path for all clasp commands.

## Running the push script

Detect OS, then run the appropriate script:

**Mac/Linux:**
```bash
bash "<plugin-dir>/scripts/push.sh" \
  --project-dir "<project-dir>" \
  --deploy-id "<deploymentId-from-state>" \
  --deploy-desc "<short description of what changed>"
```

**Windows (PowerShell):**
```powershell
& "<plugin-dir>/scripts/push.ps1" `
  -ProjectDir "<project-dir>" `
  -DeployId "<deploymentId-from-state>" `
  -DeployDesc "<short description of what changed>"
```

First deploy ever (no saved id yet): use `--deploy` / `-Deploy` instead of the
id, then parse the new deployment ID from the output and store it in state.

## Script exit codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Report success with links |
| 1 | Setup needed | Invoke **gas-setup-environment** |
| 2 | Build/push error | Read error output, diagnose, fix |

## Common errors and fixes (real production cases)

| Error | Fix |
|-------|-----|
| `SETUP_NEEDED: node/clasp not installed` | Invoke gas-setup-environment |
| `SETUP_NEEDED: clasp not logged in` | Invoke gas-setup-environment Step 2 |
| `The caller does not have permission` | clasp is logged into the WRONG Google account (common with work + personal accounts on one machine). Ask which account owns the project, then have the user run `clasp login` with that account. See gas-setup-environment Step 2b. |
| `Project has reached the maximum number of saved versions` | Apps Script hard-caps projects at **200 versions** and there is NO API to delete them. The user must open the project in the Apps Script editor → clock icon (Project History) → delete old versions manually. Warn proactively when deploys get frequent. |
| `No .clasp.json` | Invoke gas-init-project |
| `rootDir` is not `./dist` | Fix `.clasp.json` → `"rootDir": "./dist"` — pushing from the root uploads `node_modules` and freezes the editor |
| `npm install failed` | Try `npm install --registry https://registry.npmjs.org` |
| `Build failed` | Check TypeScript errors; invoke gas-typescript-pro |
| `BUNDLE TOO LARGE` | Reduce imports; see gas-guardrails. Above ~1.3MB, split the JS into multiple `<script>` chunks of ≤190KB each inside App.html (esbuild post-step) — single giant inline scripts fail to load |
| Deploy succeeds but app shows OLD version | The push updated the code but redeployed a different deployment. Confirm `--deploy-id` matches the one in state (`clasp deployments` lists them all) |

## Rollback (deploys are versioned — use it)

Every deploy creates a numbered version. To roll back WITHOUT changing the URL:

```bash
clasp deploy -i "<deploymentId>" -V <older-version-number>
```

Offer this whenever a deploy breaks something: "I can put the previous version
back online in a few seconds while we fix this."

## After a successful push

The script outputs the editor link and (if deployed) the live URL.

Tell the user in plain language:
> "Your app is updated and live — same link as always: [web app URL]"

If this was the FIRST deploy, also explain once:
> "This link is permanent. Every time I deploy, the content updates but the
> link stays the same — share it freely."

## Update state after push

Update `.gas-app/state.json`:
- `published: true`
- `deploymentId`: if a deployment was created (extract from clasp output)
- `lastDeployAt`: ISO timestamp (helps diagnose "which version is live?")
