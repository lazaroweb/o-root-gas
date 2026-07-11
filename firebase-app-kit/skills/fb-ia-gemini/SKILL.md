---
name: fb-ia-gemini
description: LLM features in a client-side Firebase app — direct Gemini calls with per-user BYO keys stored in Firestore, retry/backoff, and tolerant JSON parsing for AI responses. Use when adding AI features (document interpretation, plans, chat).
---

# AI features — Gemini from the browser, per-user keys

With no server, each user brings their own Gemini API key (free tier at
https://aistudio.google.com/apikey), entered in an in-app settings drawer and
stored **in that user's own Firestore subtree** — protected by the same rules
as their data. The developer never handles other people's keys.

## The call

```typescript
async function geminiGenerateContent(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (r.status === 429 || r.status >= 500) {         // rate limit / instability
      await new Promise((ok) => setTimeout(ok, 1500 * tentativa));  // backoff
      continue;
    }
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  throw new Error('Gemini indisponível após 3 tentativas');
}
```

Unlike GAS (`UrlFetchApp` hard 60s timeout), browser `fetch` has no such
limit — long analyses just work.

## Tolerant JSON parsing (LLMs WILL break your JSON)

Production lessons — every one of these happened:

- Strip code fences before parsing: `` ```json … ``` `` wrappers are common.
- Strip `<think>…</think>` blocks from reasoning models.
- If `JSON.parse` fails, try extracting the largest `{…}` or `[…]` slice
  before giving up (truncation cuts the tail, the head is usually valid).
- On failure, retry ONCE with a shorter prompt or higher output budget —
  then fail with a message that includes a snippet of the raw response
  (debuggability beats a generic "IA falhou").
- Large inputs (invoice PDFs, catalogs): process in **chunks** and merge, and
  always show progress in the UI (never a silent multi-second operation).

## UX contract for AI features

- Settings drawer explains WHERE the key ends up ("fica só na sua conta") and
  links the exact page to create one — full URL, no placeholders.
- A "Testar conexão" button that does a 1-token round-trip and reports
  ok/error — kills most support questions.
- Every AI action shows a progress state with the current step; every failure
  is actionable (retry button + readable reason).
