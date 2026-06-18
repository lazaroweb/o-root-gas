---
name: gas-readme-standard
description: README standard for all GAS App Kit projects so every app goes to git the same way. Use when creating, reviewing, or normalizing a project README, or when scaffolding a new app. Defines the canonical section order, badges, deploy/rollback blocks, and a ready-to-fill template.
---

# GAS App Kit — Padrão de README

Toda aplicação criada com o GAS App Kit deve subir pro git com um README no
**mesmo padrão**. Isso dá consistência ao QG: qualquer repo é lido da mesma forma,
e o onboarding (seu ou de outra pessoa) é imediato.

## Princípios

- **Português** como idioma principal (bloco em inglês opcional no fim).
- **Topo escaneável**: nome, tagline de uma linha, badges e índice.
- **Ordem fixa de seções** (abaixo) — não invente ordem nova por projeto.
- **Blocos de deploy e rollback sempre presentes** (mesmo que o app não esteja no ar ainda).
- **Sem números chutados**: tamanho de bundle, versão e contagens devem refletir o build real.
- **Links relativos** pra docs do próprio repo (`ARCHITECTURE.md`, `DEPLOY.md`, `SECURITY.md`).

## Ordem canônica das seções

1. Título + tagline (1 linha) + badges
2. Índice (TOC) — só se o README passar de ~120 linhas
3. **Por que existe** (1–2 parágrafos do problema)
4. **Features** (agrupadas por área, bullets curtos)
5. **Stack** (bloco de código com Frontend / Build / Backend / DB / Deploy)
6. **Começando** (clone, install, login, build, deploy)
7. **Deploy & rollback** (comandos exatos)
8. **Documentação** (links pros .md do repo)
9. **Decisões de design** (por que GAS, por que tal DB, etc.)
10. **Roadmap**
11. **Licença & uso**

## Template (copie e preencha)

```markdown
# {{Nome}}

> **{{tagline de uma linha}}**

![status](https://img.shields.io/badge/status-ativo-3CB371)
![stack](https://img.shields.io/badge/stack-React%20%2B%20GAS-444)
![version](https://img.shields.io/badge/version-{{x.y.z}}-blue)

## Por que existe
{{1–2 parágrafos do problema que o app resolve}}

## Features
### {{Área 1}}
- {{bullet}}
### {{Área 2}}
- {{bullet}}

## Stack
\```
Frontend:  React 18 + TypeScript + Ant Design + Lucide
Build:     esbuild (chunking pro limite do GAS)
Backend:   Google Apps Script (V8) + UrlFetchApp + PropertiesService
DB:        Google Sheets (engine SheetDB)
Deploy:    clasp (1 deployment estável reutilizado)
\```

## Começando
\```bash
npm install
npx clasp login        # uma vez
npm run deploy
\```

## Deploy & rollback
\```bash
npm run deploy                 # build + push + deploy
npm run versions               # lista versões
npm run rollback -- <numero>   # volta pra uma versão anterior
\```

## Documentação
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEPLOY.md](DEPLOY.md)
- [SECURITY.md](SECURITY.md)

## Decisões de design
- **Por que GAS?** {{...}}

## Roadmap
- {{...}}

## Licença & uso
{{...}}
```

## Checklist antes de subir pro git

- [ ] Título + tagline + badges no topo
- [ ] Seções na ordem canônica
- [ ] Bloco de deploy E de rollback
- [ ] Números (versão/bundle) batem com o build real
- [ ] Links das docs relativos e existentes
- [ ] `.gitignore` cobre `node_modules/`, `dist/`, `.clasp.json`, `.DS_Store`
