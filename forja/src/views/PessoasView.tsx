import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, Tag, Spin, Collapse, App as AntApp, Tooltip } from 'antd';
import { Plus, Pencil, FileText, User, Building2, BarChart3, Handshake, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import ClienteSnapshotDrawer from '../components/ClienteSnapshotDrawer';
import type { Pessoa, ServerResponse } from '../types';

const PAPEL_OPTIONS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'parceiro', label: 'Parceiro' },
];

const FATURAMENTO_OPTIONS = [
  { value: 'ate-50k', label: 'Até R$ 50 mil/mês' },
  { value: '50k-200k', label: 'R$ 50 mil – R$ 200 mil/mês' },
  { value: '200k-1m', label: 'R$ 200 mil – R$ 1 mi/mês' },
  { value: '1m-5m', label: 'R$ 1 mi – R$ 5 mi/mês' },
  { value: 'acima-5m', label: 'Acima de R$ 5 mi/mês' },
  { value: 'nao-informado', label: 'Não informado' },
];

const FUNCIONARIOS_OPTIONS = [
  { value: 'so-eu', label: 'Só eu' },
  { value: '2-5', label: '2 a 5' },
  { value: '6-20', label: '6 a 20' },
  { value: '21-50', label: '21 a 50' },
  { value: '51-200', label: '51 a 200' },
  { value: 'mais-200', label: 'Mais de 200' },
];

export const STATUS_COMERCIAL_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'em-conversa', label: 'Em conversa' },
  { value: 'proposta', label: 'Proposta enviada' },
  { value: 'negociacao', label: 'Em negociação' },
  { value: 'cliente-ativo', label: 'Cliente ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'perdido', label: 'Perdido' },
];

// Estágios ATIVOS do pipeline (com probabilidade de fechamento sales-funnel).
// "cliente-ativo" sai do funil (já fechou). "pausado"/"perdido" também.
export const PIPELINE_ESTAGIOS: Array<{ value: string; label: string; prob: number }> = [
  { value: 'lead', label: 'Lead', prob: 0.10 },
  { value: 'em-conversa', label: 'Em conversa', prob: 0.25 },
  { value: 'proposta', label: 'Proposta enviada', prob: 0.50 },
  { value: 'negociacao', label: 'Em negociação', prob: 0.75 },
];

export const ORIGEM_LABEL_MAP: Record<string, string> = {
  indicacao: 'Indicação',
  evento: 'Evento',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  site: 'Site',
  outbound: 'Outbound',
  'cliente-antigo': 'Cliente antigo',
  outro: 'Outro',
};

const ORIGEM_OPTIONS = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'evento', label: 'Evento / palestra' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'site', label: 'Site / busca' },
  { value: 'outbound', label: 'Prospecção ativa' },
  { value: 'outro', label: 'Outro' },
];

// 27 unidades federativas do Brasil (26 estados + DF) em ordem alfabética
const UF_OPTIONS = [
  { value: 'AC', label: 'AC · Acre' },
  { value: 'AL', label: 'AL · Alagoas' },
  { value: 'AP', label: 'AP · Amapá' },
  { value: 'AM', label: 'AM · Amazonas' },
  { value: 'BA', label: 'BA · Bahia' },
  { value: 'CE', label: 'CE · Ceará' },
  { value: 'DF', label: 'DF · Distrito Federal' },
  { value: 'ES', label: 'ES · Espírito Santo' },
  { value: 'GO', label: 'GO · Goiás' },
  { value: 'MA', label: 'MA · Maranhão' },
  { value: 'MT', label: 'MT · Mato Grosso' },
  { value: 'MS', label: 'MS · Mato Grosso do Sul' },
  { value: 'MG', label: 'MG · Minas Gerais' },
  { value: 'PA', label: 'PA · Pará' },
  { value: 'PB', label: 'PB · Paraíba' },
  { value: 'PR', label: 'PR · Paraná' },
  { value: 'PE', label: 'PE · Pernambuco' },
  { value: 'PI', label: 'PI · Piauí' },
  { value: 'RJ', label: 'RJ · Rio de Janeiro' },
  { value: 'RN', label: 'RN · Rio Grande do Norte' },
  { value: 'RS', label: 'RS · Rio Grande do Sul' },
  { value: 'RO', label: 'RO · Rondônia' },
  { value: 'RR', label: 'RR · Roraima' },
  { value: 'SC', label: 'SC · Santa Catarina' },
  { value: 'SP', label: 'SP · São Paulo' },
  { value: 'SE', label: 'SE · Sergipe' },
  { value: 'TO', label: 'TO · Tocantins' },
];

