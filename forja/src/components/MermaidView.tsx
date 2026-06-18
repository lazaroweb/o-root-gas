import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button, Tag, Tooltip } from 'antd';
import { ZoomIn, ZoomOut, Maximize2, Download, Move, AlertTriangle, Sparkles, Wand2 } from 'lucide-react';
import { useForja, useTokens } from '../themeContext';
import { FONTS } from '../theme';
import ObsidianMindmap from './ObsidianMindmap';

// ─── Auto-recuperação client-side ────────────────────────────────────────────
// Espelha o `_extrairMermaidBruto` do server.ts. Quando o code de entrada não
// é Mermaid válido (ex: JSON malformado, ```mermaid``` wrapper, texto solto),
// tenta extrair o bloco real automaticamente. Salva o usuário de ter que
// regenerar quando só o wrapper estava errado.
const KEYWORDS_MERMAID = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?|mindmap|gantt|pie|journey|gitGraph|timeline|quadrantChart|requirementDiagram|c4Context)\b/i;

function pareceMermaid(s: string): boolean {
  return !!s && KEYWORDS_MERMAID.test(s);
}

function extrairMermaidBruto(texto: string): string {
  const raw = String(texto || '');
  if (!raw.trim()) return '';

  // 1) Bloco ```mermaid explícito
  const blocoMermaid = raw.match(/```\s*mermaid\s*\n([\s\S]+?)```/i);
  if (blocoMermaid && blocoMermaid[1].trim()) return blocoMermaid[1].trim();

  // 2) Qualquer ``` ... ``` cujo conteúdo parece Mermaid
  const blocos = raw.match(/```\s*\n?([\s\S]+?)```/g) || [];
  for (const b of blocos) {
    const conteudo = b.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim();
    if (pareceMermaid(conteudo)) return conteudo;
  }

  // 3) Campo "mermaid":"..." em JSON quebrado
  const campo = raw.match(/"mermaid"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  if (campo && campo[1]) {
    const decoded = campo[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ');
    if (pareceMermaid(decoded)) return decoded.trim();
  }

  // 4) Primeira linha com keyword → fim
  const linhas = raw.split('\n');
  for (let i = 0; i < linhas.length; i++) {
    if (pareceMermaid(linhas[i])) {
      let bloco = linhas.slice(i).join('\n').trim();
      bloco = bloco.replace(/```[\s\S]*$/, '').trim();
      bloco = bloco.replace(/"\s*}\s*$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
      if (pareceMermaid(bloco)) return bloco;
    }
  }
  return '';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MermaidGlobal {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
}

interface SvgPanZoomInstance {
  destroy: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  resize: () => void;
  fit: () => void;
  center: () => void;
}

interface SvgPanZoomGlobal {
  (target: SVGSVGElement, options?: Record<string, unknown>): SvgPanZoomInstance;
}

function getMermaid(): MermaidGlobal | null {
  return (window as any).mermaid || null;
}

function getSvgPanZoom(): SvgPanZoomGlobal | null {
  return (window as any).svgPanZoom || null;
}

// ─── Tema escuro custom pro Mermaid ──────────────────────────────────────────
// O tema 'dark' default do Mermaid usa cinzas frios que destoam do nosso
// noturno (mais quente, peach/sage). themeVariables override pra alinhar.
function temaMermaidEscuro(): Record<string, string> {
  return {
    background: '#1B1D21',
    primaryColor: '#2A2D33',          // fundo dos nodes
    primaryTextColor: '#EAE7E1',      // texto dentro dos nodes
    primaryBorderColor: '#3A3D44',    // borda dos nodes
    lineColor: '#7E9DC4',             // setas/conexões — accent blue
    secondaryColor: '#2F2A26',
    tertiaryColor: '#26282C',
    // Texto auxiliar (labels, etc)
    secondaryTextColor: '#C5C0B6',
    tertiaryTextColor: '#9C988F',
    secondaryBorderColor: '#454850',
    tertiaryBorderColor: '#3A3D44',
    // Estados/notes
    noteBkgColor: '#2F2A26',
    noteTextColor: '#EAE7E1',
    noteBorderColor: '#4A453D',
    // Cluster (subgrafos)
    clusterBkg: '#22262C',
    clusterBorder: '#3A3D44',
    titleColor: '#EAE7E1',
    // Fluxo / labels de edge
    edgeLabelBackground: '#1B1D21',
    // ER/Class diagram — header e atributos
    nodeBkg: '#2A2D33',
    nodeBorder: '#3A3D44',
    nodeTextColor: '#EAE7E1',
    // ER: linhas de atributos alternadas — sem isso o default é #FFFFFF / #F5F5F5
    // (texto branco em fundo branco = invisível, era o bug do ER no noturno)
    attributeBackgroundColorOdd: '#26282C',
    attributeBackgroundColorEven: '#2F3137',
    // Sequence diagram
    actorBkg: '#2A2D33',
    actorBorder: '#3A3D44',
    actorTextColor: '#EAE7E1',
    actorLineColor: '#5A5D64',
    signalColor: '#EAE7E1',
    signalTextColor: '#EAE7E1',
    labelBoxBkgColor: '#2F2A26',
    labelBoxBorderColor: '#4A453D',
    labelTextColor: '#EAE7E1',
    loopTextColor: '#EAE7E1',
    activationBorderColor: '#7E9DC4',
    activationBkgColor: '#26282C',
  };
}

function temaMermaidClaro(): Record<string, string> {
  return {
    background: '#FBF8F2',
    primaryColor: '#FFFFFF',
    primaryTextColor: '#2A2724',
    primaryBorderColor: '#D9D2C4',
    lineColor: '#7E9DC4',
    secondaryColor: '#F1ECE3',
    tertiaryColor: '#F5F1EA',
    secondaryTextColor: '#5C5852',
    tertiaryTextColor: '#7A766F',
    titleColor: '#2A2724',
    noteBkgColor: '#FFF8EC',
    noteTextColor: '#2A2724',
    noteBorderColor: '#E9DDC0',
    clusterBkg: '#F5F1EA',
    clusterBorder: '#D9D2C4',
    edgeLabelBackground: '#FBF8F2',
    // ER: linhas alternadas, mantém claro mas legível
    attributeBackgroundColorOdd: '#FBF8F2',
    attributeBackgroundColorEven: '#F1ECE3',
  };
}

// ─── CSS extra injetado no SVG do Mermaid ────────────────────────────────────
// Algumas features (mindmap, ER attribute rows, edge labels) usam classes CSS
// internas que NÃO respondem a themeVariables. Aqui injetamos CSS via Mermaid's
// `themeCSS` config — fica scopado dentro do SVG, sem vazar pro resto do app.
//
// Casos cobertos:
//   1. Mindmap: nós em profundidade (.section-0, .section-1, .section-2...)
//      vinham com fundos brancos hardcoded — agora usam nossa paleta.
//   2. ER attribute rows: texto e fundo das linhas de atributo.
//   3. Edge labels: fundo do label de aresta.
//   4. ClassDiagram class titles e divisores — robustez extra.
function themeCSSEscuro(): string {
  // NOTA: estilo do mindmap NÃO mora aqui. Aplicado via JS pós-render em
  // `aplicarEstiloMindmap()` (inline-style com !important, máxima especificidade).
  // Aqui ficam só estilos pra outros diagramas (ER, classDiagram, sequence,
  // edge labels) — não corremos risco de race ou de classes variarem.
  return `
    /* ─── ER: header / atributos / footer das entidades ─── */
    .entityBox { fill: #2A2D33 !important; stroke: #3A3D44 !important; }
    .attributeBoxOdd  { fill: #26282C !important; }
    .attributeBoxEven { fill: #2F3137 !important; }
    .er .entityLabel,
    .er .entityLabel text { fill: #EAE7E1 !important; color: #EAE7E1 !important; }
    .er .relationshipLabelBox { fill: #1B1D21 !important; }
    .er .relationshipLabel { fill: #C5C0B6 !important; }
    /* Texto dentro das linhas de atributos do ER */
    g.nodes g.node text,
    g.nodes g.node tspan { fill: #EAE7E1 !important; }
    text.er.entityLabel { fill: #EAE7E1 !important; }

    /* ─── Edge labels: caixa de fundo do texto sobre aresta ─── */
    .edgeLabel,
    .edgeLabel rect,
    .edgeLabel span,
    .edgeLabel foreignObject div { background-color: #1B1D21 !important; fill: #EAE7E1 !important; color: #EAE7E1 !important; }
    .labelBkg { fill: #1B1D21 !important; opacity: 0.85 !important; }

    /* ─── ClassDiagram: cabeçalho/divisor das classes ─── */
    .classGroup line { stroke: #3A3D44 !important; }
    .classGroup text { fill: #EAE7E1 !important; }
    .classTitle { fill: #EAE7E1 !important; }
  `;
}

function themeCSSClaro(): string {
  // Mindmap NÃO mora aqui (ver themeCSSEscuro). Aqui só ajustes mínimos pros
  // outros diagramas que precisam de conforto extra no tema claro.
  return `
    .edgeLabel { background-color: #FBF8F2 !important; }
    .labelBkg { fill: #FBF8F2 !important; opacity: 0.85 !important; }
  `;
}

interface MermaidViewProps {
  code: string;
  // Altura mínima do canvas. Default 380px (versão antiga era 120).
  minHeight?: number;
  // Mostra a toolbar de zoom + download. Default true.
  showToolbar?: boolean;
  // Suprime o background "grade" tipo Miro (quando embeddado em painel já com bg).
  semGrade?: boolean;
  // Callback opcional: quando MermaidView recupera Mermaid de input "bagunçado",
  // o user pode tocar "Atualizar código" e propagamos a versão limpa pra upstream.
  onCodigoLimpo?: (mermaidLimpo: string) => void;
}

export default function MermaidView({
  code, minHeight = 380, showToolbar = true, semGrade = false, onCodigoLimpo,
}: MermaidViewProps): React.ReactElement {
  const { mode } = useForja();
  const t = useTokens();
  const ref = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<SvgPanZoomInstance | null>(null);
  // Contador incremental de renders. Cada chamada de renderizar captura o
  // valor atual; quando a promise async do mermaid resolve, comparamos —
  // se já houve novo render no meio tempo, descartamos o resultado (stale).
  // Isto previne race: gerou C1 → user gerou C2 enquanto C1 ainda processava
  // → C1 chegava depois e sobrescrevia o SVG de C2.
  const renderTokenRef = useRef(0);
  const [err, setErr] = useState<string | null>(null);

  // Detecta se o input precisa de auto-recuperação. Se já parece Mermaid puro,
  // usa direto. Se não, tenta extrair. `recuperado` é o booleano que ativa
  // o tag "Recuperado automaticamente" + botão de propagar a limpeza.
  const { codeEfetivo, recuperado } = useMemo(() => {
    const trimmed = (code || '').trim();
    if (!trimmed) return { codeEfetivo: '', recuperado: false };
    if (pareceMermaid(trimmed)) return { codeEfetivo: trimmed, recuperado: false };
    const extraido = extrairMermaidBruto(trimmed);
    if (extraido) return { codeEfetivo: extraido, recuperado: true };
    return { codeEfetivo: trimmed, recuperado: false }; // mermaid lib vai falhar e cair no estado de erro
  }, [code]);

  // Renderiza Mermaid + inicializa pan/zoom toda vez que codeEfetivo/mode muda.
  const renderizar = useCallback(() => {
    const m = getMermaid();
    if (!m) { setErr('A biblioteca de diagramas só carrega no app publicado.'); return; }

    // Marca novo token — invalida qualquer render em voo.
    const meuToken = ++renderTokenRef.current;
    // Limpa erro anterior — se este render funcionar, queremos ver o desenho.
    setErr(null);

    if (!codeEfetivo || !codeEfetivo.trim()) {
      if (ref.current) ref.current.innerHTML = '';
      if (panZoomRef.current) { panZoomRef.current.destroy(); panZoomRef.current = null; }
      setErr(null);
      return;
    }

    // Limpa instância anterior do pan/zoom (vaza memória se não)
    if (panZoomRef.current) {
      try { panZoomRef.current.destroy(); } catch { /* já destruído */ }
      panZoomRef.current = null;
    }

    try {
      m.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: mode === 'noturno' ? temaMermaidEscuro() : temaMermaidClaro(),
        // themeCSS: CSS injetado dentro do SVG. Resolve casos que themeVariables
        // não cobre (mindmap section levels, ER attribute rows, edge labels).
        themeCSS: mode === 'noturno' ? themeCSSEscuro() : themeCSSClaro(),
        securityLevel: 'strict',
        fontFamily: 'Inter, sans-serif',
        // htmlLabels=false → SVG text nativo. Mais previsível pra calcular
        // largura de nodes com texto multi-linha (evita o corte do antigo).
        // padding maior dá respiro. curve 'basis' segue.
        flowchart: {
          useMaxWidth: false,
          htmlLabels: false,
          curve: 'basis',
          padding: 16,
          nodeSpacing: 60,
          rankSpacing: 70,
          diagramPadding: 20,
        },
        sequence: { useMaxWidth: false, wrap: true, boxMargin: 12 },
        er: { useMaxWidth: false, layoutDirection: 'TB' },
        class: { useMaxWidth: false },
        // mindmap: padding generoso pra deixar texto respirar. maxNodeWidth
        // alto pra evitar quebra estranha. useMaxWidth=false pra svg-pan-zoom
        // pegar o tamanho real.
        mindmap: { useMaxWidth: false, padding: 24, maxNodeWidth: 240 },
      });

      const id = 'mmd-' + Math.random().toString(36).slice(2);
      m.render(id, codeEfetivo)
        .then(({ svg }) => {
          // Stale check: se outro render começou no meio tempo, descarta.
          if (meuToken !== renderTokenRef.current || !ref.current) return;
          ref.current.innerHTML = svg;
          setErr(null);

          // Inicializa pan/zoom no SVG renderizado. Atrasamos pra próximo
          // tick — assim o Mermaid já terminou de calcular bounding boxes e o
          // fit() do svg-pan-zoom pega a dimensão real (não a estimada).
          const svgEl = ref.current.querySelector('svg') as SVGSVGElement | null;
          if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.maxWidth = 'none';
            svgEl.style.cursor = 'grab';
            svgEl.removeAttribute('height');

            // ─── Refinamento mindmap (brute-force) ──────────────────────
            // Por que brute-force: as classes CSS do Mermaid pro mindmap
            // mudam de versão pra versão (.mindmap-node, .section-X, ou só
            // .node, .label — varia). Nossa abordagem CSS-only não pegou
            // todos os nodes na 11.x. Aqui detectamos via prefixo do code
            // ("mindmap") e iteramos TUDO no SVG, forçando inline-style com
            // !important (máxima especificidade, vence qualquer CSS interno).
            const ehMindmap = /^\s*mindmap\b/i.test(codeEfetivo);
            if (ehMindmap) {
              aplicarEstiloMindmap(svgEl, mode);
            }

            // ─── Safety net pra cores hardcoded no noturno (não-mindmap) ─
            // Mermaid às vezes emite fill="#FFFFFF" ou stroke="white" como
            // ATTRIBUTE SVG (não inline style) — CSS não pode override.
            // Substituímos esses casos manualmente pelos tokens do tema.
            // Skipa mindmap (já tratado acima).
            if (mode === 'noturno' && !ehMindmap) {
              const brancos = ['white', '#fff', '#FFF', '#ffffff', '#FFFFFF', 'rgb(255, 255, 255)', 'rgb(255,255,255)'];
              const naoCorrigir = (el: Element): boolean => !!el.closest('marker');
              svgEl.querySelectorAll('[fill]').forEach((el) => {
                if (naoCorrigir(el)) return;
                const f = el.getAttribute('fill') || '';
                if (brancos.indexOf(f) >= 0) el.setAttribute('fill', '#2A2D33');
              });
              svgEl.querySelectorAll('[stroke]').forEach((el) => {
                if (naoCorrigir(el)) return;
                const s = el.getAttribute('stroke') || '';
                if (brancos.indexOf(s) >= 0) el.setAttribute('stroke', '#3A3D44');
              });
              svgEl.querySelectorAll('[style]').forEach((el) => {
                if (naoCorrigir(el)) return;
                const st = el.getAttribute('style') || '';
                if (/fill\s*:\s*(white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i.test(st)) {
                  el.setAttribute('style', st.replace(/fill\s*:\s*(white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi, 'fill:#2A2D33'));
                }
              });
            }

            // Garante viewBox com margem extra — evita corte nas bordas
            // mesmo se algum node tiver texto longo. Lemos o bbox real.
            try {
              const bb = svgEl.getBBox();
              const margem = 24;
              svgEl.setAttribute('viewBox', `${bb.x - margem} ${bb.y - margem} ${bb.width + margem * 2} ${bb.height + margem * 2}`);
            } catch { /* getBBox pode falhar se SVG não está no DOM ainda — pan/zoom resolve */ }

            const spz = getSvgPanZoom();
            if (spz) {
              setTimeout(() => {
                // Mesmo check: se já houve novo render, abortar setup do pan/zoom
                if (meuToken !== renderTokenRef.current || !svgEl.isConnected) return;
                try {
                  panZoomRef.current = spz(svgEl, {
                    zoomEnabled: true,
                    panEnabled: true,
                    controlIconsEnabled: false,
                    fit: true,
                    center: true,
                    contain: false,
                    minZoom: 0.2,
                    maxZoom: 8,
                    zoomScaleSensitivity: 0.3,
                    dblClickZoomEnabled: true,
                  });
                  // Re-fit no próximo frame: às vezes o container ainda estava
                  // medindo zero no primeiro fit. Garante centralização correta.
                  requestAnimationFrame(() => {
                    if (panZoomRef.current) {
                      panZoomRef.current.resize();
                      panZoomRef.current.fit();
                      panZoomRef.current.center();
                    }
                  });
                } catch (e) { console.warn('svg-pan-zoom init:', e); }
              }, 50);
            }
          }
        })
        .catch((e: unknown) => {
          if (meuToken !== renderTokenRef.current) return;
          setErr(e instanceof Error ? e.message : 'Sintaxe Mermaid inválida');
        });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao renderizar');
    }
  }, [codeEfetivo, mode]);

  useEffect(() => {
    renderizar();
    return () => {
      // Invalida qualquer render em voo (próxima resolve será descartada)
      renderTokenRef.current++;
      if (panZoomRef.current) {
        try { panZoomRef.current.destroy(); } catch { /* ok */ }
        panZoomRef.current = null;
      }
    };
  }, [renderizar]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const acaoZoomIn = () => panZoomRef.current?.zoomIn();
  const acaoZoomOut = () => panZoomRef.current?.zoomOut();
  const acaoFit = () => {
    panZoomRef.current?.resetZoom();
    panZoomRef.current?.fit();
    panZoomRef.current?.center();
  };

  // Baixa SVG do diagrama (vetorial, qualidade infinita)
  const baixarSvg = () => {
    if (!ref.current) return;
    const svgEl = ref.current.querySelector('svg');
    if (!svgEl) return;
    // Clona, garante atributos, serializa
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagrama-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ─── Background grade tipo Miro (sutil) ────────────────────────────────────
  const corPonto = mode === 'noturno' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const gradeStyle: React.CSSProperties = semGrade ? {} : {
    backgroundImage: `radial-gradient(circle, ${corPonto} 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
  };

  // ─── Mindmap: render customizado tipo Obsidian ────────────────────────────
  // Pra mindmap usamos parser+layout próprio (ObsidianMindmap). Layout radial
  // do Mermaid + esconder caixas via JS dava espaçamento ruim porque o
  // algoritmo assumia espaço pras caixas. Nosso layout é desenhado pro estilo
  // dot+texto desde o início.
  if (codeEfetivo && /^\s*mindmap\b/i.test(codeEfetivo)) {
    return (
      <div style={{ position: 'relative', minHeight }}>
        <ObsidianMindmap
          code={codeEfetivo}
          minHeight={minHeight}
          showToolbar={showToolbar}
          semGrade={semGrade}
        />
        {/* Tag "Recuperado automaticamente" + botão pra atualizar o código upstream */}
        {recuperado && (
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip title="O texto original não era Mermaid puro. A Forja extraiu o desenho automaticamente.">
              <Tag
                icon={<Wand2 size={11} style={{ marginRight: 4 }} />}
                color="gold"
                style={{ borderRadius: 6, fontSize: 11, paddingInline: 8 }}
              >
                Recuperado automaticamente
              </Tag>
            </Tooltip>
            {onCodigoLimpo && (
              <Tooltip title="Substitui o texto bruto pelo Mermaid limpo no painel abaixo">
                <Button size="small" type="default" onClick={() => onCodigoLimpo(codeEfetivo)} style={{ fontSize: 11, height: 22, padding: '0 8px' }}>
                  Atualizar código
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Estado de erro ────────────────────────────────────────────────────────
  // Só cai aqui se NEM o code original NEM a versão recuperada renderizam.
  if (err) {
    const ehBruto = code && /^\s*[\[{]|^\s*```/m.test(code.trim().slice(0, 10));
    return (
      <div style={{
        background: t.surfaceMuted,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 20,
        minHeight,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12,
      }}>
        <AlertTriangle size={28} color={t.accents.peach} strokeWidth={1.6} />
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 15, fontWeight: 500,
            color: t.text, marginBottom: 6,
          }}>
            {ehBruto ? 'Resposta não estruturada' : 'Sintaxe Mermaid inválida'}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
            {ehBruto
              ? 'A IA respondeu em formato que não dá pra interpretar como diagrama. Tente re-gerar — modelos premium (Opus, Sonnet) tendem a respeitar melhor o formato.'
              : err}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render normal ─────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', minHeight }}>
      <div
        style={{
          background: t.surfaceMuted,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 0,
          minHeight,
          maxHeight: minHeight * 1.4,
          overflow: 'hidden',
          position: 'relative',
          ...gradeStyle,
        }}
      >
        {/* SVG container — pan/zoom é gerenciado pela lib */}
        <div
          ref={ref}
          style={{
            width: '100%',
            height: minHeight,
            display: codeEfetivo && codeEfetivo.trim() ? 'block' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!codeEfetivo || !codeEfetivo.trim() ? (
            <div style={{
              textAlign: 'center', color: t.textTertiary, fontSize: 13,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <Sparkles size={28} strokeWidth={1.3} color={t.textTertiary} />
              <div>Gere um diagrama ou cole código Mermaid pra ver aqui</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tag "Recuperado automaticamente" + botão pra atualizar o código upstream */}
      {recuperado && codeEfetivo && !err && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Tooltip title="O texto original não era Mermaid puro. A Forja extraiu o desenho automaticamente.">
            <Tag
              icon={<Wand2 size={11} style={{ marginRight: 4 }} />}
              color="gold"
              style={{ borderRadius: 6, fontSize: 11, paddingInline: 8 }}
            >
              Recuperado automaticamente
            </Tag>
          </Tooltip>
          {onCodigoLimpo && (
            <Tooltip title="Substitui o texto bruto pelo Mermaid limpo no painel abaixo">
              <Button
                size="small"
                type="default"
                onClick={() => onCodigoLimpo(codeEfetivo)}
                style={{ fontSize: 11, height: 22, padding: '0 8px' }}
              >
                Atualizar código
              </Button>
            </Tooltip>
          )}
        </div>
      )}

      {/* ─── Toolbar flutuante ─────────────────────────────────────────────── */}
      {showToolbar && codeEfetivo && codeEfetivo.trim() && !err && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', gap: 4, alignItems: 'center',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: '4px 6px',
          boxShadow: t.shadowSoft,
        }}>
          <Tooltip title="Diminuir zoom">
            <Button type="text" size="small" icon={<ZoomOut size={14} />} onClick={acaoZoomOut} />
          </Tooltip>
          <Tooltip title="Aumentar zoom">
            <Button type="text" size="small" icon={<ZoomIn size={14} />} onClick={acaoZoomIn} />
          </Tooltip>
          <Tooltip title="Centralizar e ajustar (Fit)">
            <Button type="text" size="small" icon={<Maximize2 size={14} />} onClick={acaoFit} />
          </Tooltip>
          <span style={{ width: 1, height: 18, background: t.borderSoft, margin: '0 2px' }} />
          <Tooltip title="Baixar como SVG (vetorial)">
            <Button type="text" size="small" icon={<Download size={14} />} onClick={baixarSvg} />
          </Tooltip>
        </div>
      )}

      {/* Dica de interação no canto inferior esquerdo (fade in nas primeiras renderizações) */}
      {showToolbar && codeEfetivo && codeEfetivo.trim() && !err && (
        <div style={{
          position: 'absolute', bottom: 10, left: 12,
          fontFamily: FONTS.mono, fontSize: 10.5,
          color: t.textTertiary,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: `${t.surface}cc`,
          padding: '3px 8px', borderRadius: 6,
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}>
          <Move size={11} /> arraste pra mover · scroll pra zoom · duplo-click pra zoom in
        </div>
      )}

    </div>
  );
}

// ─── Estilizador de mindmap (Obsidian-style) ─────────────────────────────────
// Inspirado no graph-view do Obsidian:
//   • Nodes viram DOTS circulares (root: 12px peach com glow; leaves: 4-6px
//     em accent suave)
//   • Caixas/retângulos do Mermaid: COMPLETAMENTE INVISÍVEIS
//   • Texto solto sobre o dot — Inter, hierarquia por cor e peso
//   • Linhas finas (1.5px) elegantes, cor sutil
//
// IMPORTANTE — porque a v1.6.3 não funcionou pros leaves:
// Mermaid 11.x dá `mindmap-node section-root` no root MAS só `section-N` nos
// leaves (SEM `mindmap-node`). Selector `g.mindmap-node` só achava o root.
// Solução: detectar nodes por ESTRUTURA (g com shape + texto como filhos
// diretos), não por classe. Funciona em qualquer versão.
function aplicarEstiloMindmap(svgEl: SVGSVGElement, mode: 'luz' | 'noturno'): void {
  const PEACH = '#D99B73';
  const SAGE = '#7FA98B';
  const BLUE = '#7E9DC4';
  const LAVENDER = '#9B8FC4';
  const CLAY = '#C2A37A';
  const ROSE = '#C98AA0';
  const CORES_NIVEL = [SAGE, BLUE, LAVENDER, CLAY, ROSE];

  const isDark = mode === 'noturno';
  const corTexto = isDark ? '#EAE7E1' : '#2A2724';
  const corTextoMute = isDark ? '#A8A49B' : '#7A766F';
  const corTextoRoot = isDark ? '#F5D8B8' : '#7A4A2A';
  const corBgCanvas = isDark ? '#1B1D21' : '#FBF8F2';
  const corEdge = isDark ? '#3A3D44' : '#D9D2C4';

  // ─── 0) <defs> com filtro de glow pro root (efeito Obsidian) ─────────────
  let defs = svgEl.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgEl.insertBefore(defs, svgEl.firstChild);
  }
  if (!svgEl.querySelector('#forja-mindmap-glow')) {
    defs.insertAdjacentHTML('beforeend', `
      <filter id="forja-mindmap-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `);
  }

  // ─── 1) DETECÇÃO DE NODES POR ESTRUTURA ──────────────────────────────────
  // Qualquer <g> que tem AO MESMO TEMPO (a) shape como filho direto E (b)
  // texto/foreignObject como filho direto OU descendente próximo = é um node.
  const TAGS_SHAPE = ['rect', 'polygon', 'ellipse', 'circle', 'path'];
  const TAGS_TEXTO = ['text', 'foreignobject'];
  const nodeGroups: Element[] = [];

  svgEl.querySelectorAll('g').forEach((g) => {
    // Skipa: container do SVG, edgeLabel, edges group, markers, defs
    if (g.closest('marker') || g.closest('defs')) return;
    const cls = g.getAttribute('class') || '';
    if (cls.includes('edgeLabel') || cls === 'edges' || cls === 'mindmap-edges') return;
    // Skipa o container ROOT do SVG (geralmente <g class="root"> envolvendo TUDO)
    if (cls.split(/\s+/).includes('root')) return;

    let temShape = false;
    let temTexto = false;
    Array.from(g.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (TAGS_SHAPE.includes(tag)) temShape = true;
      if (TAGS_TEXTO.includes(tag)) temTexto = true;
    });
    if (temShape && temTexto) {
      nodeGroups.push(g);
    }
  });

  // Helper: determina se é root e a profundidade pelo class
  const inspecionarNode = (cls: string): { isRoot: boolean; depth: number } => {
    if (cls.includes('section-root')) return { isRoot: true, depth: -1 };
    const m = cls.match(/section-(-?\d+)/);
    if (m) return { isRoot: false, depth: Math.max(0, parseInt(m[1], 10)) };
    // Sem classe section reconhecida — assume profundidade 0
    return { isRoot: false, depth: 0 };
  };

  // ─── 2) Processa cada node detectado ─────────────────────────────────────
  nodeGroups.forEach((node) => {
    const cls = node.getAttribute('class') || '';
    const { isRoot, depth } = inspecionarNode(cls);

    // A) Invisibiliza TODAS as formas de fundo (filhos diretos)
    //    Substitui style attribute INTEIRO — vence qualquer CSS interno
    Array.from(node.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (TAGS_SHAPE.includes(tag)) {
        // Skipa os dots que JÁ adicionamos antes (re-render)
        if ((child as Element).classList?.contains('forja-mindmap-dot')) return;
        child.setAttribute('style', 'display:none !important;');
      }
    });

    // B) Calcula posição do TEXTO (mais confiável que bbox do node inteiro)
    const textoEl = node.querySelector(':scope > text, :scope > foreignObject') as SVGGraphicsElement | null;
    let cx = 0; let cy = 0;
    if (textoEl) {
      try {
        const bb = textoEl.getBBox();
        cx = bb.x + bb.width / 2;
        cy = bb.y + bb.height / 2;
      } catch { /* fallback abaixo */ }
    }
    if (cx === 0 && cy === 0) {
      // Fallback: bbox do node inteiro
      try {
        const bb = (node as unknown as SVGGraphicsElement).getBBox();
        cx = bb.x + bb.width / 2;
        cy = bb.y + bb.height / 2;
      } catch { return; }
    }

    // C) Cria/atualiza o dot
    let dot = node.querySelector('circle.forja-mindmap-dot') as SVGCircleElement | null;
    if (!dot) {
      dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement;
      dot.setAttribute('class', 'forja-mindmap-dot');
      node.insertBefore(dot, node.firstChild);
    }
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    if (isRoot) {
      dot.setAttribute('r', '12');
      dot.setAttribute('fill', PEACH);
      dot.setAttribute('opacity', '0.95');
      dot.setAttribute('stroke', corBgCanvas);
      dot.setAttribute('stroke-width', '3');
      dot.setAttribute('filter', 'url(#forja-mindmap-glow)');
    } else {
      const cor = CORES_NIVEL[depth % CORES_NIVEL.length];
      const r = depth === 0 ? 6 : depth === 1 ? 5 : 4;
      dot.setAttribute('r', String(r));
      dot.setAttribute('fill', cor);
      dot.setAttribute('opacity', '0.85');
      dot.setAttribute('stroke', corBgCanvas);
      dot.setAttribute('stroke-width', '2');
      dot.removeAttribute('filter');
    }

    // D) Estiliza o texto (cor + peso + tamanho por hierarquia)
    let cor: string; let peso: number; let tam: number;
    if (isRoot) { cor = corTextoRoot; peso = 600; tam = 16; }
    else if (depth <= 1) { cor = corTexto; peso = 500; tam = 13; }
    else { cor = corTextoMute; peso = 500; tam = 12.5; }

    node.querySelectorAll('text, tspan, foreignObject div, foreignObject span').forEach((t) => {
      t.setAttribute('style',
        `fill:${cor} !important;color:${cor} !important;` +
        `font-family:'Inter','SF Pro Display',-apple-system,sans-serif !important;` +
        `font-weight:${peso} !important;font-size:${tam}px !important;` +
        `letter-spacing:-0.005em !important;`,
      );
    });
  });

  // ─── 3) Backup: nuke QUALQUER rect/polygon/ellipse remanescente ──────────
  // Caso a detecção por estrutura tenha perdido algum node (estrutura
  // diferente em alguma versão Mermaid), apagamos todos os shapes que NÃO
  // são nossos dots e NÃO estão em defs/marker/edgeLabel.
  svgEl.querySelectorAll('rect, polygon, ellipse').forEach((shape) => {
    if (shape.closest('marker') || shape.closest('defs')) return;
    if (shape.closest('.edgeLabel')) return;
    if ((shape as Element).classList?.contains('forja-mindmap-dot')) return;
    shape.setAttribute('style', 'display:none !important;');
  });
  // Paths inside node groups (não-edges): também nuke. Edges são paths
  // que NÃO estão dentro de nenhum node group detectado.
  const nodeSet = new Set(nodeGroups);
  svgEl.querySelectorAll('path').forEach((p) => {
    if (p.closest('marker') || p.closest('defs')) return;
    // Path está dentro de algum node detectado?
    let dentroNode = false;
    let ancestor: Element | null = p.parentElement;
    while (ancestor) {
      if (nodeSet.has(ancestor)) { dentroNode = true; break; }
      ancestor = ancestor.parentElement;
    }
    if (dentroNode) {
      // É shape de fundo do node — esconde
      p.setAttribute('style', 'display:none !important;');
    }
  });

  // ─── 4) Edges: paths que NÃO estão dentro de nenhum node ─────────────────
  svgEl.querySelectorAll('path, line, polyline').forEach((p) => {
    if (p.closest('marker') || p.closest('defs')) return;
    let dentroNode = false;
    let ancestor: Element | null = p.parentElement;
    while (ancestor) {
      if (nodeSet.has(ancestor)) { dentroNode = true; break; }
      ancestor = ancestor.parentElement;
    }
    if (dentroNode) return; // já tratado acima como shape interno
    p.setAttribute('style',
      `stroke:${corEdge} !important;stroke-width:1.5 !important;` +
      `fill:none !important;opacity:0.7 !important;` +
      `stroke-linecap:round !important;stroke-linejoin:round !important;`,
    );
  });
}
