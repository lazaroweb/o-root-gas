import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Select, Input, Button, Empty, Spin, App as AntApp, Segmented, Tooltip, Tag } from 'antd';
import { Sparkles, Send, User, Eraser, Zap, FileText, TrendingUp, Lightbulb, ShieldAlert, Globe, Wand2, BookMarked, Plus } from 'lucide-react';
import CodexToggle from '../components/CodexToggle';
import ModeloBadge from '../components/ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Sistema, Pessoa, ServerResponse, ServerResult } from '../types';
import ToolProposalCard, { type ToolCall, type ToolExecutionResult } from '../components/ToolProposalCard';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolExecutionResult[];
  toolRejected?: boolean;
}

type Contexto = 'nenhum' | 'sistema' | 'portfolio';

const SUGESTOES = [
  'Me ajude a definir a arquitetura de um app novo.',
  'Quais perguntas devo fazer numa entrevista de discovery com um cliente?',
  'Gere um prompt de kickoff para eu colar no Cursor.',
  'Compare duas stacks para um SaaS de assinatura.',
];

export default function IAChat({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [contexto, setContexto] = useState<Contexto>('nenhum');
  const [sistemaId, setSistemaId] = useState<string>('');
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acaoLoading, setAcaoLoading] = useState<string>('');
  const [skillsBiblioteca, setSkillsBiblioteca] = useState<Array<{ id: string; nome: string; descricao: string; categoria?: string; tags?: string[] }>>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  // Códex: default ativado pra IA respeitar padrões pessoais do user.
  const [usarCodex, setUsarCodex] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);
  useEffect(() => {
    callServer<ServerResponse<Pessoa[]>>('getPessoas')
      .then((r) => {
        if (r.ok && r.data) {
          const lista = (r.data as Pessoa[]).filter((p) => p.papel === 'cliente');
          setClientes(lista);
        }
      })
      .catch(() => { /* preview local */ });
    callServer<ServerResult>('skillsList')
      .then((r) => {
        if (r.ok && r.data) {
          const lista = r.data as Array<{ id: string; nome: string; descricao: string; categoria?: string; tags?: string[] }>;
          setSkillsBiblioteca(lista);
        }
      })
      .catch(() => { /* sem skills no preview */ });
  }, []);

  // Sugestão automática: match leve por keyword/tag/categoria entre o input e cada
  // skill. Sem chamada de IA — heurística local pra ser instantânea.
  const sistemaAtual = sistemaId ? sistemas.find((s) => s.id === sistemaId) : undefined;
  const skillsSugeridas = useMemo(() => {
    if (skillsBiblioteca.length === 0) return [];
    const inputNorm = input.trim().toLowerCase();
    if (inputNorm.length < 8) return []; // só sugere depois que o user escreveu algo concreto

    const textoContexto = [
      inputNorm,
      sistemaAtual?.nome || '',
      sistemaAtual?.proposito || '',
      Array.isArray(sistemaAtual?.stack) ? sistemaAtual.stack.join(' ') : String(sistemaAtual?.stack || ''),
    ].join(' ').toLowerCase();

    const scored: Array<{ skill: typeof skillsBiblioteca[0]; score: number; razao: string[] }> = [];
    for (const sk of skillsBiblioteca) {
      if (skillIds.includes(sk.id)) continue; // já ativa
      const razao: string[] = [];
      let score = 0;

      const tags = (sk.tags || []).map((t) => t.toLowerCase());
      for (const tag of tags) {
        if (tag && textoContexto.includes(tag)) { score += 3; razao.push(`tag "${tag}"`); }
      }
      // Match parcial no nome (palavras de >3 chars)
      const nomeTokens = sk.nome.toLowerCase().split(/[\s\-_]+/).filter((w) => w.length > 3);
      for (const w of nomeTokens) {
        if (textoContexto.includes(w)) { score += 2; razao.push(`"${w}"`); }
      }
      // Categoria
      const cat = (sk.categoria || '').toLowerCase();
      if (cat && cat.length > 3 && textoContexto.includes(cat)) { score += 2; razao.push(`cat "${cat}"`); }
      // Descrição (peso baixo, só palavras significativas)
      const descTokens = (sk.descricao || '').toLowerCase().split(/[\s\-_,.;]+/).filter((w) => w.length > 5);
      for (const w of descTokens.slice(0, 30)) {
        if (textoContexto.includes(w)) { score += 0.5; }
      }
      if (score >= 3) scored.push({ skill: sk, score, razao: razao.slice(0, 2) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  }, [input, skillsBiblioteca, skillIds, sistemaAtual]);

  const aplicarSkillSugerida = (id: string) => {
    setSkillIds([...skillIds, id]);
  };

  const send = (texto?: string, contextoExtra?: string) => {
    const conteudo = (texto ?? input).trim();
    if (!conteudo || sending) return;
    const novaHistoria: ChatMsg[] = [...msgs, { role: 'user', content: conteudo }];
    setMsgs(novaHistoria);
    setInput('');
    setSending(true);
    const sid = contexto === 'sistema' ? sistemaId : '';
    const historiaLimpa = novaHistoria.map((m) => ({ role: m.role, content: m.content }));
    if (contextoExtra) {
      historiaLimpa[historiaLimpa.length - 1] = {
        role: 'user',
        content: contextoExtra + '\n\n---\n\n' + conteudo,
      };
    }
    callServer<ServerResult>('chatLLMComTools', historiaLimpa, sid, { contexto, skillIds, usarCodex })
      .then(res => {
        if (res.ok && res.data) {
          const d = res.data as { texto: string; toolCalls: ToolCall[] };
          setMsgs([...novaHistoria, { role: 'assistant', content: d.texto || '(sem texto)', toolCalls: d.toolCalls && d.toolCalls.length > 0 ? d.toolCalls : undefined }]);
        } else {
          message.error(res.error || 'Erro');
          setMsgs([...novaHistoria, { role: 'assistant', content: `⚠️ ${res.error || 'Não consegui responder. Verifique a conexão de IA em Configurações.'}` }]);
        }
      })
      .catch(() => { message.error('Sem conexão (rode no app publicado)'); setMsgs([...novaHistoria, { role: 'assistant', content: '⚠️ A IA só responde no app publicado, com o proxy configurado em Configurações.' }]); })
      .finally(() => setSending(false));
  };

  // Quando o usuário executa/recusa um conjunto de tools, atualizamos a msg
  // que continha a proposta e adicionamos uma mensagem "system" no histórico
  // pra que a IA enxergue o resultado e possa reagir no próximo turno.
  const onToolsExecuted = (idx: number, results: ToolExecutionResult[]) => {
    setMsgs((m) => {
      const novo = [...m];
      novo[idx] = { ...novo[idx], toolResults: results, toolCalls: undefined };
      const resumo = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.preview || r.tool}${r.error ? ` — erro: ${r.error}` : ''}`).join('\n');
      novo.push({ role: 'assistant', content: `*${results.filter((r) => r.ok).length} de ${results.length} ações executadas:*\n\n${resumo}` });
      return novo;
    });
  };

  const onToolsRejected = (idx: number) => {
    setMsgs((m) => {
      const novo = [...m];
      novo[idx] = { ...novo[idx], toolRejected: true, toolCalls: undefined };
      return novo;
    });
  };

  const acao = async (id: string, fn: string, label: string, args: unknown[] = []) => {
    setAcaoLoading(id);
    setMsgs((m) => [...m, { role: 'user', content: label }]);
    try {
      const r = await callServer<ServerResult>(fn, ...args);
      if (r.ok && r.data) {
        const texto = typeof r.data === 'string' ? r.data : (r.data as { texto?: string }).texto || JSON.stringify(r.data, null, 2);
        setMsgs((m) => [...m, { role: 'assistant', content: texto }]);
      } else {
        setMsgs((m) => [...m, { role: 'assistant', content: `⚠️ ${r.error || 'Erro'}` }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Erro'}` }]);
    } finally { setAcaoLoading(''); }
  };

  const bubble = (m: ChatMsg, i: number) => {
    const isUser = m.role === 'user';
    return (
      <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 20, flexDirection: isUser ? 'row-reverse' : 'row' }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isUser ? `${t.accents.blue}1f` : `${t.accents.peach}1f`, color: isUser ? t.accents.blue : t.accents.peach }}>
          {isUser ? <User size={16} strokeWidth={1.8} /> : <Sparkles size={16} strokeWidth={1.8} />}
        </span>
        <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div
            style={{
              background: isUser ? t.surfaceMuted : t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: '12px 16px',
              color: t.text,
              fontSize: 14,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              boxShadow: t.shadowSoft,
            }}
          >
            {m.content}
          </div>
          {m.toolCalls && m.toolCalls.length > 0 && (
            <ToolProposalCard
              calls={m.toolCalls}
              onExecuted={(res) => onToolsExecuted(i, res)}
              onRejected={() => onToolsRejected(i)}
            />
          )}
          {m.toolRejected && (
            <div style={{ marginTop: 8, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, fontStyle: 'italic' }}>
              Ações recusadas — nada foi alterado.
            </div>
          )}
        </div>
      </div>
    );
  };

  const ActionChip = ({ id, icon, label, descricao, fn, args, disabled }: { id: string; icon: React.ReactNode; label: string; descricao: string; fn: string; args: unknown[]; disabled?: boolean }) => (
    <Tooltip title={descricao}>
      <button
        disabled={!!disabled || !!acaoLoading}
        onClick={() => acao(id, fn, label, args)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: disabled ? t.surfaceMuted : t.surface,
          border: `1px solid ${disabled ? t.borderSoft : t.border}`,
          borderRadius: 999, padding: '7px 14px',
          fontFamily: FONTS.ui, fontSize: 13, color: disabled ? t.textTertiary : t.text,
          cursor: disabled || acaoLoading ? 'not-allowed' : 'pointer',
          opacity: acaoLoading && acaoLoading !== id ? 0.5 : 1,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled && !acaoLoading) e.currentTarget.style.borderColor = `${t.accents.peach}88`; }}
        onMouseLeave={(e) => { if (!disabled && !acaoLoading) e.currentTarget.style.borderColor = t.border; }}
      >
        {acaoLoading === id ? <Spin size="small" /> : <span style={{ color: t.accents.peach }}>{icon}</span>}
        {label}
      </button>
    </Tooltip>
  );

  const semSistema = !sistemaId;
  const semCliente = !clienteId;
  const chipStyle = (tt: ReturnType<typeof useTokens>, disabled: boolean, _accent: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: disabled ? tt.surfaceMuted : tt.surface,
    border: `1px solid ${disabled ? tt.borderSoft : tt.border}`,
    borderRadius: 999, padding: '7px 14px',
    fontFamily: FONTS.ui, fontSize: 13, color: disabled ? tt.textTertiary : tt.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 280px)', minHeight: 420 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Segmented
            value={contexto}
            onChange={(v) => setContexto(v as Contexto)}
            options={[
              { label: 'Sem contexto', value: 'nenhum' },
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Globe size={13} /> Portfólio</span>, value: 'portfolio' },
              { label: 'Sistema', value: 'sistema' },
            ]}
          />
          {contexto === 'sistema' && (
            <Select
              value={sistemaId || undefined}
              onChange={(v) => setSistemaId(v || '')}
              allowClear
              placeholder="Escolha um sistema"
              style={{ minWidth: 220 }}
              options={sistemas.map(s => ({ value: s.id, label: s.nome }))}
            />
          )}
          {contexto === 'portfolio' && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
              A IA enxerga seus sistemas, clientes, ideias, custos e alertas.
            </span>
          )}
          <CodexToggle value={usarCodex} onChange={setUsarCodex} compact />
          <ModeloBadge uso="chat" size="small" />
        </div>
        {msgs.length > 0 && <Button icon={<Eraser size={15} />} onClick={() => setMsgs([])}>Limpar</Button>}
      </div>

      {/* Seletor de Skills: injeta playbooks como system prompt adicional */}
      {skillsBiblioteca.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Tooltip title="Skills aplicadas ficam no system prompt — a IA segue elas como diretriz adicional na conversa toda. Bom pra: voz/tom específico, checklists, frameworks (BMC, MoSCoW), formatos de saída.">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
              <BookMarked size={13} color={t.accents.lavender} />
              Skills ativas
            </span>
          </Tooltip>
          <Select
            mode="multiple"
            size="small"
            allowClear
            value={skillIds}
            onChange={(v) => setSkillIds(v as string[])}
            placeholder="Nenhuma (clique pra aplicar uma skill)"
            style={{ flex: 1, minWidth: 240, maxWidth: 540 }}
            maxTagCount="responsive"
            options={skillsBiblioteca.map((s) => ({
              value: s.id,
              label: s.nome,
              title: s.descricao,
            }))}
            optionRender={(opt) => {
              const sk = skillsBiblioteca.find((s) => s.id === opt.value);
              return (
                <div style={{ padding: '2px 0' }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>{sk?.nome}</div>
                  {sk?.descricao && (
                    <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2, lineHeight: 1.4, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sk.descricao}
                    </div>
                  )}
                </div>
              );
            }}
          />
          {skillIds.length > 0 && (
            <Tag color="purple" style={{ marginInlineEnd: 0, fontFamily: FONTS.ui }}>
              {skillIds.length} skill{skillIds.length > 1 ? 's' : ''} no prompt
            </Tag>
          )}
        </div>
      )}

      {/* Ações contextuais */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginRight: 4 }}>Ações rápidas:</span>
        <ActionChip id="resumo" icon={<TrendingUp size={14} />} label="Resumo executivo" descricao="Snapshot do portfólio em 250 palavras" fn="acaoIAResumoExecutivo" args={[]} />
        <ActionChip id="riscos" icon={<ShieldAlert size={14} />} label="Análise de risco" descricao="Concentração, saúde, financeira, operacional" fn="acaoIARiscoPortfolio" args={[]} />
        <ActionChip id="preco" icon={<Zap size={14} />} label="Sugerir preço" descricao={semSistema ? 'Selecione um sistema (Contexto → Sistema)' : `Preços para ${sistemas.find(s => s.id === sistemaId)?.nome}`} fn="acaoIASugerirPreco" args={[sistemaId]} disabled={semSistema} />
        <ActionChip id="release" icon={<FileText size={14} />} label="Release notes" descricao={semSistema ? 'Selecione um sistema com repositório' : 'Últimos 30 dias do GitHub'} fn="acaoIAReleaseNotes" args={[sistemaId, 30]} disabled={semSistema} />
        <button
          disabled={semSistema || sending}
          onClick={() => send(
            `Olhe o contexto deste sistema e me proponha de 3 a 5 itens entre RISCOS, DECISÕES e OPORTUNIDADES de melhoria que ainda não foram capturados. Para cada item, use a ação apropriada (registrar_risco, registrar_decisao ou registrar_oportunidade) no bloco TOOL_CALLS. Não adicione itens triviais — só os que realmente valeriam aparecer no backlog. Antes do TOOL_CALLS, em até 3 frases, explique o critério que você usou.`,
          )}
          style={chipStyle(t, semSistema || !!sending, t.accents.rose)}
          title={semSistema ? 'Selecione um sistema' : 'A IA propõe riscos/decisões/oportunidades para você aprovar'}
        >
          <Wand2 size={14} style={{ color: t.accents.rose }} /> Pensa em melhorias
        </button>
        <button
          disabled={sending}
          onClick={() => send(
            contexto === 'sistema' && sistemaId
              ? `Gere um backlog de implementação pronto pra colar no Cursor ou Claude. Considere o contexto deste sistema. Use a ação gerar_arquivo_md com um nome no formato "backlog-<codinome>-<data>" e o conteúdo Markdown completo cobrindo: visão geral do sistema, próximas 5 tarefas com critério de aceite, riscos a monitorar, e um prompt-base pronto pra colar. Antes do bloco TOOL_CALLS, escreva 1 linha resumindo o backlog.`
              : `Gere um backlog estratégico do meu portfólio pronto pra eu colar numa IA. Use a ação gerar_arquivo_md com nome "backlog-portfolio-<data>" e conteúdo Markdown: foco do próximo trimestre, 5-7 ações prioritárias com sistemas envolvidos, e um prompt-base pra orquestrar tudo. Antes do TOOL_CALLS, 1 linha de resumo.`,
          )}
          style={chipStyle(t, !!sending, t.accents.peach)}
          title="Gera um arquivo .md que você baixa e cola no Cursor/Claude/ChatGPT"
        >
          <FileText size={14} style={{ color: t.accents.peach }} /> Gera backlog .md
        </button>
        <Select
          size="small"
          value={clienteId || undefined}
          onChange={(v) => setClienteId(v || '')}
          allowClear
          placeholder="Cliente"
          style={{ minWidth: 140 }}
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
        />
        <ActionChip id="ideias" icon={<Lightbulb size={14} />} label="Ideias p/ cliente" descricao={semCliente ? 'Selecione um cliente' : `5 ideias para ${clientes.find(c => c.id === clienteId)?.nome}`} fn="acaoIAIdeiasParaCliente" args={[clienteId]} disabled={semCliente} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, marginBottom: 16 }}>
        {msgs.length === 0 ? (
          <div style={{ marginTop: 24 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textSecondary }}>Comece uma conversa ou use uma ação rápida acima</span>} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 20, maxWidth: 680, marginInline: 'auto' }}>
              {SUGESTOES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: '10px 14px', color: t.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONTS.ui, textAlign: 'left', maxWidth: 320 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${t.accents.peach}66`; e.currentTarget.style.color = t.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {msgs.map(bubble)}
            {sending && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${t.accents.peach}1f`, color: t.accents.peach }}>
                  <Sparkles size={16} strokeWidth={1.8} />
                </span>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '12px 16px' }}>
                  <Spin size="small" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Sugestões automáticas de skills baseadas no que está sendo digitado */}
      {skillsSugeridas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', background: `${t.accents.lavender}0d`, border: `1px dashed ${t.accents.lavender}55`, borderRadius: 10, flexWrap: 'wrap' }}>
          <Tooltip title="Skills da sua biblioteca que parecem relevantes pra esse prompt. Clique pra aplicar.">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.lavender, fontWeight: 600 }}>
              <Sparkles size={11} /> SKILLS QUE PODEM AJUDAR
            </span>
          </Tooltip>
          {skillsSugeridas.map(({ skill, razao }) => (
            <Tooltip
              key={skill.id}
              title={
                <div style={{ fontSize: 11 }}>
                  <strong>{skill.nome}</strong>
                  {skill.descricao && <div style={{ marginTop: 4, color: '#ddd' }}>{skill.descricao.slice(0, 120)}{skill.descricao.length > 120 ? '…' : ''}</div>}
                  {razao.length > 0 && <div style={{ marginTop: 4, fontStyle: 'italic', color: '#bbb' }}>Match: {razao.join(', ')}</div>}
                </div>
              }
            >
              <button
                onClick={() => aplicarSkillSugerida(skill.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999,
                  fontFamily: FONTS.ui, fontSize: 11.5, color: t.text, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accents.lavender; e.currentTarget.style.background = `${t.accents.lavender}15`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderSoft; e.currentTarget.style.background = t.surface; }}
              >
                <Plus size={11} color={t.accents.lavender} />
                {skill.nome}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 10, boxShadow: t.shadowSoft }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escreva para a Forja IA...  (Enter envia, Shift+Enter quebra linha)"
          autoSize={{ minRows: 1, maxRows: 6 }}
          variant="borderless"
          style={{ flex: 1, resize: 'none', fontSize: 14 }}
        />
        <Button type="primary" icon={<Send size={16} />} onClick={() => send()} loading={sending} disabled={!input.trim()} style={{ height: 38 }}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
