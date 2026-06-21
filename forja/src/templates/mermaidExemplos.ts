// ─── Galeria de exemplos Mermaid ─────────────────────────────────────────────
// 10 templates hardcoded (5 genéricos + 5 sobre Forja) usados como starter pack
// no Estúdio de Diagramas. Quem nunca usou Mermaid pode escolher um exemplo,
// ver renderizado na hora (sem IA), e usar como base pra editar/regerar.
//
// Por que hardcoded e não no banco?
//   - São 10 itens curtos, mudam pouco — não vale o overhead de SheetDB
//   - Carrega instantâneo (zero round-trip server)
//   - Versionado no git junto com o código
// Se virar pedido editar pelo user no futuro, migra-se pra SheetDB.

export type TipoMermaid =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'erDiagram'
  | 'classDiagram'
  | 'mindmap';

export type SecaoExemplo = 'generico' | 'forja';

export interface ExemploMermaid {
  id: string;
  titulo: string;
  tipo: TipoMermaid;
  secao: SecaoExemplo;
  descricao: string; // 1 linha curta — aparece embaixo do card
  mermaid: string;   // código pronto pra renderizar
}

// ─── Genéricos: padrões universais ──────────────────────────────────────────
// Casos clássicos que servem pra qualquer app — bom pra entender o tipo.

const GENERICOS: ExemploMermaid[] = [
  {
    id: 'gen-flowchart-checkout',
    titulo: 'Checkout de pedido',
    tipo: 'flowchart',
    secao: 'generico',
    descricao: 'Jornada de compra com decisão de pagamento e tratamento de erro.',
    mermaid: `flowchart TD
    A[Cliente abre carrinho] --> B{Itens validos?}
    B -->|Nao| C[Mostrar erro de estoque]
    B -->|Sim| D[Escolher pagamento]
    D --> E{Aprovado?}
    E -->|Sim| F[Confirmar pedido]
    E -->|Nao| G[Tentar novamente]
    F --> H[Enviar email]
    H --> I[Atualizar status]
    G --> D`,
  },
  {
    id: 'gen-sequence-oauth',
    titulo: 'Login com OAuth',
    tipo: 'sequenceDiagram',
    secao: 'generico',
    descricao: 'Fluxo padrão de autenticação delegada (user → app → provedor).',
    mermaid: `sequenceDiagram
    participant U as Usuario
    participant A as App
    participant P as Provedor OAuth
    participant D as Banco
    U->>A: Clica em Entrar
    A->>P: Redireciona pra login
    U->>P: Digita credenciais
    P->>A: Retorna codigo de autorizacao
    A->>P: Troca codigo por token
    P-->>A: Retorna access_token
    A->>D: Busca/cria usuario
    D-->>A: Dados do usuario
    A-->>U: Sessao iniciada`,
  },
  {
    id: 'gen-er-crm',
    titulo: 'CRM simples',
    tipo: 'erDiagram',
    secao: 'generico',
    descricao: 'Entidades base de um CRM: Cliente, Pedido, Produto.',
    mermaid: `erDiagram
    CLIENTE ||--o{ PEDIDO : faz
    PEDIDO ||--|{ ITEM_PEDIDO : contem
    PRODUTO ||--o{ ITEM_PEDIDO : referenciado_em
    CLIENTE {
        string id PK
        string nome
        string email
        string telefone
    }
    PEDIDO {
        string id PK
        string clienteId FK
        date data
        string status
        float total
    }
    PRODUTO {
        string id PK
        string nome
        float preco
        int estoque
    }
    ITEM_PEDIDO {
        string pedidoId FK
        string produtoId FK
        int quantidade
        float precoUnitario
    }`,
  },
  {
    id: 'gen-class-ecommerce',
    titulo: 'E-commerce básico',
    tipo: 'classDiagram',
    secao: 'generico',
    descricao: 'Classes principais de um marketplace: Produto, Carrinho, Pagamento.',
    mermaid: `classDiagram
    class Produto {
        +string id
        +string nome
        +float preco
        +int estoque
        +reduzirEstoque(qtd)
    }
    class Carrinho {
        +string clienteId
        +List~Item~ itens
        +adicionar(produto, qtd)
        +remover(produtoId)
        +calcularTotal() float
    }
    class Item {
        +Produto produto
        +int quantidade
        +subtotal() float
    }
    class Pagamento {
        +string metodo
        +float valor
        +string status
        +processar() bool
    }
    Carrinho "1" *-- "many" Item
    Item "many" --> "1" Produto
    Carrinho --> Pagamento : gera`,
  },
  {
    id: 'gen-mindmap-projeto',
    titulo: 'Planejamento de projeto',
    tipo: 'mindmap',
    secao: 'generico',
    descricao: 'Mapa de áreas e tarefas de um projeto de software novo.',
    mermaid: `mindmap
  root((Novo projeto))
    Discovery
      Entrevistas
      Concorrentes
      Personas
    Design
      Wireframes
      Prototipo
      Design system
    Tech
      Stack
      Infra
      CI/CD
    Lancamento
      Beta privado
      Marketing
      Suporte
    Pos-lancamento
      Metricas
      Iteracao
      Roadmap`,
  },
];

// ─── Sobre Forja: contextos reais do app ────────────────────────────────────
// Usa as próprias entidades/fluxos do Forja como exemplo. Combina com a vibe
// dogfooding e serve de referência integrada pra quem estuda o app.

