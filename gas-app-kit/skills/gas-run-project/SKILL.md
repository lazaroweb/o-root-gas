---
name: gas-run-project
description: Start the local development server for the GAS App Kit webapp. Use when the user asks to run, preview, start locally, or see the app in the browser.
---

# Run Project (Local Development)

Starts the local development preview so the user can see the app in the browser while building it.

## Tone guidance

- "Starting your local preview..." → progress
- "Your app is running! Open http://localhost:3000 in your browser." → success
- Remind the user that local data is fake — real data only appears after deploying to Google.

## Prerequisites

- Project initialized (npm install has run, `src/` exists)

## What "local" means in GAS context

Local development runs a static preview **without** a connection to Google Apps Script. This means:
- `google.script.run.*` calls **will not work** and return mock/empty data
- No access to Google Sheets, Drive, Gmail, etc.
- The UI looks exactly like the deployed version

The template includes a mock fallback in the components so the preview still shows something useful.

## Starting the dev server

Check `package.json` for the `dev` script:

**Mac/Linux:**
```bash
cd "<project-dir>" && npm run dev
```

**Windows:**
```powershell
Set-Location "<project-dir>"
npm run dev
```

The dev server runs esbuild in watch mode and serves `dist/App.html` at `http://localhost:3000`.

If the `dev` script is missing from `package.json`, fall back to:
```bash
# Mac/Linux
node esbuild.mjs --dev

# Windows
node esbuild.mjs --dev
```

Or serve with npx:
```bash
# Mac/Linux / Windows
npx serve dist -p 3000
```

## Tell the user

> "Your app is running locally! Open your browser and go to: http://localhost:3000
>
> Note: the data you see here is sample/placeholder data. Your real data from Google Sheets will only appear after you deploy the app."

## Stopping the server

When the user is done previewing: "Press Ctrl+C in the terminal to stop the server."