const MOCK_PESSOAS: Pessoa[] = [
  { id: 'p1', nome: 'AC Logística', contato: 'joao@example.com', papel: 'cliente', notas: '', nomeContato: 'João Silva', empresa: 'AC Logística' },
  { id: 'p2', nome: 'Ana Rodrigues', contato: '@ana_dev', papel: 'parceiro', notas: 'Dev frontend, parceira em projetos' },
];

export default function PessoasView({ embedded = false }: { embedded?: boolean } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snapshotPessoa, setSnapshotPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [form] = Form.useForm<Pessoa>();

  const loadPessoas = () => {
    setLoading(true);
    callServer<ServerResponse<Pessoa[]>>('getPessoas')
      .then(res => { if (res.ok && res.data) setPessoas(res.data); })
      .catch(() => setPessoas(MOCK_PESSOAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPessoas(); }, []);

  const handleOpen = (pessoa?: Pessoa) => {
    if (pessoa) { setEditingId(pessoa.id); form.setFieldsValue(pessoa); }
    else { setEditingId(null); form.resetFields(); }
    setModalOpen(true);
  };

  const handleSave = async (values: Pessoa) => {
    setSaving(true);
    try {
      // Mantém o `nome` (legado) sincronizado pra não quebrar telas existentes:
      // se o usuário preencheu empresa, usa empresa; senão usa nomeContato; senão mantém.
      const nomeDisplay = values.empresa?.trim() || values.nomeContato?.trim() || values.nome || '';
      const payload = { ...values, nome: nomeDisplay };
      if (editingId) await callServer('updatePessoa', editingId, payload);
      else await callServer('createPessoa', payload);
      message.success(editingId ? 'Cliente atualizado' : 'Cliente adicionado');
      setModalOpen(false);
      loadPessoas();
    } catch { message.error('Erro ao salvar cliente'); }
    finally { setSaving(false); }
  };

  const displayEmpresa = (p: Pessoa) => p.empresa || p.nome || '—';
  const displayContato = (p: Pessoa) => p.nomeContato || (p.empresa ? '' : '');

  const columns = [
    {
      title: 'Empresa / Cliente', dataIndex: 'empresa', key: 'empresa',
      render: (_: unknown, record: Pessoa) => (
        <button
          type="button"
          onClick={() => setSnapshotPessoa({ id: record.id, nome: displayEmpresa(record) })}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            textAlign: 'left', fontFamily: 'inherit', display: 'block',
          }}
          onMouseEnter={(e) => { (e.currentTarget.firstChild as HTMLElement).style.color = t.accents.blue; }}
          onMouseLeave={(e) => { (e.currentTarget.firstChild as HTMLElement).style.color = t.text; }}
          title="Abrir ficha do cliente (snapshot + discovery)"
        >
          <div style={{ color: t.text, fontWeight: 600, fontSize: 14, lineHeight: 1.2, transition: 'color 0.15s' }}>
            {displayEmpresa(record)}
          </div>
          {displayContato(record) && (
            <div style={{ color: t.textTertiary, fontSize: 12, marginTop: 3, fontWeight: 400 }}>
              {displayContato(record)}{record.cargo ? ` · ${record.cargo}` : ''}
            </div>
          )}
        </button>
      ),
    },
    {
      title: 'Contato', key: 'contato_info',
      render: (_: unknown, p: Pessoa) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: FONTS.mono, fontSize: 12, color: t.textSecondary }}>
          {p.email && <span>{p.email}</span>}
          {p.telefone && <span>{p.telefone}</span>}
          {!p.email && !p.telefone && p.contato && <span>{p.contato}</span>}
        </div>
      ),
    },
    {
      title: 'Segmento', dataIndex: 'segmento', key: 'segmento',
      render: (v: string) => v ? <Tag bordered={false} style={{ borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{v}</Tag> : null,
    },
    {
      title: 'Status', dataIndex: 'statusComercial', key: 'statusComercial',
      render: (v: string, p: Pessoa) => {
        const opt = STATUS_COMERCIAL_OPTIONS.find((o) => o.value === v);
        if (!opt) {
          const c = p.papel === 'cliente' ? t.accents.blue : t.accents.sage;
          return <Tag bordered={false} style={{ background: `${c}1f`, color: c, borderRadius: 999, textTransform: 'capitalize' }}>{p.papel}</Tag>;
        }
        const cor = v === 'cliente-ativo' ? t.accents.sage : v === 'perdido' ? t.accents.rose : v === 'pausado' ? t.textTertiary : t.accents.blue;
        return <Tag bordered={false} style={{ borderRadius: 999, background: `${cor}1f`, color: cor }}>{opt.label}</Tag>;
      },
    },
    {
      title: 'Saúde', dataIndex: 'saude', key: 'saude',
      filters: [
        { text: 'Em dia', value: 'em_dia' },
        { text: 'Atenção', value: 'atencao' },
        { text: 'Inadimplente', value: 'inadimplente' },
        { text: 'Sem histórico', value: 'sem_historico' },
      ],
      onFilter: (val: React.Key | boolean, p: Pessoa) => (p.saude || 'sem_historico') === val,
      sorter: (a: Pessoa, b: Pessoa) => {
        const ordem: Record<string, number> = { inadimplente: 0, atencao: 1, em_dia: 2, sem_historico: 3 };
        return (ordem[a.saude || 'sem_historico'] ?? 3) - (ordem[b.saude || 'sem_historico'] ?? 3);
      },
      render: (_: unknown, p: Pessoa) => <SaudeBadge pessoa={p} />,
    },
    {
      title: '', key: 'actions', width: 96,
      render: (_: unknown, record: Pessoa) => (
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Abrir ficha — snapshot + Discovery (roteiro, formulário, respostas)">
            <Button type="text" size="small" icon={<FileText size={15} />} onClick={() => setSnapshotPessoa({ id: record.id, nome: displayEmpresa(record) })} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => handleOpen(record)} />
          </Tooltip>
        </div>
      ),
    },
  ];

  const snapshotDrawer = (
    <ClienteSnapshotDrawer
      pessoaId={snapshotPessoa?.id || null}
      pessoaNome={snapshotPessoa?.nome}
      onClose={() => setSnapshotPessoa(null)}
    />
  );

  const sectionHeader = (icon: React.ReactNode, titulo: string, hint?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: t.accents.blue, display: 'inline-flex' }}>{icon}</span>
      <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 14, color: t.text }}>{titulo}</span>
      {hint && <span style={{ fontSize: 11.5, color: t.textTertiary, fontWeight: 400 }}>· {hint}</span>}
    </div>
  );

  const modal = (
    <Modal
      title={editingId ? 'Editar cliente' : 'Novo cliente'}
      open={modalOpen}
      onCancel={() => setModalOpen(false)}
      onOk={() => form.submit()}
      okText={editingId ? 'Salvar' : 'Criar'}
      width={720}
      confirmLoading={saving}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ papel: 'cliente' }}>
        <Collapse
          defaultActiveKey={['pessoa', 'empresa']}
          ghost
          style={{ background: 'transparent' }}
          items={[
            {
              key: 'pessoa',
              label: sectionHeader(<User size={16} />, 'Pessoa de contato', 'quem fala com você'),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item name="nomeContato" label="Nome completo" rules={[{ required: true, message: 'Informe o nome do contato' }]}>
                    <Input placeholder="Ex.: Simara da Silva" />
                  </Form.Item>
                  <Form.Item name="cargo" label="Cargo">
                    <Input placeholder="Ex.: Sócia · Diretora · CEO" />
                  </Form.Item>
                  <Form.Item name="email" label="E-mail">
                    <Input placeholder="contato@example.com" type="email" />
                  </Form.Item>
                  <Form.Item name="telefone" label="Telefone / WhatsApp">
                    <Input placeholder="(11) 9 8888-0000" />
                  </Form.Item>
                  <Form.Item name="papel" label="Papel">
                    <Select options={PAPEL_OPTIONS} />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'empresa',
              label: sectionHeader(<Building2 size={16} />, 'Empresa', 'a marca / negócio'),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <Form.Item name="empresa" label="Nome da empresa">
                    <Input placeholder="Ex.: AC Contabilidade" />
                  </Form.Item>
                  <Form.Item name="cnpj" label="CNPJ">
                    <Input placeholder="00.000.000/0001-00" />
                  </Form.Item>
                  <Form.Item name="segmento" label="Segmento">
                    <Input placeholder="Ex.: Contabilidade, Odontologia, Logística" />
                  </Form.Item>
                  <Form.Item name="cidade" label="Cidade">
                    <Input placeholder="São Paulo" />
                  </Form.Item>
                  <Form.Item name="uf" label="UF">
                    <Select
                      allowClear
                      showSearch
                      placeholder="Selecione"
                      options={UF_OPTIONS}
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                  <Form.Item name="site" label="Site">
                    <Input placeholder="https://" />
                  </Form.Item>
                  <Form.Item name="instagram" label="Instagram">
                    <Input placeholder="@perfil" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'negocio',
              label: sectionHeader(<BarChart3 size={16} />, 'Negócio', 'pra dimensionar o app'),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Form.Item name="faturamentoFaixa" label="Faturamento mensal">
                    <Select allowClear options={FATURAMENTO_OPTIONS} placeholder="Faixa" />
                  </Form.Item>
                  <Form.Item name="funcionariosFaixa" label="Nº de funcionários">
                    <Select allowClear options={FUNCIONARIOS_OPTIONS} placeholder="Faixa" />
                  </Form.Item>
                  <Form.Item name="tempoOperacaoAnos" label="Tempo de operação (anos)">
                    <Input placeholder="Ex.: 8" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'comercial',
              label: sectionHeader(<Handshake size={16} />, 'Financeiro / Comercial', 'jornada com a Forja'),
              children: (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <Form.Item name="ticketPrevisto" label="Ticket previsto (R$)">
                      <Input placeholder="Ex.: 1500" />
                    </Form.Item>
                    <Form.Item name="statusComercial" label="Status comercial">
                      <Select allowClear options={STATUS_COMERCIAL_OPTIONS} placeholder="Selecione" />
                    </Form.Item>
                    <Form.Item name="origemContato" label="Origem do contato">
                      <Select allowClear options={ORIGEM_OPTIONS} placeholder="Selecione" />
                    </Form.Item>
                  </div>
                  <Form.Item name="proximaAcao" label="Próxima ação">
                    <Input placeholder="Ex.: Enviar amostra até 25/06" />
                  </Form.Item>
                  <Form.Item name="notas" label="Notas livres">
                    <Input.TextArea rows={3} placeholder="Qualquer outra informação relevante…" />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );

  const tableProps = {
    columns,
    dataSource: pessoas,
    rowKey: 'id',
    pagination: { pageSize: 10 },
    scroll: { x: 'max-content' as const },
    locale: { emptyText: 'Nenhum cliente cadastrado' },
    onRow: (record: Pessoa) => ({
      onClick: (ev: React.MouseEvent) => {
        const tag = (ev.target as HTMLElement).closest('button, a, .ant-dropdown-trigger');
        if (tag) return;
        setSnapshotPessoa({ id: record.id, nome: displayEmpresa(record) });
      },
      style: { cursor: 'pointer' },
    }),
  };

  if (embedded) {
    return (
      <div style={{ animation: 'forjaFadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Novo cliente</Button>
        </div>
        {loading
          ? <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
          : <Table {...tableProps} />}
        {modal}
        {snapshotDrawer}
      </div>
    );
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1000, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Clientes"
        subtitle="Seu mini-CRM: ficha completa do cliente — pessoa, empresa, negócio e jornada comercial."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Novo cliente</Button>}
      />

      <Table {...tableProps} />

      {modal}
      {snapshotDrawer}
    </div>
  );
}

// Badge de saúde financeira do cliente — derivada das receitas ativas com
// proximaCobranca vencida. Verde = em dia, amarelo = ≤15d atraso, vermelho =
// >15d ou 3+ pendentes, cinza = sem histórico. Calculado no backend.
function SaudeBadge({ pessoa }: { pessoa: Pessoa }): React.ReactElement {
  const t = useTokens();
  const saude = pessoa.saude || 'sem_historico';

  const variant: Record<typeof saude, { cor: string; bg: string; label: string; icon: React.ReactNode; tooltip: string }> = {
    em_dia: {
      cor: t.accents.sage, bg: `${t.accents.sage}1f`,
      label: 'Em dia', icon: <CheckCircle2 size={11} />,
      tooltip: 'Sem cobranças atrasadas.',
    },
    atencao: {
      cor: t.accents.peach, bg: `${t.accents.peach}1f`,
      label: `Atenção${pessoa.pendenciasQtd ? ` (${pessoa.pendenciasQtd})` : ''}`,
      icon: <Clock size={11} />,
      tooltip: `${pessoa.pendenciasQtd || 0} cobrança(s) atrasada(s), no máximo 15 dias.`,
    },
    inadimplente: {
      cor: t.accents.rose, bg: `${t.accents.rose}1f`,
      label: `Inadimplente${pessoa.pendenciasQtd ? ` (${pessoa.pendenciasQtd})` : ''}`,
      icon: <AlertTriangle size={11} />,
      tooltip: `${pessoa.pendenciasQtd || 0} cobrança(s) atrasada(s); pelo menos uma com mais de 15 dias.`,
    },
    sem_historico: {
      cor: t.textTertiary, bg: t.surfaceMuted,
      label: 'Sem histórico', icon: null,
      tooltip: 'Cliente sem receitas cadastradas.',
    },
  };
  const v = variant[saude];

  return (
    <Tooltip title={v.tooltip}>
      <Tag
        bordered={false}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          borderRadius: 999,
          background: v.bg,
          color: v.cor,
          paddingLeft: v.icon ? 6 : 8,
          fontWeight: 600,
          fontSize: 11,
          lineHeight: '18px',
        }}
      >
        {v.icon}
        {v.label}
      </Tag>
    </Tooltip>
  );
}
