// KitsHubPanel — v1.152.0
// "Kits dos sonhos": objetivos fixos (Fundação Essencial, Full-stack Web, AI
// Dev...) que a Lume preenche com as melhores skills+agents da base (por
// estrelas + aderência). Cada kit é exportável como .zip misto.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin, Tag, Tooltip, Drawer, message, Skeleton, Modal, Segmented, Input } from 'antd';
import {
  Boxes, Sparkles, Bot, BookMarked, Package, RefreshCw, Eye, Layers, Wand2, Apple, Monitor, MousePointer2,
  Briefcase, Plus, Trash2,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import { criarZipBlob, baixarBlob, type ZipEntry } from '../zip';
import EstrelasQualidade from './EstrelasQualidade';

interface KitTemplate {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  accent: string;
  alvoSkills: number;
  alvoAgents: number;
}

interface KitResumo {
  id: string;
  templateId: string;
  nome: string;
  descricao: string;
  skills: number;
  agents: number;
  justificativa: string;
  montadoPorLume: boolean;
  atualizadoEm: string;
}

interface DominioSeed {
  nome: string;
  descricao: string;
  objetivo: string;
}

interface KitMembro {
  id: string;
  nome: string;
  descricao: string;
  tema: string;
  estrelas: number;
  fonte: string;
}

interface KitFull {
  id: string;
  templateId: string;
  nome: string;
  descricao: string;
  justificativa: string;
  montadoPorLume: boolean;
  atualizadoEm: string;
  skills: KitMembro[];
  agents: KitMembro[];
}

type AlvoSO = 'unix' | 'win' | 'ambos';
type AlvoIDE = 'claude' | 'cursor' | 'portable';

// Cada IDE só muda a PASTA base — o layout (skills/<slug>/SKILL.md e agents/<nome>.md)
// é idêntico. O Cursor ainda lê .claude/ e .agents/ por compatibilidade.
const IDES: Record<AlvoIDE, { dir: string; label: string }> = {
  claude: { dir: '.claude', label: 'Claude Code' },
  cursor: { dir: '.cursor', label: 'Cursor' },
  portable: { dir: '.agents', label: 'Portável (.agents)' },
};

function slugify(s: string): string {
  return (s || 'item').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

// install.sh interativo do kit MISTO (skills em pastas + agents como .md soltos).
// Pergunta global (~/<dir>) vs projeto (./<dir>) e copia ambos. `dir`/`ide` vêm
// da ferramenta escolhida (.claude / .cursor / .agents).
function gerarInstallShKit(qtdSkills: number, qtdAgents: number, dir: string, ide: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

cat <<'BANNER'

  +-----------------------------------------------------------+
  |  Forja - instalar KIT no ${ide} (skills + agents)
  +-----------------------------------------------------------+

  ${qtdSkills} skill(s) e ${qtdAgents} agent(s) neste kit.

  Onde voce quer instalar?

    1) Global  ->  ~/${dir}/    (vale em todos os projetos)
    2) Projeto ->  ./${dir}/    (so este projeto, vai no git)

BANNER

read -p "  Escolha [1/2]: " escolha

case "\${escolha:-}" in
  1) BASE="\$HOME/${dir}" ;;
  2) BASE="\$(pwd)/${dir}" ;;
  *) echo "  Escolha invalida ('1' ou '2'). Saindo."; exit 1 ;;
esac

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

