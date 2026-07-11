---
name: fb-firestore-rules
description: Firestore security rules for multi-user apps — per-user data isolation, ownership claim without hardcoded e-mails, and an invite-based closed beta gate enforced server-side. Use BEFORE storing any real data.
---

# Firestore rules — security is here, not in the UI

Rules are the **only** real security layer: the client bundle and the Firebase
config are public, so anyone can craft requests. UI checks are UX, not
security. Write rules assuming a hostile client.

## The production-tested rule set (per-user isolation + invite gate)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function logado() { return request.auth != null; }

    // Owner = whoever claimed config/dono first. UID comparison — NEVER
    // hardcode e-mails in rules (it leaks PII into the repo and trips
    // corporate DLP hooks; learned the hard way).
    function ehDono() {
      return logado()
        && get(/databases/$(database)/documents/config/dono).data.uid == request.auth.uid;
    }

    // Access = owner OR invited e-mail (doc keyed by e-mail in `convites`).
    function temConvite() {
      return ehDono()
        || exists(/databases/$(database)/documents/convites/$(request.auth.token.email));
    }

    // Each user only touches their own subtree — and only with an invite.
    match /usuarios/{uid}/{documento=**} {
      allow read, write: if logado() && request.auth.uid == uid && temConvite();
    }

    // Ownership claim: first-writer-wins, then immutable.
    match /config/dono {
      allow read: if logado();
      allow create: if logado() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }

    // Only the owner manages invites.
    match /convites/{email} {
      allow read, write: if ehDono();
    }
  }
}
```

## Client-side companions

- On first login call `garantirDono()`: try to `create` `config/dono` with
  `{ uid }`. If it already exists the rules reject it — swallow that error.
- Catch `permission-denied` when loading data and show a dedicated
  **"closed beta — ask for an invite"** screen with the user's e-mail
  displayed for easy copy-paste. A raw Firestore error here reads as "app is
  broken".
- Invite management UI (owner only): a simple textarea of e-mails that writes
  one doc per e-mail into `convites/`.

## Deploying rules

```bash
npx firebase deploy --only firestore:rules
```

Rules deploy independently from hosting — you can tighten security without
shipping a new build. Test in the console's **Rules Playground** before
deploying anything that could lock the owner out.
