# Roadmap Forja

> Histórico do que foi entregue e fila do que vem por aí. Atualizado a cada release.

---

## Entregue

### v1.0 — Atelier
- Skills Hub (sheet-based, markdown + frontmatter)
- Hosting Providers Catalog
- Encrypted Vault (AES-256-GCM client-side, zero-knowledge)
- Snippets / Templates / Bookmarks
- Backup & Restore (snapshot JSON com merge/replace)

### v1.1 — Automação inteligente
- Auditorias Agendadas (rate-limited, batched, alertas)
- Snapshot de Cliente (agregado completo por pessoa)
- Sugestões de Skills no IAChat (heurística local)

### v1.2 — Backlog Kanban + correções
- Persistência de findings registrados (botão "Registrar como Decisão" muda de estado corretamente)
- Backlog Kanban por sistema (drag entre colunas, export como prompt `.md`)
- Detecção e recuperação de decisões/riscos órfãs
- Indicador visual de backlog pendente nos cards da Bancada
- Roadmap v2.0 da Forja seedado no próprio sistema
- v1.2.8 — Backlog em Drawer full-screen + resumo limpo na tab

### v1.3 — Finanças Pessoais
- Tab **"Pessoal"** dentro de `Financeiro` (separada do negócio)
- Lançamentos (cartão, Pix, débito, dinheiro, boleto), contas a pagar, cartões
- Fatura aberta por cartão + resumo do mês (categoria/método)
- Assinaturas pessoais, renda recorrente, análise financeira (Norte)
- Importação de fatura PDF via Gemini + Plano de Contas
- Gestão de família (despesas compartilhadas)

### v1.13–v1.14 — Reestruturação Financeiro + UX
- Macro **Empresa × Pessoal**, cada lado com suas abas
- Navegação **list-detail** (`SubNav`) padronizada (Atelier, Pessoal, Empresa)
- Receituário com campo **Exemplo** + upsert das receitas padrão

### v1.15 — Despesas da Empresa
- Livro-caixa mensal com mês de referência, KPIs e tabela
- Importação de conta/recibo (PDF/foto) via Gemini

### v1.16–v1.18 — Receita recorrente (core de assinaturas)
- "A receber" virou painel SaaS: MRR/ARR, assinantes, ARPU, churn
- Cliente como primeira classe + catálogo de planos por app
- Vendas avulsas (fora do MRR)
- **Recebimentos + inadimplência**: registrar recebimento (rola a próxima
  cobrança), recebido no mês × previsto, cobranças em atraso

### v1.17 — Visão geral entrada × saída
- Despesas do mês entram na saída de caixa; **margem recorrente** × **resultado
  de caixa**; despesa por app no lucro por aplicação

### v1.19 — Serviço de PDF + notificações
- **PDF server-side** confiável (sem `window.print`)
- **Recibo / Fatura** de assinatura em PDF + dados do emissor
- **Comprovante** e **relatório de despesas** em PDF; relatório mensal em PDF
- **Resumo financeiro por e-mail** (envio manual + agendado diário)

### v1.141 — Centelha (caixa global de captura)
- Nova sessão entre Ideias e Sistemas, ícone 🔥
- Captura zero-fricção (1 input + Enter), 3 visões (Capturadas/Triadas/Resolvidas)
- Triagem rica: categoria, prioridade, sistema, contexto, tags
- 4 destinos: → Ideia, → Backlog (sistema), Arquivar, Descartar
- IA refina + detecta duplicata cruzando com Ideias + Decisões
- Hotkey global `g+x` + badge no Dashboard ("N pra triar", clicável)
- Conceito: GTD (capture → process → organize) + Personal Kanban
- Nova tabela `Centelhas`, SCHEMA_VERSION → `v1.64-centelha`

