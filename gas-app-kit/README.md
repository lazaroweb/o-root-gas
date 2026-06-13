# GAS App Kit — Claude Code Plugin

Build and deploy React + TypeScript web apps to Google Apps Script.
Works on **Windows**, **Mac**, and **Linux**. No coding experience required.

## What you get

- React 18 + TypeScript starter template
- Ant Design 5 UI components (buttons, tables, forms, modals)
- One-command deploy to Google Apps Script
- Local development preview
- Cross-platform scripts (PowerShell for Windows, bash for Mac/Linux)

## Installation

Install this plugin in Claude Code:

```bash
claude plugin install /path/to/gas-app-kit
```

Or add it to your project's `.claude/settings.json`:

```json
{
  "plugins": ["/path/to/gas-app-kit"]
}
```

## Getting started

In Claude Code, type:

```
/gas-app-kit
```

Claude will guide you through the entire process — from describing your app to deploying it — in plain language. No technical knowledge needed.

## Commands

| Command | What it does |
|---------|--------------|
| `/gas-app-kit` | Start a new project (or resume an existing one) |
| `/gas-app-kit deploy` | Build and deploy to Google Apps Script |
| `/gas-app-kit preview` | Start local development server |
| `/gas-app-kit pull` | Download latest version from Google |
| `/gas-app-kit setup` | Install tools (Node.js, clasp, Google auth) |

## What gets created

```
your-project/
├── src/
│   ├── App.tsx          — Your React app (edit this!)
│   ├── server.ts        — Google Apps Script server functions
│   ├── gas-client.ts    — Calls server functions from React
│   └── index.tsx        — Entry point
├── dist/                — Built files (auto-generated, don't edit)
├── esbuild.mjs          — Build configuration
├── package.json
├── tsconfig.json
└── appsscript.json      — Google Apps Script configuration
```

## Prerequisites

Claude will install these for you, but here's what's needed:

- **Node.js 22+** — [nodejs.org](https://nodejs.org)
- **clasp** — Installed automatically via `npm install -g @google/clasp`
- **Google account** — For deploying to Google Apps Script

## How it works

1. You describe what you want to build
2. Claude sets up the project and tools
3. Claude builds the React app with Ant Design components
4. One command deploys it to Google Apps Script
5. You get a link to share with anyone

## Limits (Google Apps Script)

- Bundle size: max 1.5MB (Claude monitors this)
- No client-side routing
- No localStorage
- No direct fetch() to external APIs (use GAS server functions instead)

## License

MIT

---

# GAS App Kit — Plugin para Claude Code

Crie e publique aplicações React + TypeScript no Google Apps Script.
Funciona no **Windows**, **Mac** e **Linux**. Nenhum conhecimento técnico necessário.

## O que você ganha

- Template pronto com React 18 + TypeScript
- Componentes visuais com Ant Design 5 (botões, tabelas, formulários, modais)
- Deploy com um comando para o Google Apps Script
- Preview local no navegador durante o desenvolvimento
- Scripts multiplataforma (PowerShell para Windows, bash para Mac/Linux)

## Instalação

Instale o plugin no Claude Code:

```bash
claude plugin install /caminho/para/gas-app-kit
```

Ou adicione ao `.claude/settings.json` do seu projeto:

```json
{
  "plugins": ["/caminho/para/gas-app-kit"]
}
```

## Como começar

No Claude Code, digite:

```
/gas-app-kit
```

O Claude vai guiar você em todo o processo — desde descrever o seu app até publicá-lo — em linguagem simples. Nenhum conhecimento técnico necessário.

## Comandos

| Comando | O que faz |
|---------|-----------|
| `/gas-app-kit` | Iniciar um novo projeto (ou continuar um existente) |
| `/gas-app-kit deploy` | Compilar e publicar no Google Apps Script |
| `/gas-app-kit preview` | Iniciar servidor local de desenvolvimento |
| `/gas-app-kit pull` | Baixar a versão mais recente do Google |
| `/gas-app-kit setup` | Instalar ferramentas (Node.js, clasp, autenticação Google) |

## O que é criado

```
seu-projeto/
├── src/
│   ├── App.tsx          — Seu app React (edite aqui!)
│   ├── server.ts        — Funções do servidor Google Apps Script
│   ├── gas-client.ts    — Chama funções do servidor a partir do React
│   └── index.tsx        — Ponto de entrada
├── dist/                — Arquivos gerados pelo build (não edite diretamente)
├── esbuild.mjs          — Configuração do build
├── package.json
├── tsconfig.json
└── appsscript.json      — Configuração do Google Apps Script
```

## Pré-requisitos

O Claude instala tudo por você, mas aqui está o que é necessário:

- **Node.js 22+** — [nodejs.org](https://nodejs.org)
- **clasp** — Instalado automaticamente via `npm install -g @google/clasp`
- **Conta Google** — Para publicar no Google Apps Script

## Como funciona

1. Você descreve o que quer criar
2. O Claude configura o projeto e as ferramentas
3. O Claude constrói o app React com os componentes do Ant Design
4. Um único comando publica no Google Apps Script
5. Você recebe um link para compartilhar com qualquer pessoa

## Limitações (Google Apps Script)

- Tamanho do bundle: máximo 1,5MB (o Claude monitora isso automaticamente)
- Sem roteamento no lado do cliente
- Sem localStorage
- Sem chamadas fetch() diretas para APIs externas (use as funções do servidor GAS)

## Licença

MIT
