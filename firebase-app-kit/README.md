# Firebase App Kit

Skills pra construir **web apps serverless no Firebase** com a stack validada
em produção pelo app Lastro (React + Vite + Firebase Auth/Firestore/Hosting,
lógica de negócio no navegador). Irmão do `gas-app-kit/` — quando o projeto
pede multiusuário, login sem aviso de "app não verificado", performance e
caminho pra Play Store, a stack é esta.

## Skills (13)

| Skill | Cobre |
|---|---|
| `fb-start` | Constituição do projeto, quando escolher Firebase vs GAS, ordem das etapas |
| `fb-setup-environment` | Node + firebase-tools + console (Auth/Firestore/Hosting) + Spark vs Blaze |
| `fb-init-project` | Scaffold Vite+React, layout de pastas, firebase.json com cache headers certos |
| `fb-auth-google` | Login Google sem aviso assustador; as 3 armadilhas reais (authDomain, redirect_uri, multi-conta) |
| `fb-firestore-rules` | Isolamento por usuário, posse sem e-mail hardcoded, beta fechado por convite |
| `fb-firestore-db` | Store em memória com write-through, limite de 500 ops/batch, custos de leitura |
| `fb-client-logic` | Lógica no navegador + registry de RPCs (portabilidade quase mecânica de apps GAS) |
| `fb-deploy` | Rotina de release, verificação por versão na topbar, rollback, reauth diário |
| `fb-app-check` | reCAPTCHA v3, monitorar antes de enforçar, proteção de cota/custo |
| `fb-migrar-do-gas` | Porte de código + ponte JSON pra dados + período de transição |
| `fb-ia-gemini` | Gemini direto do navegador com chave por usuário, retry, parse tolerante |
| `fb-custos-operacao` | Modelo de custo, monitoramento, backup, runbook de incidentes |
| `fb-pwa-android` | PWA instalável e Play Store via TWA (bubblewrap) |

## Como usar

- **Na Forja**: Atelier → Skills → Importar ▾ → "Importar Firebase App Kit" —
  as skills entram na pasta `firebase-app-kit` do catálogo e alimentam o kit
  "Firebase — Completo".
- **Direto num projeto**: copie as pastas de `skills/` pro diretório de skills
  do seu agente (`.claude/skills/`, `.cursor/rules/`, etc.).

## Origem

Cada skill destila lições reais da migração do Lastro v1 (Google Apps Script +
Sheets) pro Lastro v2 (Firebase), incluindo os incidentes de produção: loop de
login por authDomain cruzado, `redirect_uri_mismatch`, cache de `index.html`
segurando versão velha, limite de batch do Firestore, DLP barrando e-mail
hardcoded em rules, e o reauth diário de contas com Proteção Avançada.
