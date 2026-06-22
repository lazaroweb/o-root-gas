---
name: forja-design-system
description: Design system completo da Forja — paleta, tipografia, layout, espaçamento, componentes, padrões de UX. Use para entender a estética e replicar consistência em toda nova view ou componente.
---

# Forja Design System — Premium Minimal

> "Vibe code first" — UI gostosa, microinterações sutis, sem complicação. A Forja é um aplicativo pessoal premium: cada pixel respira, cada interação carrega intenção.

Esta skill é a **referência humana** do design system. Pra regras automáticas que o agente AI deve seguir, ver [`.cursor/rules/forja-design-system.mdc`](../../.cursor/rules/forja-design-system.mdc).

---

## Identidade visual

### Paleta (em `forja/src/theme.ts`)

```
Tokens semânticos:
├─ Fundo
│   ├─ appBg           — fundo geral da aplicação
│   ├─ sidebarBg       — fundo da sidebar (tom levemente diferente)
│   ├─ surface         — superfície principal (cards, panels)
│   └─ surfaceMuted    — alternativa (tags, badges sutis, hovers, empty states)
│
├─ Texto
│   ├─ text            — texto principal
│   ├─ textSecondary   — parágrafos, descrições
│   └─ textTertiary    — metadata, timestamps, captions
│
├─ Bordas
│   ├─ border          — borda padrão
│   └─ borderSoft      — divisórias sutis
│
├─ Sombras
│   ├─ shadow          — sombra padrão de card
│   └─ shadowSoft      — sombra mais leve
│
└─ Acentos (paleta semântica)
    ├─ sage     — verde-ok (concluído, sucesso, saudável)
    ├─ peach    — laranja-faísca (captura, atenção, novo)
    ├─ blue     — informação, navegação
    ├─ clay     — amarelo-mostarda (warning, melhoria)
    ├─ lavender — secundário, opcional
    └─ rose     — vermelho-aviso (erro, descarte)
```

**Regra de ouro**: NUNCA use hex hardcoded em componentes. Sempre `useTokens()` ou `useForja()` pra acessar a paleta. Hex SÓ em `theme.ts`.

### Tipografia

```typescript
// forja/src/theme.ts
export const FONTS = {
  display: '"Fraunces", Georgia, serif',  // headings, números grandes, identidade
  ui:      'Inter, -apple-system, sans-serif',  // texto comum
  mono:    '"JetBrains Mono", monospace',  // códigos, IDs, atalhos
};
```

**Quando usar cada uma**:
- **Display (Fraunces serif)** — Page title, card title, métricas grandes ("R$ 12,4k"), elementos que devem ter peso editorial
- **UI (Inter)** — TUDO de texto corrido, labels, parágrafos, botões
- **Mono (JetBrains)** — Códigos, hashes (`abc123`), atalhos de teclado (`Cmd+K`), IDs, valores que devem alinhar coluna

### Raios de borda

```
4px   — micro-elementos (tags pequenas)
8px   — inputs, botões padrão
12px  — cards pequenos
16px  — cards padrão
22px  — cards hero (dashboard)
999px — pills, tags arredondadas, indicadores circulares
```

### Sombras

```typescript
shadowSoft: '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)'
shadow:     '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)'
```

**Quando usar**: `shadowSoft` em card padrão. `shadow` em hover ou destaque.

---

## Layout (estrutura de view)

### Wrapper obrigatório

```tsx
<div className="forja-view" style={{
  padding: '36px 40px',           // espaço pra "respirar" da sidebar
  maxWidth: <X>,                  // largura máxima conforme densidade
  margin: '0 auto',               // centraliza
  animation: 'forjaFadeIn 0.3s ease',  // entrada suave
}}>
  <PageHeader title="..." subtitle="..." extra={...} />
  {/* conteúdo */}
</div>
```

### maxWidth por tipo de view

| Densidade | maxWidth | Quando |
|---|---|---|
| **Form focado** | 640 | Cadastros de 1 coluna, formulários longos |
| **Wizard** | 720 | Passos sequenciais |
| **Lista média** | 1040 | Cards 2-coluna, conteúdo principal |
| **Multi-coluna leve** | 1180 | 2-3 áreas lado a lado |
| **Bancada** | 1240 | Cards densos 3-4 colunas |
| **Dashboard** | 1280 | Hero + métricas |
| **Atelier** | 1440 | Grids muito densos com filtros |

