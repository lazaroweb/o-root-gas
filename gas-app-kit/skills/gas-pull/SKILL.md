---
name: gas-pull
description: Download the latest version from Google Apps Script for inspection or disaster recovery. Use when the user wants to sync, recover code, compare local vs deployed, or suspects the deployed app differs from local files.
---

# Pull (Sync from Google)

Downloads the files currently on Google Apps Script into the local project.

**Important:** for React projects, the source of truth is `src/` — never edit
files in `dist/`. Pull updates `dist/` with whatever is on Google, which is
useful for **inspection and recovery**, not for day-to-day work.

## When pull is the right tool (and when it is not)

| Situation | Use pull? |
|---|---|
| "Is the deployed code the same as my local build?" | Yes — pull then diff `dist/` |
| Local project lost/corrupted, only the GAS project survives | Yes — pull recovers the bundled code (then reconstruct `src/` from it) |
| Someone edited code directly in the Apps Script editor | Yes — pull, then port the change into `src/` and redeploy properly |
| Normal development | **No** — edit `src/`, build, push |

## Danger: pull overwrites local `dist/`

Pull replaces local `dist/` content with the remote version. That is safe
(dist is generated), but if the user edited `dist/` by hand, warn first and
offer to copy their edits aside.

## Tone guidance

- "Syncing your project from Google..." → progress
- "Your project files are up to date." → success

## Prerequisites (check silently)

- clasp installed and logged in **with the account that owns the project**
  (a `The caller does not have permission` error means wrong account — see
  gas-setup-environment Step 2b)
- `.clasp.json` exists in the project directory

## Getting the clasp path

Check `.gas-app/state.json` → `claspPath`. If set, use that full path.

## Running the pull script

**Mac/Linux:**
```bash
bash "<plugin-dir>/scripts/pull.sh" --project-dir "<project-dir>"
```

**Windows (PowerShell):**
```powershell
& "<plugin-dir>/scripts/pull.ps1" -ProjectDir "<project-dir>"
```

## Script exit codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Report pulled files |
| 1 | Setup needed | Invoke **gas-setup-environment** |
| 2 | Pull error | Read error, diagnose (wrong account? wrong scriptId in `.clasp.json`?) |

## After pull

Tell the user:
> "Done! Your project is up to date."

Remind them that `src/` is where they should make edits. If they edited files
in `dist/` directly on Google Apps Script (not recommended), they'll need to
manually port those changes to `src/` — offer to do that port for them.
