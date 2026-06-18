# Forja

> **Da ideia ao app no ar, num só lugar.** O QG do vibe coder — gestão completa de produtos com IA embarcada, rodando 100% no Google Apps Script.

![status](https://img.shields.io/badge/status-ativo-3CB371)
![stack](https://img.shields.io/badge/stack-React%2018%20%2B%20GAS-444)
![version](https://img.shields.io/badge/version-1.63.4-blue)

Forja é uma plataforma pessoal para quem desenvolve produtos com IA (Cursor, Claude, ChatGPT) e precisa orquestrar tudo: clientes, ideias, sistemas, custos, receitas, status operacional, auditorias e o próprio "atelier" de trabalho (skills, snippets, templates, bookmarks, Driver/nuvens, hospedagem, cofre criptografado).

Roda inteiramente como um **Web App do Google Apps Script**, usando **Google Sheets como banco**. Não precisa servidor, não precisa pagar nada, é seu — e a planilha vive na sua conta Google.

---

## Por que existe

Sou BA, não desenvolvedor. Construo apps com **vibe coding** (Cursor + Claude). Em algum momento, virou uma bagunça: ideias num doc, custos numa planilha, repositórios espalhados, briefings perdidos, prompts esquecidos. Faltava um QG.

Tentei usar Notion, Linear, Airtable, ClickUp. Nenhum tinha o que eu precisava: um lugar único, leve, opinionado pro fluxo "ideia → MVP → cliente pagante", com IA contextual de verdade e sem assinatura mensal.

A Forja é esse QG. Premium, minimalista, opinionado, e do tamanho exato do problema.

---

## Features

### Fluxo de produto
- **Clientes & Discovery**: cadastro de pessoas, entrevistas com IA-resumo, oportunidades
- **Ideias**: banco com nota de impacto/esforço, conversão em sistema
- **Sistemas (Bancada)**: portfólio com estágios (Faísca → Forja → Brasa → Liga → Aposentado), URL prod, repo, web app, domínio customizado
- **Recursos / Decisões / Riscos / Pulsos**: tudo por sistema, histórico completo

### Forja IA (assistente embarcado)
- Chat contextual: portfólio inteiro ou sistema específico
- **Tool-calling**: a IA propõe ações estruturadas (`criar_ideia`, `registrar_risco`, `gerar_arquivo_md`) que você aprova
- **Skills no prompt**: selecione skills (markdown) e a IA usa como system prompt
- **Auditoria estruturada**: Problema → Evidência → Solução → Prompt, persistida no histórico
- **Blueprints & Diagramas**: gera PRDs e diagramas Mermaid das suas ideias

### Operações
- **Status** dos seus apps (uptime, latência) com check automático
- **APIs/Endpoints** monitorados (Anthropic, OpenAI, proxies, custom)
- **GitHub** integrado (repos, last commit, lang)
- **Importação GAS**: traz seus Apps Scripts existentes pra Bancada em 1 clique

### Financeiro
- **MRR** com séries reais, gráfico mensal
- **Custos por sistema** (recorrentes + one-off)
- **Contas a pagar/receber** com calendário
- **Lucro líquido** calculado por sistema

### Atelier (kit do vibe coder)
- **Skills** — biblioteca de prompts/playbooks em markdown (formato SKILL.md)
- **Snippets** — blocos de código reutilizáveis com syntax tags
- **Templates** — briefings, PRDs, emails com substituição de variáveis `{{var}}`
- **Bookmarks** — links salvos com favicon, categoria, destaque
- **Hospedagem** — catálogo curado de 18+ provedores (Vercel, Netlify, Supabase, Railway, Fly.io, Render, etc.) com free tier, preço, benefícios, limitações
- **Cofre** — chaves de API e senhas com encryption client-side AES-256-GCM (zero-knowledge, ver [SECURITY.md](forja/SECURITY.md))

### Automações & Alertas
- Regras configuráveis (downtime, custo subindo, conta vencendo, sistema sem pulso, etc.)
- Canais: email + webhook
- Dedupe inteligente
- Drawer de alertas com sinos animados

### Relatórios
- Snapshot mensal: KPIs, sistemas, alertas, contas, timeline
- Export CSV/JSON
- Print-to-PDF (browser nativo)

### Backup & Restore
- **Snapshot total**: 1 JSON com toda a Forja
- **Restore com dry-run**: preview antes de aplicar, modos merge/substituir
- Cofre exportado cifrado (sua senha-mestra continua a única chave)

### UX
- Design **Forja Premium Minimal** — paleta pastel, tipografia editorial, animações sutis
- **Dark/Light** com tema persistente
- **Mobile-first** — sidebar vira drawer, modais ficam fullscreen
- **Atalhos `g+letra`**: `g+d` dashboard, `g+s` sistemas, `g+v` atelier, etc.
- **Command palette** `⌘K`/`Ctrl+K` com busca semântica
- **Onboarding** guiado com progresso

---

## Stack

```
Frontend:  React 18 + TypeScript + Ant Design + Lucide icons + Mermaid
Build:     esbuild (chunking em ~12 fatias <=195KB pro GAS engolir)
Backend:   Google Apps Script (V8 runtime) + UrlFetchApp + PropertiesService
DB:        Google Sheets (engine SheetDB custom)
LLM:       Anthropic / OpenAI / proxy compatível
Crypto:    Web Crypto API (AES-256-GCM + PBKDF2)
Deploy:    clasp (1 deployment estável reutilizado)
```

---

## Começando

```bash
cd forja
npm install

# Configurar clasp (uma vez)
npx clasp login
# .clasp.json já está commitado apontando pro deployment estável

# Build + deploy
npm run build
npx clasp push --force
npx clasp deploy -i <DEPLOYMENT_ID> -d "descrição"
```

Veja [forja/DEPLOY.md](forja/DEPLOY.md) pra setup completo, propriedades do Script, scopes OAuth e troubleshooting.

---

## Deploy & rollback

```bash
cd forja
npm run deploy                 # build + push + deploy (descrição automática do CHANGELOG)
npm run versions               # lista todas as versões publicadas
npm run rollback -- <numero>   # volta o deploy estável pra uma versão anterior
```

A URL do app é sempre a mesma — só o conteúdo muda/volta no tempo.

---

## Documentação

- [forja/ARCHITECTURE.md](forja/ARCHITECTURE.md) — design do SheetDB engine, chunking strategy, fluxo GAS↔React
- [forja/DEPLOY.md](forja/DEPLOY.md) — passo a passo de deploy + propriedades necessárias
- [forja/SECURITY.md](forja/SECURITY.md) — modelo de segurança do Cofre (zero-knowledge)
- [forja/DRIVER_OAUTH.md](forja/DRIVER_OAUTH.md) — conectar OneDrive e contas Google extras (passo a passo Azure/Google)

---

## Decisões de design

- **Por que GAS?** Free, hospedado pelo Google, OAuth nativo, sem servidor pra gerenciar. Limite: 6MB HTML/script (resolvido com chunking).
- **Por que Sheets como DB?** Você já tem. Editável manualmente. Backup nativo (Google Drive). Performance suficiente pra <50k linhas.
- **Por que client-side crypto no Cofre?** Servidor (GAS) nunca vê o plaintext. Mesmo se o JSON do snapshot vazar, sem a senha-mestra é ruído.
- **Por que Anthropic + OpenAI + proxies?** Um proxy compatível dá liberdade de trocar modelos. A Forja descobre modelos via `/v1/models`.
- **Por que React + esbuild ao invés de Vue/Svelte?** Familiaridade. Bundle fica em ~2.3MB (HTML inline, fatiado pra driblar o limite do GAS). Não foi limitante.

---

## Roadmap (v1.1+)

- Snapshot por cliente (filtra portfólio em PDF)
- Editor markdown rico (Monaco/CodeMirror) no Atelier
- Sincronização multi-device (mesma planilha, deploys diferentes)
- Sugestões automáticas de skills baseadas em contexto
- Marketplace de templates da comunidade

---

## Licença & Uso

Software pessoal. Use como quiser. Forke, modifique, adapte ao seu workflow.

---

**Construído com vibe code, Cursor e ☕.**
