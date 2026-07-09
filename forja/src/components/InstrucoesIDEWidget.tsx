// InstrucoesIDEWidget — v1.271.0
// Widget compacto "Como usar na IDE": mora nas estações Skills, Agents e Kits.
// Fechado é uma barra fina; aberto mostra a escolha da IDE (Cursor / Claude
// Code / genérico) + um mini prompt padrão pronto pra colar na primeira
// conversa do projeto (ou salvar como regra/AGENTS.md). O texto se adapta ao
// contexto (só skills, só agents, ou kit misto) e à pasta de cada IDE.
import React, { useState } from 'react';
import { Segmented } from 'antd';
import { ChevronDown, ChevronRight, TerminalSquare, MousePointer2, Bot, Boxes } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import { CopyBlock } from './ui';

type Contexto = 'skills' | 'agents' | 'kit';
type IDE = 'cursor' | 'claude' | 'generico';

interface Props {
  contexto: Contexto;
}

const IDE_INFO: Record<IDE, { dir: string; nome: string; ondeColar: string }> = {
  cursor: {
    dir: '.cursor', nome: 'Cursor',
    ondeColar: 'Cole no chat na primeira conversa — ou salve como regra em .cursor/rules/ pra valer sempre.',
  },
  claude: {
    dir: '.claude', nome: 'Claude Code',
    ondeColar: 'Cole no início da sessão — ou adicione ao CLAUDE.md do projeto pra valer sempre. '
      + 'Dica: o .zip exportado pro Claude Code já leva um settings.json com permissões pré-aprovadas '
      + '(menos pedidos de autorização durante o vibe code).',
  },
  generico: {
    dir: '.agents', nome: 'outra IDE / genérico',
    ondeColar: 'Cole no início da conversa — ou adicione ao AGENTS.md do projeto pra valer sempre.',
  },
};

function montarPrompt(contexto: Contexto, ide: IDE): string {
  const { dir } = IDE_INFO[ide];
  const temSkills = contexto !== 'agents';
  const temAgents = contexto !== 'skills';

  const onde = [
    temSkills ? `skills em ${dir}/skills/ (uma pasta por skill, com SKILL.md)` : '',
    temAgents ? `agents em ${dir}/agents/ (um .md por papel)` : '',
  ].filter(Boolean).join(' e ');

  const linhas: string[] = [
    `Contexto: este projeto tem ${onde}, instalados pela Forja.`,
    '',
    'Regras de trabalho:',
  ];
  let n = 1;
  if (temSkills) {
    linhas.push(
      `${n++}. Antes de QUALQUER tarefa, identifique as skills relevantes pra ela, leia os SKILL.md e siga as instruções deles à risca.`,
    );
  }
  if (temAgents) {
    linhas.push(
      `${n++}. Assuma o papel do agent certo pra tarefa (tech-lead orquestra, arquiteto desenha, revisor audita, designer cuida da UI). Em tarefas grandes, encadeie os papéis: planejar → executar → revisar.`,
    );
  }
  linhas.push(
    `${n++}. Nunca entregue código sem passar pela revisão descrita ${temSkills ? 'nas skills de code review' : 'pelo agent revisor'}: sem alucinação, sem overengineering, segurança validada.`,
    `${n++}. UI sempre no padrão premium ${temSkills ? 'das skills de design' : 'do agent de design'} — nada de cara genérica de app gerado por IA.`,
    `${n++}. No fim de cada entrega, diga QUAIS ${temSkills && temAgents ? 'skills e agents' : temSkills ? 'skills' : 'agents'} você usou.`,
  );
  return linhas.join('\n');
}

const ROTULO: Record<Contexto, string> = {
  skills: 'Como usar estas skills na sua IDE',
  agents: 'Como usar estes agents na sua IDE',
  kit: 'Como usar o kit na sua IDE',
};

export default function InstrucoesIDEWidget({ contexto }: Props): React.ReactElement {
  const t = useTokens();
  const [aberto, setAberto] = useState(false);
  const [ide, setIde] = useState<IDE>('cursor');
  const info = IDE_INFO[ide];

  return (
    <div style={{
      border: `1px solid ${aberto ? `${t.accents.clay}55` : t.borderSoft}`,
      background: aberto ? `${t.accents.clay}0d` : t.surfaceMuted,
      borderRadius: 12, marginBottom: 14, overflow: 'hidden',
      transition: 'all 0.18s ease',
    }}>
      <button
        onClick={() => setAberto((v) => !v)}
        style={{
          width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', textAlign: 'left',
        }}
      >
        <TerminalSquare size={14} color={t.accents.clay} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, flex: 1 }}>
          {ROTULO[contexto]}
          <span style={{ fontWeight: 400, color: t.textTertiary }}> — mini prompt pronto pra colar</span>
        </span>
        {aberto ? <ChevronDown size={14} color={t.textTertiary} /> : <ChevronRight size={14} color={t.textTertiary} />}
      </button>

      {aberto && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <Segmented
              size="small"
              value={ide}
              onChange={(v) => setIde(v as IDE)}
              options={[
                { value: 'cursor', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MousePointer2 size={12} /> Cursor</span>) },
                { value: 'claude', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Bot size={12} /> Claude Code</span>) },
                { value: 'generico', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Boxes size={12} /> Genérico</span>) },
              ]}
            />
            <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
              instala em <code style={{ fontFamily: FONTS.mono, fontSize: 10.5 }}>{info.dir}/</code> (o install.sh do .zip exportado já faz isso)
            </span>
          </div>

          <CopyBlock text={montarPrompt(contexto, ide)} label={`Mini prompt · ${info.nome}`} maxHeight={220} />

          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
            {info.ondeColar}
          </div>
        </div>
      )}
    </div>
  );
}
