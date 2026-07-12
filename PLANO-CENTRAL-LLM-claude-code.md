# Prompt pra Claude Code — Central de Modelos LLM

> Copie TUDO abaixo da linha e cole no Claude Code do outro PC, numa pasta
> nova e vazia (ex.: `central-llm`). Tenha em mãos: as base URLs e keys dos
> seus proxies. É só isso que ele vai te pedir.

---

## Quem eu sou (leia antes de qualquer coisa)

Sou Business Analyst, NÃO sou desenvolvedor. Português brasileiro. Regras de
como trabalhar comigo:

1. Me explique cada etapa em linguagem simples ANTES de executar.
2. Nunca me passe comandos ou URLs com `<PLACEHOLDER>` — sempre valores
   completos, prontos pra copiar e colar.
3. Quando precisar de algo que só eu tenho (keys, cliques em site), pare,
   me diga exatamente o que fazer e espere eu responder.
4. Uma fase por vez. Só avance quando a anterior estiver TESTADA e funcionando.
5. Se algo falhar, me mostre o erro traduzido pro meu nível e proponha a
   correção — não fique tentando em silêncio.

## Missão

Montar neste computador a minha **Central de Modelos LLM**: um gateway local
(LiteLLM) onde eu cadastro quantos proxies/provedores de IA eu quiser (cada um
com sua base URL e key), expondo tudo num endpoint único e compatível com
OpenAI (`http://localhost:4000`). Em cima disso, configurar o agente **Cline**
no VS Code pra eu programar usando qualquer um desses modelos — liberdade que
hoje não tenho, porque só consigo usar o que vem pré-configurado nas
ferramentas.

Arquitetura-alvo:

```
[Cline no VS Code] ──┐
[Claude Code]        ├──► [LiteLLM em localhost:4000] ──► [Proxy A]
[outras ferramentas] ┘         (uma key virtual)          [Proxy B]
                                                          [Gemini/OpenAI/...]
```

## Regras de segurança (invioláveis)

- Keys REAIS só podem existir em: arquivo `.env` (listado no `.gitignore`) ou
  na tela de configuração da própria ferramenta. NUNCA em arquivo commitável,
  NUNCA no chat de resposta, NUNCA em README.
- Crie o `.gitignore` ANTES do primeiro arquivo com segredo.
- Ao final de cada fase, rode um teste real e me mostre o resultado.

## FASE 0 — Diagnóstico da máquina

1. Detecte o sistema operacional e me diga o que encontrou.
2. Verifique o que já está instalado: VS Code, Docker Desktop, Python 3,
   Node, git. Liste o que falta.
3. Pra cada item faltante, me guie na instalação (link oficial + cliques).
   Docker Desktop é o preferido pra rodar o LiteLLM; se não der pra instalar,
   use Python (`pip install 'litellm[proxy]'`) como plano B.

## FASE 1 — Gateway LiteLLM (o coração)

1. Nesta pasta, crie a estrutura:
   - `docker-compose.yml` rodando a imagem oficial `ghcr.io/berriai/litellm:main-stable`, porta 4000, montando `config.yaml`.
   - `config.yaml` com `model_list` — comece VAZIO de verdade e me
     entreviste: "qual o nome do proxy? qual a base URL? qual o modelo?" —
     um por um, até eu dizer que acabou. Keys via `os.environ/NOME_DA_VAR`.
   - `.env` com as keys que eu te passar + `LITELLM_MASTER_KEY` que você
     gera na hora (formato `sk-` + 32 caracteres aleatórios).
   - `.gitignore` cobrindo `.env`.
2. Suba o gateway e teste CADA modelo cadastrado com uma chamada real de
   chat ("responda só OK"). Me mostre a tabela: modelo → funcionou/erro.
3. Gere uma **key virtual** no LiteLLM pra eu usar nas ferramentas (assim as
   keys reais ficam só no gateway).
4. Me ensine a abrir o dashboard admin no navegador (URL completa) e onde
   vejo o gasto por modelo.

## FASE 2 — Cline no VS Code (o agente)

1. Me guie: instalar a extensão "Cline" no VS Code (marketplace oficial).
2. Configure o provider do Cline como "OpenAI Compatible" apontando pra
   `http://localhost:4000/v1` com a key virtual da Fase 1.
3. Adicione ao Cline os modelos cadastrados no gateway.
4. Teste comigo: uma tarefa simples de código num projeto de exemplo,
   trocando de modelo no meio, pra eu VER a liberdade funcionando.

## FASE 3 — Plugar o próprio Claude Code

1. Configure a variável de ambiente `ANTHROPIC_BASE_URL=http://localhost:4000`
   (mais a key virtual) no perfil do meu terminal, do jeito certo pro sistema
   operacional detectado na Fase 0.
2. Teste abrindo uma sessão nova do Claude Code roteada pelo gateway.
3. Me explique como VOLTAR ao normal (desfazer a variável) se eu quiser usar
   minha conta Anthropic padrão — quero as duas opções documentadas.

## FASE 4 — Documentação e memória

1. Escreva um `README.md` da central: o que é, como ligar/desligar o
   gateway, como ADICIONAR UM PROXY NOVO (passo a passo pro meu nível), como
   gerar key virtual nova, troubleshooting dos 5 erros mais prováveis.
2. Crie um `CLAUDE.md` na pasta com o contexto essencial pra sessões futuras
   suas: arquitetura, onde ficam as configs, regras de segurança.
3. `git init` + primeiro commit (CONFIRA antes que nenhum segredo está indo).

## Critérios de aceite (checklist final)

- [ ] `docker compose up -d` (ou plano B) sobe o gateway e ele responde.
- [ ] Todos os meus proxies testados com chamada real via endpoint único.
- [ ] Dashboard admin acessível e mostrando gasto.
- [ ] Cline funcionando com pelo menos 2 modelos diferentes do gateway.
- [ ] Claude Code roteável pelo gateway, com instrução de reverter.
- [ ] README + CLAUDE.md escritos, git limpo de segredos.

Comece pela FASE 0 e me diga o que encontrou nesta máquina.