**Por que isso importa**: largura excessiva causa fadiga de leitura (linhas longas demais). Largura curta demais desperdiça tela em monitor grande. O padrão acima foi calibrado.

---

## Espaçamento (escala fixa)

Use **somente** estes valores:

```
4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 64
```

**Padrões consolidados**:
- Padding interno de card: `14-20px`
- Gap entre tags/chips: `4-6px`
- Gap entre ações em uma linha: `6-8px`
- Gap entre cards: `12-18px`
- Gap entre seções de uma view: `24-32px`
- Margem após PageHeader: `20-28px`

---

## Componentes base (use sempre estes)

### Da Forja (`forja/src/components/ui.tsx`)

| Componente | Quando usar |
|---|---|
| `PageHeader` | Topo de toda view |
| `Panel` | Superfície de conteúdo (card grande) |
| `CopyBlock` | Bloco de texto/código com botão "copiar" |
| `Skeleton` | Loading skeleton (não use Spin pra conteúdo) |
| `RingProgress` | Anel de progresso (saúde, score 0-100) |
| `LiveDot` | Dot pulsante (status online/operando) |
| `EmptyArt` | Empty state visual rico (não use `<Empty>` cru se for tela principal) |
| `useCountUp` | Animação de número (de 0 até X em N ms) |

### Do Ant Design (já tematizados, use direto)

- `Button` (`type="primary" | "default" | "dashed" | "text"`, `danger`)
- `Tag` (sempre `bordered={false}` + `borderRadius: 999` pra virar pill)
- `Tooltip`, `Popconfirm` (destrutivo), `Modal` (curto), `Drawer` (rico)
- `Segmented` (filtros), `Dropdown` (menu ⋯)
- `Spin`, `Empty`, `Form`, `Input`, `Select`, `DatePicker`
- `Alert` (já tematizado globalmente em `theme.ts`)

---

## Padrões de UX (princípios duros da Forja)

### 1. Drawer > Modal pra edição rica

```tsx
// ❌ Modal pesado bloqueia tela inteira pra editar um item
<Modal width={680}>... 12 campos ...</Modal>

// ✅ Drawer lateral preserva contexto, scroll independente
<Drawer width={480} placement="right">... 12 campos ...</Drawer>
```

**Use Modal só pra**:
- Confirmação rápida (1 pergunta + Sim/Não)
- Captura express (1-2 campos, fechar e ir)
- Wizard de gênese (decisão estruturada)

**Use Drawer pra**:
- Edição de entidade complexa (>3 campos)
- Detalhes ricos com seções
- Triagem
- Histórico

### 2. Popconfirm pra ações destrutivas

```tsx
<Popconfirm
  title="Apagar permanentemente?"
  description="Isso não pode ser desfeito."
  onConfirm={...}
  okText="Apagar"
  cancelText="Cancelar"
  okButtonProps={{ danger: true }}
>
  <Button danger icon={<Trash2 />}>Apagar</Button>
</Popconfirm>
```

### 3. Princípio #6 — alerta sem tratativa proibido

**TODO** alerta/badge/Tag/banner visível pro usuário precisa ter:
- (a) ação primária acionável, OU
- (b) link/tooltip explicando "por que isso aparece e o que fazer", OU
- (c) botão pra dispensar com nota.

Sem CTA = alerta inútil = usuário fica perdido. Veja [`forja/ROADMAP.md`](../ROADMAP.md) princípio #6.

### 4. Empty states com instrução

```tsx
// ❌ Sem ação
<Empty description="Nada aqui" />

// ✅ Diz o que falta + como fazer
<Empty
  description="Inbox vazio. Capture algo no input acima ou aperte g+x em qualquer tela."
  image={Empty.PRESENTED_IMAGE_SIMPLE}
/>
```

### 5. Filtros com badges de contagem

```tsx
<Segmented
  options={[
    { label: labelComBadge('Ativas', 8), value: 'ativas' },
    { label: labelComBadge('Concluídas', 5), value: 'concluidas' },
  ]}
/>
```

Sem contagem o usuário não sabe se vale clicar.

### 6. Hover state em tudo clicável

```tsx
<div style={{
  ...
  transition: 'all 0.18s ease',
  cursor: 'pointer',
}}
onMouseEnter={(e) => {
  e.currentTarget.style.boxShadow = t.shadow;
  e.currentTarget.style.transform = 'translateY(-2px)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.boxShadow = t.shadowSoft;
  e.currentTarget.style.transform = 'translateY(0)';
}}
>
  {/* card content */}
</div>
```

