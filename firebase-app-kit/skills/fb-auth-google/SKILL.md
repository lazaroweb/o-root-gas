---
name: fb-auth-google
description: Google sign-in with Firebase Auth that avoids the "unverified app" warning, the login loop with multiple Google accounts, and redirect_uri_mismatch. Use when implementing or debugging authentication.
---

# Google login — without the scary parts

## Why Firebase Auth kills the "unverified app" warning

A GAS web app asks for OAuth scopes (Sheets, Drive…) — Google shows the
full-page **"This app isn't verified"** warning to every guest until you pass
verification. Firebase Auth with Google sign-in requests only **basic profile**
(name, e-mail, photo): no sensitive scopes, no warning, no verification
process. This alone justified migrating a production app.

## Implementation

```typescript
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';

// Login button
const entrar = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    // ALWAYS surface the error — a silent catch here cost hours of debugging
    // a "login loop" that was actually auth/unauthorized-domain.
    message.error(e instanceof Error ? e.message : 'Erro no login');
  }
};

// Session listener — the single source of truth for "who is logged in"
onAuthStateChanged(auth, (user) => setUser(user));
```

## The 3 production traps (all hit in real life)

### 1. authDomain must be the SAME origin the app is served from

If the app lives at `https://myapp.web.app` but `authDomain` is
`myapp.firebaseapp.com`, the popup completes on a *different origin* and
Chrome's third-party-cookie blocking silently drops the session → infinite
login loop with **no error**. Fix: set
`VITE_FIREBASE_AUTH_DOMAIN=myapp.web.app`.

### 2. redirect_uri_mismatch after changing authDomain

The auto-created OAuth client in Google Cloud only knows the original domain.
Go to https://console.cloud.google.com/apis/credentials → "Web client (auto
created by Google Service)" and add:

- Authorized JavaScript origins: `https://myapp.web.app`
- Authorized redirect URIs: `https://myapp.web.app/__/auth/handler`

### 3. Multiple logged-in Google accounts

Corporate + personal accounts in the same Chrome profile: consent completes on
one account, the app reloads with the other. Diagnose by asking which account
shows in the consent screen. Workarounds: incognito window with only the
target account, or complete the flow carefully picking the right account.

## Login screen UX

Show the app name, one Google button, and the app **version** (`v1.2.3`).
While auth state is resolving show a splash, not the login button — a flash
of "Sign in" for already-logged users feels broken.
