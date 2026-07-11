---
name: fb-app-check
description: Firebase App Check with reCAPTCHA v3 — verify requests come from the real app, protect against quota abuse and cost surprises. Use after the app is stable in production.
---

# App Check — the anti-abuse layer

Firestore rules decide **who** can touch data. App Check verifies the request
comes from **your app** (not a script hammering your public Firebase config).
On a pay-as-you-go plan this is cost protection: without it, anyone with your
public config can burn your read quota.

## Setup (15 minutes)

1. Console → **App Check** → register the web app with **reCAPTCHA v3** —
   copy the site key (public).
2. Client init — must run **before** any Firestore call:

```typescript
// src/lib/firebase.ts — right after initializeApp
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

if (import.meta.env.VITE_APPCHECK_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
```

Making it conditional on the env var keeps local dev friction-free.

3. Console → App Check → Firestore → **Monitor first, enforce later**: run in
   monitoring mode for a few days, confirm ~100% verified requests, then click
   **Enforce**.

## Rules of thumb

- **Never enforce on day one.** A misconfigured key with enforcement on =
  every real user locked out.
- For local dev against enforced App Check, use a **debug token**
  (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in dev only, register the token
  in the console).
- App Check complements — never replaces — security rules. Rules are still
  the actual authorization layer.
