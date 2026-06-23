// v1.148.3 — instruções de como aplicar uma skill nas principais IDEs.
// Cada skill na Forja vira algo "instalável" em qualquer agente de IA
// (Cursor, Claude Code, Codex, Continue, Copilot, Windsurf). Esta UI mostra
// EXATAMENTE onde colar/copiar, com comandos prontos.
//
// Filosofia: o mesmo conteúdo de uma SKILL.md funciona em todas as IDEs —
// só MUDA O JEITO DE INSTALAR. Documentamos os 6 jeitos mais relevantes,
// rankeados pelo que cobre mais agentes simultaneamente (AGENTS.md primeiro).
import React, { useMemo, useState } from 'react';
import { Segmented, Button, Tooltip, App as AntApp } from 'antd';
import { Copy, ExternalLink, Wand2, Info } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

interface Props {
  skillNome: string;
  skillFonte: string;
  conteudoMd: string;
}

type IdeKey = 'agents' | 'cursor-user' | 'cursor-rule' | 'claude-code' | 'codex' | 'continue' | 'copilot' | 'windsurf';

interface IdeInfo {
  key: IdeKey;
  label: string;
  cobre: string;        // 1 frase: pra quem isso vale
  caminho: string;      // path do arquivo destino
  comoInstalar: string; // markdown curto
  comando?: string;     // comando bash opcional (curl/cp)
  observacao?: string;  // alerta de limitação
}

function gerarIdes(skillNome: string, conteudoMd: string): IdeInfo[] {
  // Slug seguro pra usar em paths (kebab-case).
  const slug = skillNome.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'skill';

  return [
    {
      key: 'agents',
      label: 'AGENTS.md',
      cobre: 'Cursor + Claude Code + Codex + Continue (universal, recomendado)',
      caminho: 'AGENTS.md (raiz do repo)',
      comoInstalar:
        'Se o repo NÃO tem AGENTS.md: crie um na raiz com o conteúdo abaixo.\n'
        + 'Se JÁ tem: cole o conteúdo dentro como nova seção `## ' + skillNome + '`.\n'
        + 'Commit + push. Pronto — todos os agentes que respeitam AGENTS.md (Cursor, Claude Code, Codex, Continue) já vão seguir.',
      comando: `# bash — cria/atualiza AGENTS.md\ncat >> AGENTS.md << 'EOF'\n\n## ${skillNome}\n\n${conteudoMd.replace(/^---[\s\S]*?---\n*/m, '')}\nEOF`,
    },
    {
      key: 'cursor-user',
      label: 'Cursor User Rule',
      cobre: 'Só Cursor — mas vale em TODOS os seus repos automaticamente',
      caminho: 'Cursor → Settings → Rules → User Rules',
      comoInstalar:
        '1. Abra o Cursor → ⚙️ Settings\n2. Clique em "Rules"\n3. Em "User Rules" cole o conteúdo da skill\n4. Save\n\nVantagem: aplica em todos os repos sem precisar copiar nada. Bom pra protocolos genéricos teus.\nDesvantagem: o time não pega — é pessoal seu.',
    },
    {
      key: 'cursor-rule',
      label: 'Cursor `.mdc`',
      cobre: 'Só Cursor — vai versionado junto com o repo (time inteiro adota)',
      caminho: `.cursor/rules/${slug}.mdc`,
      comoInstalar:
        '1. Crie o arquivo abaixo dentro do repo.\n2. Adicione um frontmatter `---` no topo com `description`, `globs` (quais arquivos disparam a regra), e `alwaysApply: true` se quer que rode sempre.\n3. Cole o resto do conteúdo da skill.\n4. Commit + push.',
      comando: `mkdir -p .cursor/rules\ncat > .cursor/rules/${slug}.mdc << 'EOF'\n---\ndescription: ${skillNome}\nglobs: **/*\nalwaysApply: true\n---\n\n${conteudoMd.replace(/^---[\s\S]*?---\n*/m, '')}\nEOF`,
    },
    {
      key: 'claude-code',
      label: 'Claude Code',
      cobre: 'Claude Code (terminal/CLI da Anthropic)',
      caminho: `~/.claude/skills/${slug}/SKILL.md`,
      comoInstalar:
        'Claude Code lê skills do diretório `~/.claude/skills/<nome>/SKILL.md`. Coloca lá e ele auto-descobre.\n\nO Claude Code também respeita `AGENTS.md` no repo, então AGENTS.md cobre esse caso "de graça".',
      comando: `mkdir -p ~/.claude/skills/${slug}\ncat > ~/.claude/skills/${slug}/SKILL.md << 'EOF'\n${conteudoMd}\nEOF`,
    },
    {
      key: 'codex',
      label: 'Codex (OpenAI)',
      cobre: 'Codex CLI / GitHub Codex',
      caminho: 'AGENTS.md (raiz do repo)',
      comoInstalar:
        'Codex respeita `AGENTS.md` na raiz do repo. Use o método "AGENTS.md" desta lista — cobre Codex e mais 3 agentes na mesma jogada.',
      observacao: 'Não tem mecanismo equivalente a "user rule global" no Codex hoje — sempre por repo via AGENTS.md.',
    },
    {
      key: 'continue',
      label: 'Continue',
      cobre: 'Continue.dev (extensão VSCode/JetBrains)',
      caminho: '~/.continue/config.json → systemMessage',
      comoInstalar:
        'Continue carrega regras via `systemMessage` no `~/.continue/config.json`. Cole o conteúdo da skill no campo `systemMessage` do modelo que você usa.\n\nAlternativa: Continue também respeita `AGENTS.md` se você habilitar o context provider `@codebase`.',
    },
    {
      key: 'copilot',
      label: 'GitHub Copilot',
      cobre: 'GitHub Copilot (VSCode, JetBrains)',
      caminho: '.github/copilot-instructions.md',
      comoInstalar:
        'Copilot lê `.github/copilot-instructions.md` na raiz do repo automaticamente. Cole o conteúdo da skill nesse arquivo.',
      comando: `mkdir -p .github\ncat > .github/copilot-instructions.md << 'EOF'\n${conteudoMd.replace(/^---[\s\S]*?---\n*/m, '')}\nEOF`,
      observacao: 'Copilot só lê 1 arquivo (não acumula múltiplas skills). Se já tem instruções, ANEXE ao final.',
    },
    {
      key: 'windsurf',
      label: 'Windsurf',
      cobre: 'Windsurf (Codeium IDE)',
      caminho: '.windsurfrules (raiz do repo)',
      comoInstalar:
        'Windsurf lê `.windsurfrules` na raiz do repositório. Cole o conteúdo da skill nesse arquivo.',
      comando: `cat > .windsurfrules << 'EOF'\n${conteudoMd.replace(/^---[\s\S]*?---\n*/m, '')}\nEOF`,
    },
  ];
}

