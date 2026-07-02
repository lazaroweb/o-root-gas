# Forja — Formulário público de Discovery

Projeto **Apps Script separado** e **anônimo** que serve o formulário de discovery
do cliente. Ele grava na **mesma planilha** da Forja (`FORJA_SHEET_ID`), então as
respostas aparecem direto na aba **Discovery → Respostas recebidas** do app principal.

## Por que um projeto separado?

A Forja é privada (`access: MYSELF`). No Apps Script, qualquer função fica chamável
via `google.script.run` por quem abrir a página — então tornar a Forja anônima
exporia tudo. Este projeto contém **apenas** `doGet` + 2 funções públicas
(`getFormPublico`, `submitRespostaPublica`), sem nenhuma função administrativa.
Isolamento por construção (OWASP A01).

## Dependência cross-project (build)

O `esbuild.mjs` deste projeto injeta duas libs no topo do `dist/Server.js`
(o GAS não tem ESM — elas viram funções globais):

- `../forja/src/lib/score.ts` — **compartilhada com o app principal**: fonte
  única da fórmula do score de oportunidade. Mover/renomear essa lib exige
  atualizar os dois `esbuild.mjs`. O build falha com mensagem clara se o
  caminho quebrar.
- `src/lib/guards.ts` — guards locais (throttle fail-closed + sanitização de
  token), puros e cobertos por `npm test` (vitest).

## Segurança (resumo)

- **Superfície mínima**: só ler form por token e gravar resposta.
- **Entrada hostil**: tudo validado, truncado e sanitizado (nome/e-mail/respostas).
- **Anti-abuso**: rate-limit leve por token + teto de respostas por formulário.
- **Falha fechada**: erros genéricos pro cliente; nada de stack trace.
- **Token UUID** (não-sequencial) dificulta enumeração.

## Setup único (você precisa fazer uma vez)

> Pré-requisito: `npm i` aqui dentro e estar logado no clasp (`npx clasp login`).

1. **Criar o projeto** (standalone):
   ```bash
   cd forja-public
   npm install
   npx clasp create --type standalone --title "Forja — Discovery Público"
   ```
   Isso preenche o `scriptId` no `.clasp.json` (substitui o placeholder).

2. **Subir o código**:
   ```bash
   npm run build && npx clasp push --force
   ```

3. **Configurar a planilha compartilhada** — no editor do projeto público
   (`npx clasp open`): **Configurações do projeto → Propriedades do script** →
   adicione `FORJA_SHEET_ID` = o ID da planilha da Forja.
   (O ID está nas Script Properties do app principal, na mesma chave.)

4. **Publicar como anônimo** — no editor: **Implantar → Nova implantação →
   App da Web**:
   - *Executar como*: **Eu**
   - *Quem pode acessar*: **Qualquer pessoa**
   Copie a **URL do app da Web** (termina em `/exec`).

5. **Ligar na Forja** — nas Script Properties do **app principal**, defina
   `DISCOVERY_PUBLIC_URL` = a URL `/exec` copiada acima.
   Pronto: ao **Publicar** um roteiro na Forja, o botão **Link** copia
   `…/exec?f=TOKEN` — cada cliente tem seu token.

## Atualizar o código depois

```bash
cd forja-public
npm run deploy   # build + push
```
Depois, no editor: **Implantar → Gerenciar implantações → (sua) → editar →
Nova versão**. (A URL continua a mesma.)

## Como o cliente usa

Abre `…/exec?f=TOKEN` → formulário leve e progressivo (1 pergunta por vez,
maioria clicável) → no fim deixa **nome + e-mail** (chave) → envia. A resposta
cai na Forja com um **score de oportunidade** (0–100).
