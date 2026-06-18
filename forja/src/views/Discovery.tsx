import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Form, Spin, Empty, Tag, Popconfirm, App as AntApp } from 'antd';
import { Sparkles, Plus, Wand2, Trash2, Lightbulb, MessageSquareText, FileText } from 'lucide-react';
import { Panel, CopyBlock, copyText } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Pessoa, Entrevista, AnaliseEntrevista, ServerResponse } from '../types';

const TIPO_OPTIONS = [
  { value: 'Discovery', label: 'Discovery' },
  { value: 'Validação', label: 'Validação' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Feedback', label: 'Feedback' },
];

function Lista({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }): React.ReactElement | null {
  const t = useTokens();
  if (!itens || !itens.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: cor, marginBottom: 6 }}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 13.5, lineHeight: 1.7 }}>
        {itens.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export default function Discovery(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);

  // perguntas de discovery
  const [segmento, setSegmento] = useState('');
  const [gerandoPerguntas, setGerandoPerguntas] = useState(false);
  const [blocos, setBlocos] = useState<Array<{ tema?: string; perguntas?: string[] }>>([]);

  // registrar entrevista
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  // análise inline
  const [analisandoId, setAnalisandoId] = useState<string | null>(null);
  const [analises, setAnalises] = useState<Record<string, AnaliseEntrevista>>({});
  const [criandoIdeiaId, setCriandoIdeiaId] = useState<string | null>(null);

  const carregar = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Pessoa[]>>('getPessoas').catch(() => ({ ok: false } as ServerResponse<Pessoa[]>)),
      callServer<ServerResponse<Entrevista[]>>('getEntrevistas').catch(() => ({ ok: false } as ServerResponse<Entrevista[]>)),
    ]).then(([rp, re]) => {
      if (rp.ok && rp.data) setPessoas(rp.data);
      if (re.ok && re.data) {
        setEntrevistas(re.data);
        const pre: Record<string, AnaliseEntrevista> = {};
        re.data.forEach((e) => { if (e.analise) pre[e.id] = e.analise; });
        setAnalises(pre);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const nomeCliente = (id: string) => pessoas.find((p) => p.id === id)?.nome || '—';

  const gerarPerguntas = async () => {
    setGerandoPerguntas(true);
    setBlocos([]);
    try {
      const res = await callServer<ServerResponse<{ blocos: Array<{ tema?: string; perguntas?: string[] }> }>>(
        'gerarPerguntasDiscovery', { segmento },
      );
      if (res.ok && res.data) setBlocos(res.data.blocos || []);
      else message.error(res.error || 'Falha ao gerar perguntas');
    } catch { message.error('Erro ao gerar perguntas'); }
    finally { setGerandoPerguntas(false); }
  };

  const copiarRoteiro = async () => {
    const txt = blocos.map((b) => `## ${b.tema || ''}\n` + (b.perguntas || []).map((p) => `- ${p}`).join('\n')).join('\n\n');
    const ok = await copyText(txt);
    message[ok ? 'success' : 'error'](ok ? 'Roteiro copiado' : 'Não foi possível copiar');
  };

  const salvarEntrevista = async (values: { pessoaId: string; data: string; tipo: string; transcricao: string }) => {
    setSalvando(true);
    try {
      const res = await callServer<ServerResponse<Entrevista>>('createEntrevista', values);
      if (res.ok) { message.success('Entrevista registrada'); form.resetFields(); carregar(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar entrevista'); }
    finally { setSalvando(false); }
  };

  const analisar = async (e: Entrevista) => {
    setAnalisandoId(e.id);
    try {
      const res = await callServer<ServerResponse<AnaliseEntrevista>>('analisarEntrevista', { id: e.id });
      if (res.ok && res.data) { setAnalises((prev) => ({ ...prev, [e.id]: res.data as AnaliseEntrevista })); message.success('Análise concluída'); }
      else message.error(res.error || 'Falha na análise');
    } catch { message.error('Erro ao analisar'); }
    finally { setAnalisandoId(null); }
  };

  const gerarIdeia = async (e: Entrevista) => {
    setCriandoIdeiaId(e.id);
    try {
      const res = await callServer<ServerResponse<unknown>>('criarIdeiaDeEntrevista', { id: e.id });
      if (res.ok) message.success('Ideia criada no banco de ideias');
      else message.error(res.error || 'Falha ao criar ideia');
    } catch { message.error('Erro ao criar ideia'); }
    finally { setCriandoIdeiaId(null); }
  };

  const remover = async (id: string) => {
    try {
      const res = await callServer<ServerResponse<unknown>>('deleteEntrevista', id);
      if (res.ok) { message.success('Entrevista removida'); carregar(); }
      else message.error(res.error || 'Erro ao remover');
    } catch { message.error('Erro ao remover'); }
  };

  const clienteOptions = pessoas.map((p) => ({ value: p.id, label: p.nome + (p.papel ? ` · ${p.papel}` : '') }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, animation: 'forjaFadeIn 0.3s ease' }}>
      {/* Roteiro de perguntas com IA */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} /> Roteiro de perguntas</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>
          Descreva o segmento ou contexto do cliente e a IA monta um roteiro de discovery por temas.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Input
            value={segmento}
            onChange={(ev) => setSegmento(ev.target.value)}
            placeholder="Ex.: clínica odontológica que quer agendar online"
            style={{ flex: 1, minWidth: 260 }}
            onPressEnter={gerarPerguntas}
          />
          <Button type="primary" icon={<Wand2 size={16} />} loading={gerandoPerguntas} onClick={gerarPerguntas}>
            Gerar roteiro
          </Button>
        </div>

        {gerandoPerguntas && <Spin style={{ display: 'block', margin: '24px auto' }} />}

        {blocos.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <Button size="small" onClick={copiarRoteiro}>Copiar roteiro</Button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {blocos.map((b, i) => (
                <div key={i} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', background: t.surfaceMuted }}>
                  <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>{b.tema || `Bloco ${i + 1}`}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 13.5, lineHeight: 1.7 }}>
                    {(b.perguntas || []).map((p, j) => <li key={j}>{p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* Registrar entrevista */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Plus size={17} /> Registrar entrevista</span>}>
        <Form form={form} layout="vertical" onFinish={salvarEntrevista} initialValues={{ tipo: 'Discovery', data: new Date().toISOString().slice(0, 10) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <Form.Item name="pessoaId" label="Cliente" rules={[{ required: true, message: 'Selecione o cliente' }]}>
              <Select
                options={clienteOptions}
                placeholder={clienteOptions.length ? 'Selecione' : 'Cadastre um cliente primeiro'}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="data" label="Data"><Input type="date" /></Form.Item>
            <Form.Item name="tipo" label="Tipo"><Select options={TIPO_OPTIONS} /></Form.Item>
          </div>
          <Form.Item name="transcricao" label="Transcrição / Notas" rules={[{ required: true, message: 'Cole a transcrição ou suas anotações' }]}>
            <Input.TextArea rows={6} placeholder="Cole aqui a transcrição da conversa ou suas anotações da entrevista..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" loading={salvando} icon={<Plus size={16} />}>Salvar entrevista</Button>
          </div>
        </Form>
      </Panel>

      {/* Lista de entrevistas */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MessageSquareText size={17} /> Entrevistas registradas</span>}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : entrevistas.length === 0 ? (
          <Empty description="Nenhuma entrevista registrada ainda" />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {entrevistas.map((e) => {
              const analise = analises[e.id];
              return (
                <div key={e.id} style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, background: t.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>
                        {e.pessoaNome || nomeCliente(e.pessoaId)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Tag bordered={false} style={{ background: `${t.accents.blue}1f`, color: t.accents.blue, borderRadius: 999 }}>{e.tipo}</Tag>
                        <span style={{ fontSize: 12, color: t.textTertiary, fontFamily: FONTS.mono }}>{e.data}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="small" icon={<Sparkles size={14} />} loading={analisandoId === e.id} onClick={() => analisar(e)}>
                        {analise ? 'Reanalisar' : 'Analisar com IA'}
                      </Button>
                      <Popconfirm title="Remover entrevista?" onConfirm={() => remover(e.id)} okText="Remover" cancelText="Cancelar">
                        <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </div>
                  </div>

                  {e.transcricao && (
                    <p style={{ color: t.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap', maxHeight: 88, overflow: 'hidden' }}>
                      {e.transcricao}
                    </p>
                  )}

                  {analise && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${t.border}` }}>
                      {analise.resumo && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <FileText size={16} style={{ color: t.accents.peach, marginTop: 2, flexShrink: 0 }} />
                          <p style={{ margin: 0, color: t.text, fontSize: 14, lineHeight: 1.6 }}>{analise.resumo}</p>
                        </div>
                      )}
                      <Lista titulo="Dores" itens={analise.dores} cor={t.accents.rose} />
                      <Lista titulo="Objetivos" itens={analise.objetivos} cor={t.accents.sage} />
                      <Lista titulo="Requisitos" itens={analise.requisitos} cor={t.accents.blue} />
                      <Lista titulo="Perguntas em aberto" itens={analise.perguntasAbertas} cor={t.textTertiary} />
                      {analise.oportunidade && (
                        <div style={{ marginTop: 14 }}>
                          <CopyBlock label="Oportunidade" text={analise.oportunidade} mono={false} maxHeight={160} />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                        <Button type="primary" ghost icon={<Lightbulb size={15} />} loading={criandoIdeiaId === e.id} onClick={() => gerarIdeia(e)}>
                          Gerar ideia
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