export default function ComoUsarSkill({ skillNome, skillFonte, conteudoMd }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideAtiva, setIdeAtiva] = useState<IdeKey>('agents');

  const ides = useMemo(() => gerarIdes(skillNome, conteudoMd), [skillNome, conteudoMd]);
  const ideAtual = ides.find((i) => i.key === ideAtiva) || ides[0];

  const copiar = (texto: string, oQue: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        message.success(`${oQue} copiado pra área de transferência.`);
      }).catch(() => {
        message.error('Não consegui copiar — copia manual no campo abaixo.');
      });
    }
  };

  return (
    <div style={{
      background: t.surfaceMuted,
      border: `1px solid ${t.borderSoft}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Wand2 size={14} color={t.accents.peach} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>
          Como usar essa skill em cada IDE
        </span>
        <Tooltip title="O mesmo conteúdo da skill funciona em qualquer agente de IA — só MUDA O JEITO DE INSTALAR. Escolhe abaixo seu agente e copia o que aparecer.">
          <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} />
        </Tooltip>
      </div>

      <Segmented
        size="small"
        block
        value={ideAtiva}
        onChange={(v) => setIdeAtiva(v as IdeKey)}
        options={ides.map((i) => ({ value: i.key, label: i.label }))}
        style={{ marginBottom: 12 }}
      />

      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>
          Cobre
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, marginBottom: 10 }}>
          {ideAtual.cobre}
        </div>

        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>
          Onde colocar
        </div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 12, color: t.accents.lavender,
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
          borderRadius: 6, padding: '5px 9px', marginBottom: 10,
          display: 'inline-block',
        }}>
          {ideAtual.caminho}
        </div>

        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>
          Como instalar
        </div>
        <div style={{
          fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary,
          lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 10,
        }}>
          {ideAtual.comoInstalar}
        </div>

        {ideAtual.observacao && (
          <div style={{
            background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}40`,
            borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <Info size={12} color={t.accents.peach} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{ideAtual.observacao}</span>
          </div>
        )}

        {ideAtual.comando && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                Comando pronto (copia e cola no terminal do repo destino)
              </span>
              <Button size="small" type="text" icon={<Copy size={12} />}
                onClick={() => copiar(ideAtual.comando || '', 'Comando')}
              >
                copiar
              </Button>
            </div>
            <pre style={{
              background: '#1c1814', color: '#f5efe6', border: `1px solid #2a221b`,
              borderRadius: 8, padding: 10, margin: 0,
              fontFamily: FONTS.mono, fontSize: 11.5, lineHeight: 1.5,
              maxHeight: 220, overflow: 'auto', whiteSpace: 'pre',
            }}>
              {ideAtual.comando}
            </pre>
          </>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button size="small" icon={<Copy size={12} />} onClick={() => copiar(conteudoMd, 'Conteúdo da skill')}>
            Copiar conteúdo da skill
          </Button>
          {skillFonte.startsWith('gas-app-kit/') && (
            <Tooltip title="Abrir o arquivo SKILL.md original no GitHub">
              <Button
                size="small"
                icon={<ExternalLink size={12} />}
                href={`https://github.com/lazaroweb/o-root-gas/blob/master/gas-app-kit/skills/${skillFonte.replace(/^gas-app-kit\//, '')}/SKILL.md`}
                target="_blank"
              >
                Ver no GitHub
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
