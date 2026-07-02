// Fonte ÚNICA das colunas compartilhadas entre o app principal (forja) e o
// discovery público (forja-public) — as abas da MESMA planilha que os dois
// projetos leem/escrevem. Os dois builds injetam este arquivo no topo do
// dist/Server.js (ver esbuild.mjs de cada projeto): renomear/adicionar coluna
// aqui atualiza os dois lados de uma vez. Antes eram cópias com um comentário
// "mantenha em sincronia" — e a sincronia já tinha quebrado (o Pessoas do app
// principal ganhou as colunas fiscais da v1.157.0 e o espelho público não).
//
// REGRA DE MIGRAÇÃO (mesma do SCHEMA principal): append-only. Colunas novas
// SEMPRE no fim — reordenar/remover desalinha os dados já gravados na planilha.

export const COLS_DISCOVERY_FORMS = [
  'id', 'pessoaId', 'titulo', 'segmento', 'perguntasJson', 'token', 'status', 'criadoEm', 'publicadoEm',
];

export const COLS_DISCOVERY_RESPOSTAS = [
  'id', 'formId', 'pessoaId', 'emailRespondente', 'nome', 'respostasJson', 'ferramentasJson',
  'querAmostra', 'agendaPref', 'score', 'scoreBreakdownJson', 'criadoEm',
];

export const COLS_PESSOAS_SCHEMA = [
  'id', 'nome', 'contato', 'papel', 'notas', 'email',
  // Pessoa de contato
  'nomeContato', 'cargo', 'telefone',
  // Empresa
  'empresa', 'cnpj', 'segmento', 'cidade', 'uf', 'site', 'instagram',
  // Negócio
  'faturamentoFaixa', 'funcionariosFaixa', 'tempoOperacaoAnos',
  // Financeiro/Comercial
  'ticketPrevisto', 'statusComercial', 'origemContato', 'proximaAcao',
  // Fiscal/endereço (v1.157.0) — exigidos por boleto registrado (pagador)
  'cpf', 'cep', 'logradouro', 'numeroEndereco', 'bairro',
];
