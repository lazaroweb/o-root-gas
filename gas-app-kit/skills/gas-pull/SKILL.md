---
name: gas-pull
description: Download the latest version from Google Apps Script for maintenance. Use when the user wants to sync, update local files from GAS, or do maintenance.
---

# Pull (Sync from Google)

Downloads the latest files from Google Apps Script to the local project.

**Important:** For React projects, the source of truth is `src/` — never edit files in `dist/`. Pull updates `dist/` with whatever is on Google, which can be useful for inspection but should not be edited directly.

## Tone guidance

- "Syncing your project from Google..." → progress
- "Your project files are up to date." → success

## Prerequisites (check silently)

- clasp installed and logged in
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
| 2 | Pull error | Read error, diagnose |

## After pull

Tell the user:
> "Done! Your project is up to date."

Remind them that `src/` is where they should make edits. If they edited files in `dist/` directly on Google Apps Script (not recommended), they'll need to manually port those changes to `src/`.