skills_count=0
if [ -d "\$SCRIPT_DIR/skills" ]; then
  mkdir -p "\$BASE/skills"
  for dir in "\$SCRIPT_DIR"/skills/*/; do
    [ -f "\$dir/SKILL.md" ] || continue
    slug="\$(basename "\$dir")"
    rm -rf "\$BASE/skills/\$slug"
    cp -r "\$dir" "\$BASE/skills/\$slug"
    echo "  skill  - \$slug"
    skills_count=\$((skills_count + 1))
  done
fi

agents_count=0
if [ -d "\$SCRIPT_DIR/agents" ]; then
  mkdir -p "\$BASE/agents"
  for f in "\$SCRIPT_DIR"/agents/*.md; do
    [ -f "\$f" ] || continue
    cp "\$f" "\$BASE/agents/\$(basename "\$f")"
    echo "  agent  - \$(basename "\$f")"
    agents_count=\$((agents_count + 1))
  done
fi

echo
echo "  OK - \$skills_count skills e \$agents_count agents instalados em:"
echo "       \$BASE"
echo
echo "  Reabra o ${ide} pra detectar as novidades."
`;
}

// install.ps1 — versão Windows (PowerShell) do instalador, equivalente ao .sh.
// Mesma lógica: pergunta global (~/<dir>) vs projeto (./<dir>) e copia ambos.
function gerarInstallPs1Kit(qtdSkills: number, qtdAgents: number, dir: string, ide: string): string {
  return `#Requires -Version 5
\$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '  ==========================================================='
Write-Host '   Forja - instalar KIT no ${ide} (skills + agents)'
Write-Host '  ==========================================================='
Write-Host ''
Write-Host '  ${qtdSkills} skill(s) e ${qtdAgents} agent(s) neste kit.'
Write-Host ''
Write-Host '  Onde voce quer instalar?'
Write-Host ''
Write-Host '    1) Global  ->  ~/${dir}/   (vale em todos os projetos)'
Write-Host '    2) Projeto ->  ./${dir}/   (so este projeto, vai no git)'
Write-Host ''
\$escolha = Read-Host '  Escolha [1/2]'

switch (\$escolha) {
  '1' { \$base = Join-Path \$HOME '${dir}' }
  '2' { \$base = Join-Path (Get-Location) '${dir}' }
  default { Write-Host "  Escolha invalida ('1' ou '2'). Saindo."; exit 1 }
}

\$scriptDir = Split-Path -Parent \$MyInvocation.MyCommand.Path

\$skillsCount = 0
\$skillsSrc = Join-Path \$scriptDir 'skills'
if (Test-Path \$skillsSrc) {
  \$dest = Join-Path \$base 'skills'
  New-Item -ItemType Directory -Force -Path \$dest | Out-Null
  Get-ChildItem -Path \$skillsSrc -Directory | ForEach-Object {
    if (Test-Path (Join-Path \$_.FullName 'SKILL.md')) {
      \$target = Join-Path \$dest \$_.Name
      if (Test-Path \$target) { Remove-Item -Recurse -Force \$target }
      Copy-Item -Recurse -Path \$_.FullName -Destination \$target
      Write-Host "  skill  - \$(\$_.Name)"
      \$skillsCount++
    }
  }
}

\$agentsCount = 0
\$agentsSrc = Join-Path \$scriptDir 'agents'
if (Test-Path \$agentsSrc) {
  \$dest = Join-Path \$base 'agents'
  New-Item -ItemType Directory -Force -Path \$dest | Out-Null
  Get-ChildItem -Path \$agentsSrc -Filter '*.md' -File | ForEach-Object {
    Copy-Item -Path \$_.FullName -Destination (Join-Path \$dest \$_.Name) -Force
    Write-Host "  agent  - \$(\$_.Name)"
    \$agentsCount++
  }
}

Write-Host ''
Write-Host "  OK - \$skillsCount skills e \$agentsCount agents instalados em:"
Write-Host "       \$base"
Write-Host ''
Write-Host '  Reabra o ${ide} pra detectar as novidades.'
`;
}

export default function KitsHubPanel(): React.ReactElement {
  const t = useTokens();
  const [templates, setTemplates] = useState<KitTemplate[]>([]);
  const [kits, setKits] = useState<KitResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [montando, setMontando] = useState<string | null>(null); // templateId em montagem
  const [aberto, setAberto] = useState<KitFull | null>(null);
  const [carregandoAberto, setCarregandoAberto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [escolhendoOS, setEscolhendoOS] = useState<KitFull | null>(null); // kit aguardando escolha de alvo
  const [ideSel, setIdeSel] = useState<AlvoIDE>('cursor');
  const [osSel, setOsSel] = useState<AlvoSO>(
    () => (typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent) ? 'win' : 'unix'),
  );
  const [seeds, setSeeds] = useState<DominioSeed[]>([]);
  const [novaColAberta, setNovaColAberta] = useState(false);
  const [colNome, setColNome] = useState('');
  const [colObjetivo, setColObjetivo] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [rt, rk, rd] = await Promise.all([
        callServer<ServerResult>('kitTemplatesList'),
        callServer<ServerResult>('kitsList'),
        callServer<ServerResult>('dominiosSeedList'),
      ]);
      if (rt.ok && rt.data) setTemplates(rt.data as KitTemplate[]);
      if (rk.ok && rk.data) setKits(rk.data as KitResumo[]);
      if (rd.ok && rd.data) setSeeds(rd.data as DominioSeed[]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar kits');
    } finally { setLoading(false); }
  };

  useEffect(() => { void carregar(); }, []);

  const kitPorTemplate = useMemo(() => {
    const m: Record<string, KitResumo> = {};
    for (const k of kits) if (k.templateId) m[k.templateId] = k;
    return m;
  }, [kits]);

  // Coleções = kits por domínio ("dominio:") ou por segmento ("segmento:",
  // gerados a partir das seções dos hubs de Skills/Agents).
  const colecoes = useMemo(
    () => kits.filter((k) => {
      const tid = String(k.templateId || '');
      return tid.startsWith('dominio:') || tid.startsWith('segmento:');
    }),
    [kits],
  );

  const montar = async (templateId: string) => {
    setMontando(templateId);
    const hide = message.loading('A Lume está montando o kit com as melhores skills + agents…', 0);
    try {
      const r = await callServer<ServerResult>('kitMontarComLume', templateId);
      if (r.ok) {
        const d = r.data as { id: string; skills: number; agents: number };
        message.success(`Kit montado: ${d.skills} skills + ${d.agents} agents.`);
        await carregar();
        void abrir(d.id);
      } else {
        message.error(r.error || 'Não consegui montar o kit');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao montar kit');
    } finally { hide(); setMontando(null); }
  };

  const montarDominio = async (nome: string, objetivo: string) => {
    const chave = `dominio:${nome}`;
    setMontando(chave);
    const hide = message.loading(`A Lume está montando a coleção "${nome}"…`, 0);
    try {
      const r = await callServer<ServerResult>('kitMontarDominio', nome, objetivo);
      if (r.ok) {
        const d = r.data as { id: string; skills: number; agents: number };
        message.success(`Coleção "${nome}": ${d.skills} skills + ${d.agents} agents.`);
        setNovaColAberta(false); setColNome(''); setColObjetivo('');
        await carregar();
        void abrir(d.id);
      } else {
        message.error(r.error || 'Não consegui montar a coleção');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao montar coleção');
    } finally { hide(); setMontando(null); }
  };

  const remontarSegmento = async (segKey: string, nomeKit: string) => {
    setMontando(`segmento:${segKey}`);
    const hide = message.loading(`A Lume está re-montando "${nomeKit}"…`, 0);
    try {
      const r = await callServer<ServerResult>('kitMontarSegmento', segKey, nomeKit.replace(/^Segmento\s*[—-]\s*/, ''));
      if (r.ok) {
        const d = r.data as { id: string; skills: number; agents: number };
        message.success(`Coleção re-montada: ${d.skills} skills + ${d.agents} agents.`);
        await carregar();
        void abrir(d.id);
      } else message.error(r.error || 'Não consegui re-montar');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao re-montar');
    } finally { hide(); setMontando(null); }
  };

  const removerColecao = async (kit: KitResumo) => {
    try {
      const r = await callServer<ServerResult>('kitRemover', kit.id);
      if (r.ok) { message.success(`Coleção "${kit.nome}" removida.`); await carregar(); }
      else message.error(r.error || 'Não consegui remover');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const abrir = async (id: string) => {
    setCarregandoAberto(true);
    try {
      const r = await callServer<ServerResult>('kitsGetContent', id);
      if (r.ok && r.data) setAberto(r.data as KitFull);
      else message.error((r && r.error) || 'Não foi possível abrir o kit');
    } finally { setCarregandoAberto(false); }
  };

  const exportarKit = async (kit: KitFull, alvo: AlvoSO, ide: AlvoIDE) => {
    setExportando(true);
    try {
      const r = await callServer<ServerResult>('kitExportar', kit.id);
      if (!r.ok || !r.data) { message.error((r && r.error) || 'Falha ao exportar'); return; }
      const d = r.data as {
        nome: string;
        skills: Array<{ nome: string; descricao: string; conteudo: string }>;
        agents: Array<{ nome: string; descricao: string; conteudo: string }>;
      };
      const { dir, label } = IDES[ide];
      const incluiSh = alvo === 'unix' || alvo === 'ambos';
      const incluiPs1 = alvo === 'win' || alvo === 'ambos';
      const linhasInstalar: string[] = [`## Instalar no ${label}`, ''];
      if (incluiSh) {
        linhasInstalar.push(
          '**macOS / Linux:** rode `bash install.sh`.',
          '',
        );
      }
      if (incluiPs1) {
        linhasInstalar.push(
          '**Windows (PowerShell):** rode `powershell -ExecutionPolicy Bypass -File install.ps1`.',
          '',
        );
      }
      linhasInstalar.push(
        `O instalador pergunta se você quer instalar global (\`~/${dir}/\`) ou só`,
        `neste projeto (\`./${dir}/\`). Skills vão pra \`skills/\` e agents pra \`agents/\`.`,
      );
      const entries: ZipEntry[] = [];
      const linhasReadme: string[] = [
        `# ${d.nome}`, '',
        kit.descricao || '', '',
        kit.justificativa ? `> ${kit.justificativa}` : '', '',
        `## Skills (${d.skills.length})`, '',
        ...d.skills.map((s) => `- ${s.nome}  \`skills/${slugify(s.nome)}/SKILL.md\``), '',
        `## Agents (${d.agents.length})`, '',
        ...d.agents.map((a) => `- ${a.nome}  \`agents/${slugify(a.nome)}.md\``), '',
        '---', '',
        ...linhasInstalar,
        '',
        '_Gerado pela Forja — Kit montado pela Lume._',
      ];
      entries.push({ path: 'README.md', content: linhasReadme.join('\n') });
      const usadosS = new Set<string>();
      const usadosA = new Set<string>();
      const nomeUnico = (base: string, set: Set<string>) => {
        let s = base; let n = 2;
        while (set.has(s)) { s = `${base}-${n}`; n++; }
        set.add(s); return s;
      };
      for (const s of d.skills) {
        const slug = nomeUnico(slugify(s.nome), usadosS);
        entries.push({ path: `skills/${slug}/SKILL.md`, content: s.conteudo });
      }
      for (const a of d.agents) {
        const slug = nomeUnico(slugify(a.nome), usadosA);
        entries.push({ path: `agents/${slug}.md`, content: a.conteudo });
      }
      if (incluiSh) entries.push({ path: 'install.sh', content: gerarInstallShKit(d.skills.length, d.agents.length, dir, label) });
      if (incluiPs1) entries.push({ path: 'install.ps1', content: gerarInstallPs1Kit(d.skills.length, d.agents.length, dir, label) });
      const blob = criarZipBlob(entries);
      baixarBlob(blob, `${slugify(d.nome)}-${ide}-kit.zip`);
      const dica = incluiPs1 && !incluiSh
        ? 'rode "install.ps1" no PowerShell pra instalar.'
        : 'rode "bash install.sh" pra instalar.';
      message.success(`Kit exportado pro ${label} (.zip) — ${dica}`);
      setEscolhendoOS(null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally { setExportando(false); }
  };

  const accentDe = (k: string): string => {
    const acc = t.accents as Record<string, string>;
    return acc[k] || t.accents.lavender;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        background: `${t.accents.peach}0d`, border: `1px solid ${t.accents.peach}33`,
        borderRadius: 12, padding: 16, marginBottom: 20,
        display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${t.accents.peach}1a`, color: t.accents.peach,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Wand2 size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>
            Kits dos sonhos — curados pela Lume
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, marginTop: 3 }}>
            Cada kit tem um objetivo fixo (ex.: começar um projeto do zero, full-stack web, AI dev).
            A <strong>Lume analisa sua base</strong> e escolhe as melhores skills <em>e</em> agents —
            priorizando as de mais estrelas — pra montar o conjunto ideal. Depois é só exportar o .zip.
            <br />
            <span style={{ color: t.textTertiary }}>
              Dica: avalie suas skills/agents com a Lume antes (nas estações Skills e Agents) — quanto mais itens com nota, melhor a curadoria.
            </span>
          </div>
        </div>
      </div>

      {loading && templates.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div>
      ) : templates.length === 0 ? (
        <Empty description="Nenhum template de kit disponível." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {templates.map((tpl) => {
            const kit = kitPorTemplate[tpl.id];
            const cor = accentDe(tpl.accent);
            const emMontagem = montando === tpl.id;
            return (
              <div
                key={tpl.id}
                style={{
                  background: t.surface, border: `1.5px solid ${kit ? `${cor}55` : t.border}`,
                  borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative', minHeight: 180,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${cor}1a`, color: cor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Layers size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>
                      {tpl.nome}
                    </div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                      alvo: ~{tpl.alvoSkills} skills · ~{tpl.alvoAgents} agents
                    </div>
                  </div>
                </div>

                <p style={{
                  margin: 0, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary,
                  lineHeight: 1.5, flex: 1,
                }}>
                  {tpl.descricao}
                </p>

                {kit ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Tag color="purple" style={{ fontFamily: FONTS.ui, fontSize: 11 }}>
                        <BookMarked size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{kit.skills} skills
                      </Tag>
                      <Tag color="blue" style={{ fontFamily: FONTS.ui, fontSize: 11 }}>
                        <Bot size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{kit.agents} agents
                      </Tag>
                      {kit.montadoPorLume && (
                        <Tag style={{ fontFamily: FONTS.ui, fontSize: 11 }}>
                          <Sparkles size={10} style={{ marginRight: 3, verticalAlign: -1 }} />Lume
                        </Tag>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="small" icon={<Eye size={13} />} onClick={() => abrir(kit.id)} style={{ flex: 1 }}>
                        Ver kit
                      </Button>
                      <Tooltip title="Re-monta com a Lume (sobrescreve a seleção atual deste kit).">
                        <Button
                          size="small" icon={<RefreshCw size={13} />}
                          loading={emMontagem} onClick={() => montar(tpl.id)}
                        >
                          Re-montar
                        </Button>
                      </Tooltip>
                    </div>
                  </>
                ) : (
                  <Button
                    type="primary"
                    icon={<Sparkles size={14} />}
                    loading={emMontagem}
                    onClick={() => montar(tpl.id)}
                    style={{ background: cor, borderColor: cor }}
                  >
                    {emMontagem ? 'Montando…' : 'Montar com a Lume'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Coleções por domínio de negócio ── */}
      <div style={{ marginTop: 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Briefcase size={17} color={t.accents.blue} />
          <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>
            Coleções por domínio
          </span>
          <Button
            type="primary" size="small" icon={<Plus size={14} />}
            onClick={() => setNovaColAberta(true)}
            style={{ marginLeft: 'auto', background: t.accents.blue, borderColor: t.accents.blue }}
          >
            Nova coleção
          </Button>
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
          Vai construir um produto de uma vertical (contabilidade, CRM, restaurante, pousada, condomínio…)?
          Descreva o projeto que a <strong>Lume monta a coleção</strong> de skills + agents ideal pra ele —
          combinando fundação técnica com o que é específico do domínio. Use um exemplo abaixo ou crie o seu.
        </div>

        {/* Coleções já montadas */}
        {colecoes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 16 }}>
            {colecoes.map((kit) => {
              const emMontagem = montando === `dominio:${kit.nome}`
                || montando === kit.templateId;
              return (
                <div key={kit.id} style={{
                  background: t.surface, border: `1.5px solid ${t.accents.blue}55`,
                  borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: `${t.accents.blue}1a`,
                      color: t.accents.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Briefcase size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>
                        {kit.nome}
                      </div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                        coleção por domínio
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5, flex: 1 }}>
                    {kit.descricao}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Tag color="purple" style={{ fontFamily: FONTS.ui, fontSize: 11 }}>
                      <BookMarked size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{kit.skills} skills
                    </Tag>
                    <Tag color="blue" style={{ fontFamily: FONTS.ui, fontSize: 11 }}>
                      <Bot size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{kit.agents} agents
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" icon={<Eye size={13} />} onClick={() => abrir(kit.id)} style={{ flex: 1 }}>
                      Ver
                    </Button>
                    <Tooltip title="Re-monta a coleção com a Lume.">
                      <Button
                        size="small" icon={<RefreshCw size={13} />} loading={emMontagem}
                        onClick={() => {
                          const tid = String(kit.templateId || '');
                          if (tid.startsWith('segmento:')) void remontarSegmento(tid.slice('segmento:'.length), kit.nome);
                          else void montarDominio(kit.nome, kit.descricao);
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="Remover coleção.">
                      <Button size="small" danger icon={<Trash2 size={13} />} onClick={() => removerColecao(kit)} />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sugestões (seeds) */}
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 10 }}>
          Exemplos pra começar
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {seeds.map((s) => {
            const emMontagem = montando === `dominio:${s.nome}`;
            const jaTem = colecoes.some((c) => c.nome === s.nome);
            return (
              <Tooltip key={s.nome} title={s.descricao}>
                <Button
                  size="small" icon={<Sparkles size={13} />} loading={emMontagem}
                  onClick={() => montarDominio(s.nome, s.objetivo)}
                  style={jaTem ? { borderColor: `${t.accents.blue}88`, color: t.accents.blue } : undefined}
                >
                  {s.nome}{jaTem ? ' ✓' : ''}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Modal: nova coleção por domínio */}
      <Modal
        open={novaColAberta}
        onCancel={() => !montando && setNovaColAberta(false)}
        width={520}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={17} color={t.accents.blue} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600 }}>Nova coleção por domínio</span>
          </span>
        }
        okText="Montar com a Lume"
        okButtonProps={{
          icon: <Sparkles size={14} />,
          loading: !!montando && String(montando).startsWith('dominio:'),
          disabled: !colNome.trim() || colObjetivo.trim().length < 8,
          style: { background: t.accents.blue, borderColor: t.accents.blue },
        }}
        onOk={() => void montarDominio(colNome.trim(), colObjetivo.trim())}
      >
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 6 }}>
            Nome do domínio / projeto
          </div>
          <Input
            placeholder="Ex.: Sistema de pousada"
            value={colNome}
            maxLength={80}
            onChange={(e) => setColNome(e.target.value)}
          />
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text, margin: '14px 0 6px' }}>
            Descreva o projeto pra Lume
          </div>
          <Input.TextArea
            placeholder="Ex.: Reservas com calendário de ocupação, check-in/out, tarifário por diária, cadastro de hóspedes e relatórios de ocupação."
            value={colObjetivo}
            maxLength={1200}
            autoSize={{ minRows: 4, maxRows: 8 }}
            onChange={(e) => setColObjetivo(e.target.value)}
          />
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
            Quanto mais específico (entidades, regras, telas), melhor a curadoria. A Lume vai puxar a base
            técnica + o que for específico da vertical + a melhor skill de design.
          </div>
        </div>
      </Modal>

      {/* Drawer: detalhe do kit */}
      <Drawer
        open={!!aberto || carregandoAberto}
        onClose={() => setAberto(null)}
        width={620}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Boxes size={18} color={t.accents.peach} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600 }}>{aberto?.nome || 'Kit'}</span>
          </span>
        }
        extra={aberto && (
          <Button type="primary" icon={<Package size={14} />} loading={exportando} onClick={() => setEscolhendoOS(aberto)}>
            Exportar .zip
          </Button>
        )}
      >
        {carregandoAberto && <Skeleton active paragraph={{ rows: 6 }} />}
        {aberto && (
          <>
            {aberto.justificativa && (
              <div style={{
                background: `${t.accents.peach}0d`, borderLeft: `4px solid ${t.accents.peach}`,
                borderRadius: 10, padding: 14, marginBottom: 18,
                fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6,
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4, color: t.accents.peach, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <Sparkles size={11} /> Por que a Lume escolheu
                </div>
                {aberto.justificativa}
              </div>
            )}

            <SecaoMembros titulo="Skills" icon={<BookMarked size={14} color={t.accents.lavender} />} membros={aberto.skills} />
            <SecaoMembros titulo="Agents" icon={<Bot size={14} color={t.accents.blue} />} membros={aberto.agents} />
          </>
        )}
      </Drawer>

      {/* Modal: escolha de IDE + SO antes de gerar o instalador */}
      <Modal
        open={!!escolhendoOS}
        onCancel={() => !exportando && setEscolhendoOS(null)}
        width={500}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Package size={17} color={t.accents.peach} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600 }}>Exportar kit</span>
          </span>
        }
        footer={[
          <Button key="cancel" onClick={() => setEscolhendoOS(null)} disabled={exportando}>Cancelar</Button>,
          <Button
            key="ok" type="primary" icon={<Package size={14} />} loading={exportando}
            onClick={() => escolhendoOS && void exportarKit(escolhendoOS, osSel, ideSel)}
          >
            Gerar .zip
          </Button>,
        ]}
      >
        <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, marginTop: 0 }}>
          O .zip leva os arquivos do kit + um instalador. As skills e agents são iguais
          em qualquer IDE — só muda a pasta de instalação e o script por sistema.
        </p>

        <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 8 }}>
          Pra qual IDE / ferramenta?
        </div>
        <Segmented
          block
          value={ideSel}
          onChange={(v) => setIdeSel(v as AlvoIDE)}
          options={[
            { value: 'cursor', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MousePointer2 size={13} /> Cursor</span>) },
            { value: 'claude', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Bot size={13} /> Claude Code</span>) },
            { value: 'portable', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Boxes size={13} /> Portável</span>) },
          ]}
        />
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 6, marginBottom: 18 }}>
          Instala em <code>~/{IDES[ideSel].dir}/</code>.{' '}
          {ideSel === 'portable'
            ? 'Pasta padrão aberta — Cursor e Claude Code leem dela.'
            : ideSel === 'cursor'
              ? 'O Cursor também lê .claude/ e .agents/ por compatibilidade.'
              : 'Formato nativo do Claude Code (também lido pelo Cursor).'}
        </div>

        <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 8 }}>
          Pra qual sistema?
        </div>
        <Segmented
          block
          value={osSel}
          onChange={(v) => setOsSel(v as AlvoSO)}
          options={[
            { value: 'unix', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Apple size={13} /> macOS / Linux</span>) },
            { value: 'win', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Monitor size={13} /> Windows</span>) },
            { value: 'ambos', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Layers size={13} /> Ambos</span>) },
          ]}
        />
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 6 }}>
          {osSel === 'unix'
            ? 'Gera install.sh (bash).'
            : osSel === 'win'
              ? 'Gera install.ps1 (PowerShell).'
              : 'Inclui os dois scripts no .zip — bom pra compartilhar com o time.'}
        </div>
      </Modal>
    </div>
  );
}

function SecaoMembros({ titulo, icon, membros }: {
  titulo: string;
  icon: React.ReactNode;
  membros: KitMembro[];
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {icon}
        <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>
          {titulo} ({membros.length})
        </span>
      </div>
      {membros.length === 0 ? (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, paddingLeft: 20 }}>
          Nenhum {titulo.toLowerCase()} neste kit.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {membros.map((m) => (
            <div
              key={m.id}
              style={{
                border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text, flex: 1 }}>
                  {m.nome}
                </span>
                {m.estrelas > 0 && <EstrelasQualidade valor={m.estrelas} size={11} />}
              </div>
              {m.descricao && (
                <div style={{
                  fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.45,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                }}>
                  {m.descricao}
                </div>
              )}
              {m.tema && (
                <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary }}>{m.tema}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
