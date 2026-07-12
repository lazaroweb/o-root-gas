# Complemento — Central de Modelos LLM (fase extra)

> Cole TUDO abaixo da linha no agente (Cursor/Claude Code) do PC Windows,
> **na mesma pasta** onde a central já está sendo montada. Ele vai encaixar
> estes upgrades no que já existe, sem refazer nada.

---

## Contexto

Sou Business Analyst, não desenvolvedor — continue seguindo as regras do
plano original (explicar antes de executar, sem placeholders, uma etapa por
vez, keys só em `.env`). Este documento COMPLEMENTA o plano da Central de
Modelos LLM que já está em andamento nesta pasta. Não desmonte o que já
funciona: primeiro confira em que fase o projeto parou e termine o que
estiver pendente; só então aplique o que vem abaixo.

## Upgrade 1 — PostgreSQL pro LiteLLM (memória de gastos) — PRIORITÁRIO

Sem banco, o dashboard de gastos do LiteLLM zera toda vez que o container
reinicia. Conserte isso:

1. Adicione ao `docker-compose.yml` um serviço `postgres` (imagem oficial
   `postgres:17`), com senha vinda do `.env` e um volume nomeado pra os
   dados sobreviverem a reinícios.
2. Conecte o LiteLLM a ele via `DATABASE_URL` no `.env`.
3. Teste: faça 2 chamadas de chat, reinicie tudo (`docker compose down` e
   `up -d`) e me MOSTRE que o histórico de gasto continua lá.

## Upgrade 2 — Portainer (painel visual das caixinhas)

Quero gerenciar os containers por uma página, não por comandos:

1. Adicione o serviço `portainer` (imagem `portainer/portainer-ce:latest`)
   ao compose, com volume próprio.
2. Me passe a URL completa pra abrir no navegador e me guie na criação do
   usuário admin (isso sou eu que faço, na tela).
3. Me mostre na prática: onde vejo o que está ligado, e onde é o botão de
   reiniciar um serviço.

## Upgrade 3 — Open WebUI (meu ChatGPT pessoal plugado na central)

Interface de chat no navegador usando QUALQUER modelo do gateway:

1. Adicione o serviço `open-webui` (imagem
   `ghcr.io/open-webui/open-webui:main`) ao compose, com volume próprio.
2. Configure-o pra falar com o LiteLLM: `OPENAI_API_BASE_URL` apontando pro
   serviço do gateway na rede interna do Docker e a key virtual como
   `OPENAI_API_KEY`.
3. Teste comigo: abrir no navegador, criar minha conta local, conversar com
   2 modelos diferentes da central.

## Upgrade 4 (OPCIONAL — só se eu pedir) — Ollama, modelos locais grátis

Antes de qualquer coisa: verifique a RAM e a placa de vídeo desta máquina e
me diga com sinceridade se vale a pena. Se valer:

1. Adicione o serviço `ollama` ao compose (com GPU se existir).
2. Baixe UM modelo pequeno pra começar (ex.: `qwen3:8b` ou similar atual).
3. Cadastre esse modelo no `config.yaml` do LiteLLM (provider `ollama_chat`),
   pra ele aparecer na central como os outros — custo zero por chamada.

## Regras que continuam valendo

- Nada de segredo em arquivo commitável — só `.env` (que já está no
  `.gitignore`).
- Cada upgrade termina com teste real + atualização do `README.md` (como
  ligar, como usar, troubleshooting) e do `CLAUDE.md`.
- No Windows: se precisar liberar porta ou o Docker pedir algo do WSL2, me
  explique o clique exato antes.
- Commit ao final de cada upgrade, com mensagem clara — confira antes que
  nenhum segredo está indo junto.

## Checklist final desta fase extra

- [ ] Gasto do LiteLLM sobrevive a reinício (Postgres funcionando).
- [ ] Portainer aberto no navegador, com admin criado por mim.
- [ ] Open WebUI conversando com pelo menos 2 modelos da central.
- [ ] README e CLAUDE.md atualizados com os novos serviços.
- [ ] (Se Ollama entrou) modelo local aparecendo no gateway como os demais.

Comece conferindo o estado atual do projeto e me diga o que encontrou.
