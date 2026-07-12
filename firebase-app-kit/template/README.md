# Template — Firebase App Kit

Fundação pronta pra apps Firebase serverless (React 18 + TypeScript + Vite +
Firebase Auth/Firestore/Hosting, lógica 100% no navegador). Extraída do
Lastro v2, que roda em produção — não é scaffold teórico.

**O que já vem funcionando:**

- Login Google via Firebase Auth (sem aviso de "app não verificado"), com
  splash → login → app e tratamento de erro visível.
- Beta fechado por convite: o primeiro a logar vira dono (`config/dono`),
  convidados entram via `convites/{email}` — tudo imposto pelas security rules.
- Store em memória espelhado no Firestore (`src/server/store.ts`): leituras
  síncronas, write-through assíncrono, batches de 400, saneamento de
  `undefined`/`Date`.
- Registry de RPCs + `callServer` (`src/rpc-client.ts`): a UI chama lógica por
  nome, com indicador global de carregamento — mesma ergonomia do GAS.
- Deploy configurado: `firebase.json` com cache headers corretos
  (`index.html` sem cache, assets imutáveis) e rules versionadas.
- Versão do `package.json` injetada na UI (login + topbar).
- App de demonstração: CRUD de notas em `usuarios/{uid}/Notas`.

## Como usar (novo projeto)

```bash
# 1. Copie e renomeie
cp -R firebase-app-kit/template ~/Documents/GitHub/meu-novo-app
cd ~/Documents/GitHub/meu-novo-app
git init

# 2. Batize o app
#    - package.json: "name" e "description"
#    - index.html: <title>
#    - src/App.tsx: const NOME_APP

# 3. Crie o projeto no Console Firebase (https://console.firebase.google.com)
#    - Authentication > Google: ativar
#    - Firestore: criar banco em modo produção (southamerica-east1)
#    - Configurações do projeto > Seus apps > Web: registrar e copiar o config

# 4. Configure o ambiente
cp .env.example .env      # preencha com o config do passo 3
#    ATENÇÃO: VITE_FIREBASE_AUTH_DOMAIN = <project-id>.web.app (NÃO firebaseapp.com)
echo '{"projects":{"default":"SEU-PROJECT-ID"}}' > .firebaserc

# 5. Instale, publique as rules e suba
npm install
npx firebase login        # se ainda não estiver logado
npm run deploy:rules      # security rules ANTES do primeiro acesso
npm run deploy            # build + hosting
```

Abra `https://SEU-PROJECT-ID.web.app`, faça login — você vira o dono — e o
CRUD de notas já funciona. Se o login der `redirect_uri_mismatch`, adicione o
domínio `.web.app` nas origens/redirects do OAuth client no Google Cloud
Console (detalhes na skill `fb-auth-google`).

## Pra onde crescer

| Quero… | Mexo em… | Skill de apoio |
|---|---|---|
| Novas tabelas | `TABELAS` em `src/server/store.ts` | `fb-firestore-db` |
| Novas funções de negócio | `src/server/logic.ts` + registrar em `RPCS` | `fb-client-logic` |
| Novas telas | `src/App.tsx` (ou `src/views/`) | `fb-init-project` |
| IA (Gemini, chave por usuário) | `props` do store + fetch direto | `fb-ia-gemini` |
| Proteção de custo | App Check (`VITE_APPCHECK_SITE_KEY`) | `fb-app-check` |
| Play Store | PWA + TWA | `fb-pwa-android` |

## Regras de ouro (aprendidas em produção)

1. `authDomain` = domínio do Hosting (`.web.app`) — senão o popup de login
   vira cross-origin e o Chrome bloqueia a sessão em silêncio.
2. Nunca engula erro de login num catch vazio — é assim que nasce o "loop de
   login" indebugável.
3. Nenhum segredo compartilhado no bundle — todo o código roda no navegador.
   Chave de IA é BYO-key, por usuário, gravada no Firestore dele.
4. `resetStore()` no logout — memória de outra conta é vazamento de dados.
5. Rules primeiro, feature depois: a única autorização real é o
   `firestore.rules`.