Card sem hover = usuário não sabe se é clicável.

### 7. Timestamps relativos com tooltip absoluto

```tsx
<Tooltip title={new Date(iso).toLocaleString('pt-BR')}>
  <span>há 3d</span>
</Tooltip>
```

Relativo dá ritmo de leitura. Absoluto fica disponível quando precisa.

### 8. Agrupamento por tempo (em listas longas)

"Hoje", "Esta semana", "Este mês", "Antigas" — quebra a fadiga visual e dá referência temporal sem precisar olhar data em cada item.

---

## Animações

### Definidas globalmente

```css
@keyframes forjaFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Padrões de uso

- **Entrada de view**: `animation: 'forjaFadeIn 0.3s ease'`
- **Hover de card**: `transition: 'all 0.18s ease'`
- **Mudança de estado**: 200ms fade
- **Botão clicando**: já vem do antd, não estilize

**Não exagere**. Forja é minimalista. Animação demais cansa e fica brega.

---

## Ícones (Lucide React)

```tsx
import { Plus, Trash2, Edit3, Sparkles, ... } from 'lucide-react';
```

**Tamanhos padrão**:
- 11-12 → inline em texto (Tag com ícone)
- 13-14 → botão pequeno
- 16-18 → botão padrão
- 20-24 → destaque (hero, ícone principal)
- 28+ → empty state, ícone de página

**Stroke**: `strokeWidth={1.6}` pra ícones grandes (mais elegante). Default (2) pra pequenos.

❌ **NÃO** use `@ant-design/icons` (estilo conflita com Lucide).

---

## Anti-padrões (não faça)

| ❌ Errado | ✅ Certo |
|---|---|
| `<div>` cru envolvendo view | `<div className="forja-view" style={{ padding, maxWidth, ... }}>` |
| `<h1>` cru | `<PageHeader title="..." />` |
| `background: '#fff'` | `background: t.surface` |
| `padding: 35` | `padding: 32` ou `40` (escala) |
| Modal de 680px pra editar 8 campos | Drawer de 480px |
| `<Alert message="Erro" />` sem botão | Alert + botão "tentar novamente" ou "saiba mais" |
| `<Empty description="Vazio" />` | `<Empty description="Vazio. Faça X." />` |
| Tag colorida com hex fixo | Tag com `background: ${t.accents.X}1f, color: t.accents.X` |
| Card sem hover state | Card com `transition` + `boxShadow` ao hover |
| Lista de 50 itens sem agrupamento | Lista agrupada por tempo/categoria |

---

## Checklist final (antes de comitar QUALQUER view nova)

- [ ] Tem `<div className="forja-view" style={{ padding, maxWidth, margin, animation }}>` no topo?
- [ ] Usa `<PageHeader>` (não `<h1>` cru)?
- [ ] Cores via `useTokens()`, zero hex hardcoded?
- [ ] Espaçamento na escala fixa (4/8/12/16/20/24/28/32)?
- [ ] Tipografia: `FONTS.display` em headings, `FONTS.ui` em texto, `FONTS.mono` em códigos?
- [ ] Empty states com instrução do que fazer?
- [ ] Edição rica usa Drawer (não Modal pesado)?
- [ ] Ações destrutivas com Popconfirm?
- [ ] Cards têm hover state?
- [ ] Filtros têm badges de contagem?
- [ ] Animação de entrada `forjaFadeIn 0.3s ease`?
- [ ] Funciona nos 2 temas (claro + noturno)?
- [ ] Todo alerta/Tag tem CTA (princípio #6)?

Se "não" pra qualquer, **corrige antes de comitar**.

---

## Inspirações de UX (não copie, internalize)

- **Notion** — Tipografia generosa, hierarquia clara, comandos slash
- **Linear** — Hotkeys, atalhos de teclado, motion sutil
- **Things 3** — Inbox + triagem + foco, swipe pra concluir, agrupamento por tempo
- **Superhuman** — Modo batch (uma coisa por vez, decide rápido, próximo)
- **Stripe** — Documentação visual, código + preview lado a lado
- **Vercel** — Cards com hover delicado, escala de cinza rica

A Forja roubou um pouco de cada. Continue na mesma linha.
