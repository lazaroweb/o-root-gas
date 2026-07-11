---
name: fb-start
description: Start a new Firebase web app project (React + Vite + Firebase Auth/Firestore/Hosting, business logic in the browser). Establishes the project constitution, the stack decision, and when to choose Firebase over Google Apps Script. Use at the very beginning of any new Firebase project.
---

# Firebase App Kit — Start here

This kit builds **serverless web apps on Firebase** with the stack that was
battle-tested in production by the Lastro app (personal finance, migrated from
Google Apps Script):

- **React 18 + TypeScript + Vite** — frontend build
- **Firebase Auth** — Google login (no "unverified app" warning)
- **Cloud Firestore** — database with per-user isolation via security rules
- **Firebase Hosting** — deploy of the static build
- **Business logic runs in the browser** — no Cloud Functions, no server

## When to choose this stack (vs Google Apps Script)

| Need | Choose |
|---|---|
| Personal tool, data already in Sheets, 1 user | GAS (simpler, zero infra) |
| Multi-user app, invite/beta gate, real auth | **Firebase** |
| No "unverified app" OAuth warning for guests | **Firebase** (basic-profile auth only) |
| Sub-second loads, no 6-min execution limit | **Firebase** |
| Publishing to Play Store later (PWA/TWA) | **Firebase** |
| Needs server-side secrets or scheduled jobs | Neither fits perfectly — consider Cloud Functions add-on |

## The architecture in one paragraph

The app is a static React bundle served by Hosting. On login, Firebase Auth
identifies the user; the app loads that user's Firestore documents into an
**in-memory store** (synchronous reads, write-through persistence). All business
logic lives in `src/server/logic.ts` and runs **in the browser**, exposed through
a local RPC registry — the UI calls `callServer('fnName', args)` exactly like a
GAS app would call `google.script.run`, which makes porting GAS apps almost
mechanical. Security is enforced by **Firestore rules** (not by UI code).

## Project constitution (create this first)

Create `docs/` with the standard set: `ARCHITECTURE.md`, `SECURITY.md`,
`DEPLOY.md`, `ROADMAP.md`, plus `CHANGELOG.md` and `AGENTS.md` at the root.
Every release bumps `package.json` version and adds a CHANGELOG entry — the
version is injected into the UI (topbar) at build time so users can confirm
which version they're running.

## Order of operations for a new project

1. **fb-setup-environment** — Node, firebase-tools CLI, Firebase project in the console
2. **fb-init-project** — scaffold Vite + React + Firebase SDK + firebase.json
3. **fb-auth-google** — login without scary warnings
4. **fb-firestore-rules** — per-user isolation + invite gate BEFORE writing data
5. **fb-firestore-db** — the in-memory store pattern
6. **fb-client-logic** — business logic + RPC registry
7. **fb-deploy** — first deploy, cache headers, version indicator
8. **fb-app-check** (optional but recommended) — abuse protection
