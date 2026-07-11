---
name: fb-pwa-android
description: Take the Firebase web app to installable PWA and then to the Play Store via TWA (Trusted Web Activity). Use when the app is stable and the user wants mobile presence.
---

# PWA → Play Store — the mobile path without rewriting

A Firebase-hosted React app is already 90% of the way to mobile. The route:
**PWA first** (installable, offline shell), **TWA after** (Play Store listing
wrapping the PWA). No React Native, no second codebase.

## Phase 1 — PWA

1. `manifest.webmanifest`: name, short_name, `display: "standalone"`,
   theme/background colors, icons 192 + 512 px (+ `maskable`).
2. Service worker — keep it conservative: precache the app shell, **never
   cache `index.html` aggressively** (same stale-version trap as Hosting cache
   headers). `vite-plugin-pwa` with `registerType: 'autoUpdate'` is enough.
3. Test: Chrome → DevTools → Lighthouse → PWA audit passes; "Install app"
   appears on Android Chrome.

Firebase Hosting already provides the PWA prerequisites: HTTPS and proper
headers.

## Phase 2 — TWA (Play Store)

1. `npx @bubblewrap/cli init --manifest https://myapp.web.app/manifest.webmanifest`
   — generates the Android project (needs JDK + Android SDK; bubblewrap
   installs them).
2. **Digital Asset Links**: publish `/.well-known/assetlinks.json` on Hosting
   with the app's signing-key fingerprint — this is what removes the browser
   bar. Bubblewrap prints the exact JSON.
3. `npx @bubblewrap/cli build` → `.aab` → upload in Play Console (one-time
   US$ 25 developer account).
4. Play requirements: privacy policy URL (serve `docs/PRIVACIDADE.md` as a
   page), data-safety form (declare Firestore-held data), content rating.

## Gotchas

- TWA shows the **live site** — store releases don't gate web deploys. Ship
  web fixes instantly; the store binary only changes when the wrapper itself
  changes.
- Auth popups inside TWA: `signInWithPopup` may be blocked in some Android
  WebView contexts — have `signInWithRedirect` as fallback.
- Keep the version indicator visible in-app; "which version do you see?" works
  the same on Android.
