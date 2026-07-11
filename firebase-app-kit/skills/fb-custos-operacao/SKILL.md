---
name: fb-custos-operacao
description: Operating a Firebase app — cost model and free-tier math, monitoring, backup/restore of Firestore, and the incident runbook. Use when going to production or reviewing costs.
---

# Costs & operations — running it calmly

## Cost model (what actually costs money)

| Resource | Free tier (with Blaze, free quota still applies) | Real-world usage example |
|---|---|---|
| Firestore reads | 50k/day | ~2k rows loaded per login → 25 logins/day free |
| Firestore writes | 20k/day | normal CRUD barely registers |
| Storage | 1 GB | years of text data for a finance app |
| Hosting transfer | 10 GB/month | ~1 MB bundle → 10k visits/month |

A small multi-user app (≤ 20 invited users) stays at **R$ 0**. The realistic
risks are: quota abuse from outside (mitigate with App Check — see
fb-app-check) and accidental `onSnapshot` listeners multiplying reads.

**Always set a budget alert** (Google Cloud Billing → Budgets) when on Blaze —
e.g. R$ 10 — so surprises arrive as e-mail, not invoice.

## Monitoring (weekly 2-minute check)

Console → **Usage and billing**: reads/writes trend. Console → Firestore →
Usage tab: per-day chart. If reads jump 10x with no new users → investigate
listeners or an abuse pattern.

## Backup / restore (no built-in scheduled backup on the free path)

Simplest robust approach for small apps — an **in-app export button**
(owner-only): serialize all collections to a JSON download (same format as the
migration bridge, see fb-migrar-do-gas). Restore = the import path. Monthly
manual export is honest and sufficient at this scale; document the routine in
`docs/OPERACOES.md`.

## Incident runbook

| Symptom | First move |
|---|---|
| "App não abre" / white screen | Hard refresh; check Hosting release history — rollback if a bad deploy |
| Login loop | Check authDomain + OAuth origins (fb-auth-google traps 1-2) |
| `permission-denied` for a legit user | Invite doc missing (`convites/{email}`) or rules regression — test in Rules Playground |
| Costs rising | Usage tab → find the read spike → listeners or missing App Check |
| Deploy fails with auth error | `npx firebase login --reauth` (daily with Advanced Protection) |

## Docs that must exist before "production"

`README.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
`docs/DEPLOY.md`, `docs/OPERACOES.md`, `docs/PRIVACIDADE.md` (data policy —
required for a Play Store listing later), and `AGENTS.md` for AI-assisted
development continuity.
