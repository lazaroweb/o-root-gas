---
name: gas-start
description: Advisor at the start of the GAS App Kit flow. Understand the user's project needs, create a constitution (technical guidelines), initialize project state, and transition to setup and init. Use when the user wants to create an app or start a project.
---

# GAS App Kit — Advisor

First skill in the flow. Use when the user wants to create or start anything.

**Style: have a conversation — ask one simple question at a time, do the technical work silently.**

## Tone guidance

**The user may have zero technical background.** Follow these rules:

- **Plain language only.** Never say "Script ID", "container-bound", "rootDir", "clasp". Explain things in everyday terms.
- **One question at a time.** Never dump a list. Have a natural conversation.
- **Offer defaults.** "I'll create a new Google project for you — is that OK?" not "existing or new?"
- **Do the technical work silently.** The user does not need to know about constitution files, state.json, or .clasp.json. Just do it.
- **Encouraging language.** "Let's get started!" / "Almost ready!" / "One more quick step."

## What to do

### 1. Understand the project (conversational)

Ask one question at a time:

1. **What is the app for?**
   > "Tell me what you want to build. A dashboard? A form? A tool that reads from a spreadsheet? Just describe it in your own words — no technical details needed."

2. **Spreadsheet?**
   > "Does your app need to read or write data from a Google Sheets spreadsheet? If yes, do you already have one, or should we create a new one? (If you're not sure, we can skip this and add it later.)"

   If the user provides a spreadsheet link or ID:
   - Extract the spreadsheet ID from the URL
   - Try to inspect it using available MCP tools (`google-workspace`: `sheets_getMetadata` + `sheets_getRange`)
   - Record sheet names and column headers in `.gas-app/state.json` under `spreadsheetSchema`
   - If MCP is unavailable: "Can you tell me the names of the columns in your spreadsheet so I can set up the code to match?"

3. **Who will use it?**
   > "Who will use this app? Just you? Your whole team? Or should anyone with the link be able to open it?"

   Map the answer to the `access` field:
   - "just me" → `"MYSELF"`
   - "my team" / "my company" → `"DOMAIN"` (only works with Google Workspace)
   - "anyone with a link" / "everyone" → `"ANYONE"`
   - "no login required" → `"ANYONE_ANONYMOUS"`

4. **Existing project?** (only if the user suggests they have one)
   > "Do you already have a Google Apps Script project you want to use? If not, I'll create one for you."

### 2. Create constitution (silently)

After understanding the project, create `constitution.md` in the project directory using `references/constitution-template.md` as the base. Fill in:

- Project name and one-line description
- Stack: React 18 + TypeScript + Ant Design + esbuild + Google Apps Script
- Guidelines: TypeScript strict mode (no `any`), bundle < 1.3MB, no routing, no localStorage, no client-side fetch
- Spreadsheet usage (if applicable)
- Who can access (access level)

**Do not tell the user.** If they ask, say: "I'm writing down the technical guidelines so I remember how to build this correctly."

### 3. Initialize state (silently)

Create `.gas-app/state.json` in the project directory:

```json
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
```

Fill in what you know from the conversation.

Also create the global setup state directory:

**Mac/Linux:**
```bash
mkdir -p ~/.gas-app-kit && touch ~/.gas-app-kit/setup-state
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\.gas-app-kit" -Force | Out-Null
New-Item -ItemType File -Path "$env:USERPROFILE\.gas-app-kit\setup-state" -Force | Out-Null
```

### 4. Record decisions (silently)

Update state with answers:
- `hasSpreadsheet`, `spreadsheetId` (if provided)
- `access` (from step 1.3)

## After the advisor

**Transition naturally.** Do not say skill names. Examples:

- "Great, I have a clear picture. Let me now set up the tools you need and get the project ready." → invoke **gas-setup-environment** then **gas-init-project**
- If already initialized: "Your project is already set up. Want me to start building, or deploy what you have?"
- "Want to see it in the browser while we build? I can start a local preview." → invoke **gas-run-project**
