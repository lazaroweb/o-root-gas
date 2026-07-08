---
name: gas-app-kit
description: Main entry point for the GAS App Kit. Routes user requests to the appropriate skill.
---

# GAS App Kit

Routes the user's request to the right skill. Always invoke the relevant skill — never handle the request inline.

## Routing

| User intent | Skill to invoke |
|-------------|-----------------|
| "I want to create an app" / "help me build" / "start" / no subcommand | **gas-start** |
| "deploy" / "push" / "publish" / "ship" | **gas-push** |
| "preview" / "run" / "start local" / "localhost" | **gas-run-project** |
| "pull" / "sync" / "update from Google" | **gas-pull** |
| "setup" / "install tools" / "auth" / "login" | **gas-setup-environment** |
| Questions about UI / components / design | **gas-ant-design** |
| Questions about React / state / hooks | **gas-frontend-patterns** |
| Questions about TypeScript / types | **gas-typescript-pro** |
| Saving data / spreadsheet / database / records | **gas-sheet-db** |
| README / preparing the repo for git | **gas-readme-standard** |

## Rules

- Never answer without invoking a skill when one applies.
- Never mention skill names to the user — just do the work.
- If the user's intent is unclear, default to **gas-start**.