### v1.142 — Ideias com lifecycle completo
- Botão Concluir + carimbo `concluidaEm` pro histórico
- Botão Reabrir (volta pra "em andamento")
- Menu ⋯ por ideia: Arquivar / Descartar / Apagar (com confirmação)
- Filtro por estado: Ativas / Concluídas / Arquivadas / Descartadas / Todas
- Indicador visual de concluída (título riscado, faixa lateral, ícone ✓)
- Timestamps relativos ("há 3d") com data completa no tooltip
- SCHEMA_VERSION → `v1.65-ideias-lifecycle` (col `concluidaEm` append-only)

---

## Fila

### Próximos candidatos

#### Auditoria Forja IA — alta prioridade

- **Leitura paginada de repositórios grandes (resolver `DIFF TRUNCADO`)**
  - Hoje: quando repo passa de ~60-80KB, a IA vê só uma fatia e um alerta peach "DIFF TRUNCADO — IA NÃO VIU TUDO" é mostrado. Achados variam de rodada pra rodada porque a fatia muda. Frustrante e sem tratativa.
  - Proposta: dividir leitura em 2-3 batches (por pasta/módulo, ordenando por relevância — `src/` antes de `tests/` etc.), rodar a IA em cada batch, mesclar achados via reconciliação determinística (Jaccard de títulos, já implementada na v1.140.0), descartando duplicatas.
  - Estimativa: 30-45 min de implementação. Resolve definitivamente o alerta de truncamento.
  - Trigger: usuário rodou v1.140.0 com `one-colmeia-app` (~85KB) e o alerta apareceu.

- **Caminho de tratativa explícito em TODO alerta da Forja** (princípio "alerta sem ação proibido")
  - Hoje: alguns alertas (DIFF TRUNCADO, frescor, docs-only) já têm CTA. Mas existem alertas/banners sem caminho claro.
  - Proposta: audit interno (varrer todos os componentes `Alert`, `Tag`, banners), garantir que cada um tenha: (a) ação primária acionável OU (b) link "saiba mais / por que isso aparece" OU (c) botão pra dispensar com nota.
  - Estimativa: 1-2 horas de audit + correções.

- ~~**Reconciliação semântica de achados**~~ — **ENTREGUE v1.140.1** (opção A): nova função `_mesmoAchado` com 2 camadas (Jaccard ≥ 0.4 + área igual + ≥1 keyword técnica em comum). Whitelist de ~40 keywords técnicas. Resolve os 3 falso-negativos vistos no `one-colmeia-app`. Opção B (LLM pra reconciliação) fica como reserva pra casos mais complexos no futuro.

#### Backlog geral

- **Dunning automático**: alerta/e-mail de inadimplência quando uma cobrança
  vence sem recebimento (integrar ao motor de automações existente)
- **Anexar PDF ao e-mail**: recibo/fatura/relatório como anexo no digest
- **Histórico de recebimentos**: aba/drawer com o ledger `Recebimentos` filtrável
- **Exportação Excel** (.xlsx) de relatórios financeiros
- **Multi-moeda** (USD/EUR pra apps internacionais)
- **Modo offline / PWA**
- **Integração com Open Finance** (long shot)

---

## Princípios

1. **Vibe code first** — UI gostosa, microinterações, sem complicação.
2. **Sheet-based** — toda persistência no Google Sheets do próprio script; zero dependência externa de DB.
3. **Zero-knowledge onde fizer sentido** — Vault e dados sensíveis criptografados no cliente.
4. **GAS-friendly** — bundle ≤ 1.5MB, fatiado em chunks, ≤ 9 scripts inline.
5. **Acionável** — toda análise da Forja IA termina em prompt ou ação executável.
6. **Alerta sem tratativa é proibido** — todo alerta/aviso/badge visível pro usuário precisa ter um caminho claro de resolução (CTA, explicação ou descarte com nota). Princípio elevado em 2026-06-21 após observação direta do usuário: *"Eu não aceito alerta de nada sem tratativa"*.
