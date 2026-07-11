---
name: fb-setup-environment
description: Prepare the machine and the Firebase console for a new project — Node, firebase-tools CLI, project creation, enabling Auth/Firestore/Hosting, and choosing the plan (Spark vs Blaze). Use once per machine/project, right after fb-start.
---

# Setup environment — machine + Firebase console

Two halves: the local CLI and the Firebase console. The user may be
non-technical — do the CLI part yourself and give **exact click-paths with
full URLs** for the console part (never placeholders).

## 1. Local machine

```bash
node -v   # need >= 18
npm i -g firebase-tools   # or use npx firebase-tools in every command
npx firebase login        # opens browser — user must finish the flow
```

**Login gotchas (learned in production):**

- The flow only worked when the terminal printed `✔ Success! Logged in as …`.
  If the browser tab was closed midway, the CLI keeps "Waiting for
  authentication..." forever — re-run the command.
- Accounts with **Google Advanced Protection** get their refresh tokens revoked
  roughly daily. Expect to re-run `npx firebase login --reauth` at the start of
  a work session. An expired token shows as `Authentication Error: Your
  credentials are no longer valid`.
- Multiple Google accounts in the browser cause the wrong-account trap: always
  confirm WHICH account was picked in the browser consent screen.

## 2. Firebase console (user clicks, you guide)

All at https://console.firebase.google.com — create project, then:

1. **Authentication** → Sign-in method → enable **Google**.
2. **Firestore Database** → Create database → **production mode** → pick the
   region closest to users (e.g. `southamerica-east1` for Brazil). The region
   is permanent.
3. **Project settings → General → Your apps** → add a **Web app** → copy the
   `firebaseConfig` block. These values are **public identifiers, not
   secrets** — they go in `.env` and may be committed as `.env.example`.

## 3. Plan: Spark (free) vs Blaze (pay-as-you-go)

- **Spark** is enough for a beta: 50k reads/20k writes per day, 1 GB storage,
  10 GB hosting transfer/month.
- **Blaze** unlocks over-free-tier billing but the free quota still applies
  first; a small multi-user app usually stays at R$ 0. Set a **budget alert**
  in Google Cloud Billing when upgrading.

## 4. Verify before moving on

```bash
npx firebase projects:list   # project appears
```

Then proceed to **fb-init-project**.