const FORJA_EXEMPLOS: ExemploMermaid[] = [
  {
    id: 'forja-flowchart-jornada',
    titulo: 'Jornada da Ideia ao Produto',
    tipo: 'flowchart',
    secao: 'forja',
    descricao: 'Faísca → Forja → Têmpera → Prateleira: o ciclo de vida no app.',
    mermaid: `flowchart LR
    A[Faisca: ideia capturada] --> B[Blueprint pela IA]
    B --> C{Aprovado?}
    C -->|Nao| D[Refinar com chat IA]
    D --> B
    C -->|Sim| E[Forja: dev em andamento]
    E --> G{Health score >= 80?}
    G -->|Nao| H[Auditoria IA]
    H --> E
    G -->|Sim| F[Tempera: no ar / producao]
    F --> J[Monitoramento + alertas]
    J --> I[Prateleira: aposentado/pausa]`,
  },
  {
    id: 'forja-sequence-callserver',
    titulo: 'Chamada do Frontend ao SheetDB',
    tipo: 'sequenceDiagram',
    secao: 'forja',
    descricao: 'Como uma ação na UI vira leitura/escrita na planilha Google.',
    mermaid: `sequenceDiagram
    participant U as Usuario
    participant F as Frontend React
    participant G as google.script.run
    participant S as Server.gs (GAS)
    participant DB as SheetDB
    U->>F: Clica Salvar Lancamento
    F->>G: callServer('salvarLancamento', dados)
    G->>S: invoca funcao server-side
    S->>DB: getOrCreateSheet('FinPessoalLancamentos')
    DB-->>S: ref da sheet
    S->>DB: appendRow(dados)
    DB-->>S: row salva
    S-->>G: { ok: true, data }
    G-->>F: Promise resolve
    F-->>U: Notificacao de sucesso`,
  },
  {
    id: 'forja-er-entidades',
    titulo: 'Entidades principais do Forja',
    tipo: 'erDiagram',
    secao: 'forja',
    descricao: 'Como Cliente, Ideia, Sistema, Decisão e Diagrama se relacionam.',
    mermaid: `erDiagram
    CLIENTE ||--o{ SISTEMA : possui
    CLIENTE ||--o{ IDEIA : registra
    IDEIA ||--o| SISTEMA : vira
    SISTEMA ||--o{ DECISAO : tem
    SISTEMA ||--o{ RISCO : tem
    SISTEMA ||--o{ OPORTUNIDADE : tem
    SISTEMA ||--o{ DIAGRAMA : possui
    SISTEMA ||--o{ BLUEPRINT : possui
    SISTEMA ||--o{ CUSTO : acumula
    CLIENTE {
        string id PK
        string nome
        string segmento
    }
    IDEIA {
        string id PK
        string titulo
        string clienteId FK
        string estado
    }
    SISTEMA {
        string id PK
        string nome
        string clienteId FK
        string ideiaId FK
        string estado
        int healthScore
    }
    DECISAO {
        string id PK
        string sistemaId FK
        string titulo
        string descricao
    }`,
  },
  {
    id: 'forja-class-sistema',
    titulo: 'Sistema como agregado',
    tipo: 'classDiagram',
    secao: 'forja',
    descricao: 'Sistema central do Forja e seus relacionamentos modelados.',
    mermaid: `classDiagram
    class Sistema {
        +string id
        +string nome
        +string estado
        +int healthScore
        +string clienteId
        +calcularSaude() int
    }
    class Cliente {
        +string id
        +string nome
        +string segmento
    }
    class Decisao {
        +string id
        +string titulo
        +string descricao
        +date data
    }
    class Custo {
        +string id
        +float valor
        +string moeda
        +string categoria
    }
    class Auditoria {
        +string id
        +date data
        +string modelo
        +List~Finding~ findings
    }
    Cliente "1" --> "many" Sistema : possui
    Sistema "1" --> "many" Decisao : registra
    Sistema "1" --> "many" Custo : acumula
    Sistema "1" --> "many" Auditoria : sofreu`,
  },
  {
    id: 'forja-mindmap-modulos',
    titulo: 'Módulos do Forja',
    tipo: 'mindmap',
    secao: 'forja',
    descricao: 'Arquitetura funcional: todos os módulos do app e suas seções.',
    mermaid: `mindmap
  root((Forja))
    Dashboard
      Saude operacional
      Atividade tecnica
      Conexoes
    Clientes
      Cadastro
      Snapshots
    Ideias
      Captura
      Discovery
      Entrevistas
    Sistemas
      Passaporte
      Backlog Kanban
      Health Score
    Operacoes
      Status APIs
      GitHub integration
      Alertas
    Financeiro
      Empresa
      Pessoal
      Categorias
    Forja IA
      Assistente
      Conselho
      Blueprint
      Diagramas
    Atelier
      Codex
      Receituario
      Habilidades
      Hospedagem
      Vault
    Relatorios
      Geral
      Exportacoes`,
  },
];

// ─── Catálogo exportado ─────────────────────────────────────────────────────

export const EXEMPLOS_MERMAID: ExemploMermaid[] = [...GENERICOS, ...FORJA_EXEMPLOS];

// Helpers utilitários — usados pelo modal pra filtrar/contar.
export function exemplosPorSecao(secao: SecaoExemplo): ExemploMermaid[] {
  return EXEMPLOS_MERMAID.filter((e) => e.secao === secao);
}

export function exemploPorId(id: string): ExemploMermaid | undefined {
  return EXEMPLOS_MERMAID.find((e) => e.id === id);
}

// Label em PT-BR pra cada tipo Mermaid — reusa em badges/labels do modal.
export const ROTULO_TIPO: Record<TipoMermaid, string> = {
  flowchart: 'Fluxograma',
  sequenceDiagram: 'Sequência',
  erDiagram: 'Entidades (ER)',
  classDiagram: 'Classes',
  mindmap: 'Mapa mental',
};
