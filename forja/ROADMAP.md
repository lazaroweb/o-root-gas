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

---

## Fila

### Próximos candidatos
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
