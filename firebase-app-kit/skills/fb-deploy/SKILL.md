---
name: fb-deploy
description: Deploy to Firebase Hosting — build, deploy, verify the live version, rollback, and the auth-expiry routine. Use for every release.
---

# Deploy — build, publish, verify

## The release routine (every release, in order)

```bash
# 1. Bump version in package.json + add CHANGELOG entry
# 2. Build (version gets injected into the bundle)
npm run build
# 3. Publish
npx firebase deploy --only hosting
# 4. Git backup
git add -A && git commit -m "feat: … (vX.Y.Z)" && git push
```

Verification: open the app with a hard refresh (Cmd+Shift+R) and read the
version in the topbar. If it still shows the old version, the cache headers
are wrong — see fb-init-project (`index.html` must be `no-cache`).

## Where things live (mental model for GAS veterans)

| GAS concept | Firebase equivalent |
|---|---|
| script.google.com editor | Nothing — code lives ONLY in the repo/GitHub |
| Script Properties | No server: per-user settings live in Firestore; public config in `.env` |
| Executions/logs panel | Firebase Console → each product's tab |
| clasp push + deploy | `npm run build` + `firebase deploy --only hosting` |
| Deployment versions | Hosting → Release history (one-click rollback) |

## Auth expiry (recurring, plan for it)

`Authentication Error: Your credentials are no longer valid` → run
`npx firebase login --reauth` and **finish the browser flow** (terminal must
print `✔ Success!`). Accounts with Advanced Protection hit this roughly daily.

## Rollback

Console → Hosting → Release history → ⋮ on a previous release → **Rollback**.
Instant, no rebuild. Note it only reverts static files — Firestore rules and
data are separate (rules: `firebase deploy --only firestore:rules`).

## Deploy targets — common failure

`Error: Assertion failed: resolving hosting target` usually means the CLI is
not authenticated (fix auth first) or `.firebaserc` lost its project mapping:

```json
{ "projects": { "default": "my-project-id" } }
```
