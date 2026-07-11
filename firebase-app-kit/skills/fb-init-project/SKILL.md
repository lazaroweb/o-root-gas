---
name: fb-init-project
description: Scaffold the Firebase web app — Vite + React + TypeScript, Firebase SDK initialization, .env config, firebase.json with correct cache headers, and the standard folder layout. Use after fb-setup-environment.
---

# Initialize project — scaffold that matches the production layout

## 1. Scaffold

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm i firebase antd lucide-react dayjs
npx firebase init hosting firestore   # pick the existing project
```

`firebase init` generates `firebase.json`, `.firebaserc`, `firestore.rules`
and `firestore.indexes.json`.

## 2. Standard folder layout (mirrors the Lastro production app)

```
src/
├── lib/firebase.ts      # initializeApp + getAuth + getFirestore (+ App Check)
├── server/
│   ├── store.ts         # in-memory store, write-through to Firestore
│   ├── logic.ts         # ALL business logic + RPCS registry
│   └── acesso.ts        # ownership claim + invite management
├── gas-client.ts        # callServer shim (RPC into logic.ts)
├── views/               # screens
├── components/          # reusable UI
├── types.ts             # shared contracts
└── version.ts           # __APP_VERSION__ injected at build time
```

## 3. Firebase initialization (`src/lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // CRITICAL: use the .web.app domain, NOT <project>.firebaseapp.com —
  // cross-origin auth breaks in Chrome (third-party cookie blocking).
  // See fb-auth-google for the full explanation.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
```

Put the values in `.env` (gitignored) and commit an `.env.example` with the
keys empty. These are public identifiers — the real security lives in
Firestore rules — but keeping them out of git avoids DLP false positives.

## 4. `firebase.json` — cache headers that prevent "stale app" bugs

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }] },
      { "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
    ]
  }
}
```

**Why (real production incident):** the default `max-age=3600` on `index.html`
made browsers keep serving an old build for up to an hour after a critical
hotfix deploy. `index.html` must never be cached; hashed assets can be cached
forever.

## 5. Version indicator

Inject `package.json` version at build time (Vite `define`) and render
`v{APP_VERSION}` in the topbar and login screen. This ends every "is the new
version live?" support conversation — the user just reads the topbar.
