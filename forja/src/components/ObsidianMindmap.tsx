import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Tooltip } from 'antd';
import { ZoomIn, ZoomOut, Maximize2, Download, Move, AlertTriangle, Expand, X } from 'lucide-react';
import { useForja, useTokens } from '../themeContext';
import { FONTS, ACCENTS, ACCENTS_NOTURNO } from '../theme';

// ─── ObsidianMindmap ─────────────────────────────────────────────────────────
// Render próprio de mindmap inspirado no graph-view do Obsidian.
//
// Por que existir (não usamos o do Mermaid):
//   • Layout radial do Mermaid assume nodes-como-caixas — quando escondemos as
//     caixas, fica visualmente apertado (espaçamento foi calculado pra boxes).
//   • Mermaid não dá controle fino de hierarquia visual nem permite estilos
//     orgânicos como dots+glow do Obsidian.
//
// O que faz:
//   1. Parsea sintaxe Mermaid mindmap por indentação (((round)), [box], etc.)
//   2. Layout radial INTELIGENTE: cada subtree recebe arc proporcional ao seu
//      tamanho (mais filhos = mais espaço); raio cresce por nível.
//   3. Renderiza SVG nativo: dots coloridos por profundidade, root com glow,
//      texto posicionado PARA FORA do dot (na direção oposta à raiz), curvas
//      Bézier suaves entre parent e child.
//   4. Pan/zoom via svg-pan-zoom (já carregado globalmente).

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface MindNode {
  id: string;
  text: string;
  depth: number;
  children: MindNode[];
  parent: MindNode | null;
  // Layout (preenchido depois)
  x: number;
  y: number;
  // Ângulo do node em relação ao root — usado pra posicionar o texto.
  angle: number;
  // Estimativa de largura do texto em px — pra cálculo de raio mínimo.
  textWidth: number;
  // Velocity pra simulação física (preenchido em runtime, não no parse)
  vx?: number;
  vy?: number;
}

// ─── Parser ─────────────────────────────────────────────────────────────────
// Sintaxe do mindmap do Mermaid:
//   mindmap
//     root((Forja))                  ← raiz com shape round
//       Sistemas                     ← child (texto puro)
//         Auditoria de saúde         ← grand-child
//       Clientes
//         (CRM leve)                 ← rounded
//         [Empresas]                 ← box
//   Outras shapes suportadas: ((round)), ((cloud)), {{hexagon}}, )bang(

function parseMindmap(code: string): MindNode | null {
  const linhas = code.split('\n');
  // Pula linhas vazias e a linha "mindmap" inicial
  let idx = 0;
  while (idx < linhas.length) {
    const l = linhas[idx];
    if (!l.trim() || /^\s*mindmap\b/i.test(l)) { idx++; continue; }
    break;
  }
  if (idx >= linhas.length) return null;

  const stack: { node: MindNode; indent: number }[] = [];
  let root: MindNode | null = null;
  let counter = 0;

  for (let i = idx; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha.trim()) continue;

    // Indent = nº de espaços/tabs no início. Tab conta como 4.
    const m = linha.match(/^([\s\t]*)(.*)$/);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '    ').length;
    let texto = m[2].trim();

    // Remove prefixo opcional tipo "id1[" (ex: rootNode((Forja)))
    texto = texto.replace(/^[\w-]+(?=[\[\(\{\)])/, '');
    // Strip shapes: tenta cada padrão em ordem
    const patterns = [
      /^\(\((.+?)\)\)$/,  // ((text))
      /^\[(.+?)\]$/,       // [text]
      /^\{\{(.+?)\}\}$/,   // {{text}}
      /^\)(.+?)\($/,       // )text(
      /^\((.+?)\)$/,       // (text)
    ];
    for (const p of patterns) {
      const mm = texto.match(p);
      if (mm) { texto = mm[1]; break; }
    }
    texto = texto.trim();
    if (!texto) continue;

    const node: MindNode = {
      id: `n${counter++}`,
      text: texto,
      depth: 0,
      children: [],
      parent: null,
      x: 0, y: 0, angle: 0,
      // Estimativa rough da largura: 0.6 * fontSize por char
      textWidth: Math.max(60, texto.length * 8),
    };

    if (!root) {
      root = node;
      stack.push({ node, indent });
      continue;
    }

    // Pop stack até achar parent (com indent menor)
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Linha tem indent menor que root — vira filha do root mesmo assim
      node.parent = root;
      node.depth = 1;
      root.children.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      node.parent = parent;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    }
    stack.push({ node, indent });
  }

  return root;
}

// ─── Layout radial ──────────────────────────────────────────────────────────
// Algoritmo:
//   • Root em (0,0)
//   • L1 distribuído em círculo completo (360°)
//   • Para cada child, arc alocado = (arc total do pai) * (leaves no subtree / total)
//   • Raio cresce por nível, mas tb ajusta pelo número de siblings (mais
//     siblings = raio maior pra dar espaço)
//
// Resultado: nodes com subtrees maiores ganham mais espaço angular;
// raio adapta pra evitar overlap.

interface LayoutBounds {
  minX: number; minY: number; maxX: number; maxY: number;
}

function layoutRadial(root: MindNode): LayoutBounds {
  // Conta folhas em cada subtree (cached pra performance)
  const leavesCache = new Map<string, number>();
  function countLeaves(n: MindNode): number {
    if (leavesCache.has(n.id)) return leavesCache.get(n.id)!;
    const v = n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
    leavesCache.set(n.id, v);
    return v;
  }

  root.x = 0; root.y = 0; root.angle = 0;

  function layoutChildren(node: MindNode, startAngle: number, endAngle: number, parentRadius: number): void {
    if (node.children.length === 0) return;

    const totalLeaves = countLeaves(node);
    const arcDisponivel = endAngle - startAngle;
    // Largura média do texto dos filhos → raio mínimo pra evitar overlap
    const larguraMedia = node.children.reduce((s, c) => s + c.textWidth, 0) / node.children.length;
    // Circunferência necessária pros filhos respirarem (espaço por filho ~ largura texto + padding)
    const circunferenciaNecessaria = node.children.length * (larguraMedia + 40);
    const raioMinimo = circunferenciaNecessaria / arcDisponivel;
    // Step base por nível
    const stepBase = 220;
    const raio = Math.max(parentRadius + stepBase, parentRadius + raioMinimo * 0.5);

    let anguloAtual = startAngle;
    for (const child of node.children) {
      const childLeaves = countLeaves(child);
      // Arc proporcional ao tamanho do subtree (subtree maior = mais espaço)
      const arc = (arcDisponivel * childLeaves) / totalLeaves;
      const anguloChild = anguloAtual + arc / 2;

      child.angle = anguloChild;
      child.x = raio * Math.cos(anguloChild);
      child.y = raio * Math.sin(anguloChild);

      // Recursão — child aloca o arc que recebeu
      layoutChildren(child, anguloAtual, anguloAtual + arc, raio);

      anguloAtual += arc;
    }
  }

  // Começa do topo (-π/2) pra simetria visual
  layoutChildren(root, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 0);

  // Calcula bounds
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  function visit(n: MindNode): void {
    minX = Math.min(minX, n.x - n.textWidth / 2);
    maxX = Math.max(maxX, n.x + n.textWidth / 2);
    minY = Math.min(minY, n.y - 20);
    maxY = Math.max(maxY, n.y + 20);
    n.children.forEach(visit);
  }
  visit(root);

  // Margem extra
  const m = 80;
  return { minX: minX - m, minY: minY - m, maxX: maxX + m, maxY: maxY + m };
}

function achatar(root: MindNode): MindNode[] {
  const r: MindNode[] = [];
  function visit(n: MindNode): void { r.push(n); n.children.forEach(visit); }
  visit(root);
  return r;
}

// ─── Simulação física (force-directed) ──────────────────────────────────────
// Cada tick aplica três forças e atualiza posições. Retorna a energia
// cinética total — quando cai abaixo de um threshold, o loop pode parar.
//
// Forças:
//   • Repulsão (Coulomb): cada par de nodes se repele, intensidade ∝ 1/dist²
//   • Spring (Hooke): edges puxam parent↔child pra uma distância ideal
//   • Centering: leve puxão pro origin pra rede não driftar
//
// Root é FIXO em (0,0) — âncora visual e do sistema.
// Node sendo arrastado também é fixo (segue o cursor).

interface PhysicsEdge { from: MindNode; to: MindNode }

function passoSimulacao(
  nodes: MindNode[],
  edges: PhysicsEdge[],
  draggingId: string | null,
): number {
  const REPEL = 9000;             // intensidade da repulsão entre nodes
  const SPRING_K = 0.025;          // rigidez do spring nas edges
  const SPRING_LENGTH = 180;       // distância "ideal" entre parent e child
  const DAMPING = 0.82;            // amortecimento da velocidade (0-1)
  const MAX_VEL = 25;              // cap pra evitar explosões

  // Acumuladores de força por node
  const forces = new Map<string, { fx: number; fy: number }>();
  for (const n of nodes) forces.set(n.id, { fx: 0, fy: 0 });

  // 1) Repulsão entre TODOS os pares
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy + 0.01;
      const dist = Math.sqrt(dist2);
      const f = REPEL / dist2;
      const fxN = (f * dx) / dist;
      const fyN = (f * dy) / dist;
      const fa = forces.get(a.id)!;
      const fb = forces.get(b.id)!;
      fa.fx += fxN; fa.fy += fyN;
      fb.fx -= fxN; fb.fy -= fyN;
    }
  }

  // 2) Spring nas edges (parent ↔ child)
  for (const e of edges) {
    const dx = e.to.x - e.from.x;
    const dy = e.to.y - e.from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const delta = dist - SPRING_LENGTH;
    const f = SPRING_K * delta;
    const fx = (f * dx) / dist;
    const fy = (f * dy) / dist;
    forces.get(e.from.id)!.fx += fx;
    forces.get(e.from.id)!.fy += fy;
    forces.get(e.to.id)!.fx -= fx;
    forces.get(e.to.id)!.fy -= fy;
  }

  // 3) Aplica forças e atualiza posições
  let energia = 0;
  for (const n of nodes) {
    // Root: fixo no centro, âncora
    if (n.depth === 0) { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
    // Sendo arrastado: posição vem do handler, não da física
    if (n.id === draggingId) { n.vx = 0; n.vy = 0; continue; }

    const f = forces.get(n.id)!;
    let vx = ((n.vx || 0) + f.fx) * DAMPING;
    let vy = ((n.vy || 0) + f.fy) * DAMPING;
    // Cap pra evitar explosões em casos extremos
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_VEL) { vx = (vx / speed) * MAX_VEL; vy = (vy / speed) * MAX_VEL; }
    n.vx = vx;
    n.vy = vy;
    n.x += vx;
    n.y += vy;
    energia += vx * vx + vy * vy;
  }
  return energia;
}

// ─── svg-pan-zoom (global) ──────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
interface PanZoomInstance {
  destroy: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  resize: () => void;
  fit: () => void;
  center: () => void;
  disablePan?: () => void;
  enablePan?: () => void;
  getZoom?: () => number;
  getPan?: () => { x: number; y: number };
}
function getSvgPanZoom(): ((target: SVGSVGElement, opts?: Record<string, unknown>) => PanZoomInstance) | null {
  return (window as any).svgPanZoom || null;
}

// ─── Wrapper export: gerencia modal expand ──────────────────────────────────

interface ObsidianMindmapProps {
  code: string;
  minHeight?: number;
  showToolbar?: boolean;
  semGrade?: boolean;
}

export default function ObsidianMindmap(props: ObsidianMindmapProps): React.ReactElement {
  const [expandido, setExpandido] = useState(false);
  const { mode } = useForja();
  const t = useTokens();
  // No modal, canvas ocupa quase a tela toda. Calcula 80vh, mas usa fallback
  // 700 se window não estiver disponível (SSR / unit test).
  const alturaModal = typeof window !== 'undefined'
    ? Math.max(500, Math.round(window.innerHeight * 0.82))
    : 700;

  return (
    <>
      <MindmapCanvas {...props} onExpand={() => setExpandido(true)} />
      <Modal
        open={expandido}
        onCancel={() => setExpandido(false)}
        width="96vw"
        footer={null}
        centered
        destroyOnClose
        closeIcon={<X size={18} strokeWidth={1.6} color={t.textSecondary} />}
        title={(
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text,
          }}>
            <span style={{
              display: 'inline-flex', color: t.accents.peach,
            }}>
              <Expand size={16} strokeWidth={1.7} />
            </span>
            Mindmap expandido
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary,
              fontWeight: 400, marginLeft: 4,
            }}>
              · {mode === 'noturno' ? 'tema noturno' : 'tema claro'}
            </span>
          </div>
        )}
        styles={{
          body: { padding: 0, background: t.surface },
          header: { background: t.surface, borderBottom: `1px solid ${t.borderSoft}`, padding: '14px 20px', marginBottom: 0 },
          content: { background: t.surface, padding: 0 },
        }}
      >
        <div style={{ padding: 16, background: t.surface }}>
          <MindmapCanvas {...props} minHeight={alturaModal} showToolbar />
        </div>
      </Modal>
    </>
  );
}

// ─── Canvas (renderer puro) ─────────────────────────────────────────────────
// Componente interno que faz parse + layout + render do mindmap.
// Não tem lógica de modal — só desenha. Reutilizado tanto na view normal
// quanto dentro do Modal expandido (com minHeight diferente).

interface MindmapCanvasProps extends ObsidianMindmapProps {
  onExpand?: () => void;
}

function MindmapCanvas({
  code, minHeight = 380, showToolbar = true, semGrade = false, onExpand,
}: MindmapCanvasProps): React.ReactElement {
  const { mode } = useForja();
  const t = useTokens();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panZoomRef = useRef<PanZoomInstance | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Parse + layout (radial inicial)
  const { nodes, edges, bounds } = useMemo(() => {
    try {
      const root = parseMindmap(code);
      if (!root) {
        setErro('Mindmap vazio ou inválido');
        return { nodes: [], edges: [] as PhysicsEdge[], bounds: null };
      }
      const b = layoutRadial(root);
      const flat = achatar(root);
      // Constrói lista de edges pra simulação física (mais rápido que iterar
      // children de cada node a cada tick)
      const eds: PhysicsEdge[] = flat
        .filter((n) => n.parent)
        .map((n) => ({ from: n.parent!, to: n }));
      setErro(null);
      return { nodes: flat, edges: eds, bounds: b };
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar mindmap');
      return { nodes: [], edges: [] as PhysicsEdge[], bounds: null };
    }
  }, [code]);

  // ─── Física + drag (Obsidian-style) ──────────────────────────────────────
  // tick: state booleano alternado pra forçar re-render quando nodes mudam.
  // Mantemos nodes mutáveis (via useMemo) e usamos tick pra propagar pro DOM.
  const [tick, setTick] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Offset entre cursor e centro do node no momento que iniciou o drag.
  // Sem isso o node "pula" pra grudar no cursor.
  const dragOffsetRef = useRef<{ ox: number; oy: number } | null>(null);
  // Tempo da última interação — pra deixar física rodar mais alguns ms depois
  // do release, dando settle suave.
  const lastInteractionRef = useRef<number>(0);

  // Helper: converte coord de tela (clientX/Y) pra coord SVG do viewport.
  // svg-pan-zoom envolve conteúdo num <g class="svg-pan-zoom_viewport">, e
  // getScreenCTM nessa g já inclui o transform de pan/zoom.
  const clienteParaSvg = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const vp = (svg.querySelector('.svg-pan-zoom_viewport') as SVGGraphicsElement | null) || (svg as unknown as SVGGraphicsElement);
    const ctm = vp.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY);
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  };

  // Loop de animação. Roda enquanto está arrastando OU enquanto há energia
  // suficiente (sistema settling). Para sozinho quando o sistema esfria.
  useEffect(() => {
    if (nodes.length === 0) return;
    let rafId = 0;
    let ticksSemEnergia = 0;
    const ENERGIA_MIN = 0.5;
    const TICKS_MAX_INERCIA = 90; // ~1.5s a 60fps depois de soltar

    const loop = (): void => {
      const ativo = draggingId !== null;
      const energia = passoSimulacao(nodes, edges, draggingId);
      if (ativo || energia > ENERGIA_MIN) {
        ticksSemEnergia = 0;
        setTick((p) => (p + 1) % 1_000_000);
        rafId = requestAnimationFrame(loop);
      } else {
        // Continua mais alguns ticks pra suavizar o stop
        ticksSemEnergia++;
        if (ticksSemEnergia < TICKS_MAX_INERCIA && Date.now() - lastInteractionRef.current < 2500) {
          setTick((p) => (p + 1) % 1_000_000);
          rafId = requestAnimationFrame(loop);
        }
        // senão: para o loop, render fica congelado nas posições atuais
      }
    };
    // Só inicia se está arrastando OU houve interação recente
    if (draggingId !== null || Date.now() - lastInteractionRef.current < 2500) {
      rafId = requestAnimationFrame(loop);
    }
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [draggingId, nodes, edges]);

  // Handler de drag — pointer events cobrem mouse + touch + pen.
  //
  // PORQUE precisa preventDefault: o svg-pan-zoom escuta MOUSE events
  // tradicionais (mousedown/mousemove). Stopping propagation no pointer
  // event NÃO impede que mouse events compatíveis sejam gerados depois
  // e bubblem pro SVG root. Chamar preventDefault no pointerdown
  // SUPRIME os mouse events derivados — o pan/zoom não recebe nada.
  const handlePointerDown = (e: React.PointerEvent, nodeId: string): void => {
    if (e.button !== 0) return; // só botão esquerdo / toque
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.depth === 0) return; // root é âncora, não arrasta
    // Desabilita pan ANTES de qualquer coisa pra cobrir race conditions
    try { panZoomRef.current?.disablePan?.(); } catch { /* ok */ }
    const local = clienteParaSvg(e.clientX, e.clientY);
    dragOffsetRef.current = { ox: local.x - node.x, oy: local.y - node.y };
    setDraggingId(nodeId);
    lastInteractionRef.current = Date.now();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
  };

  // Bloqueador adicional pra mouse events que escapam (reforço duplo do
  // preventDefault acima — alguns navegadores podem ainda gerar o mousedown
  // se o pointerdown não tiver sido cancelável)
  const bloquearMouse = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    if (draggingId === null) return;
    const onMove = (ev: PointerEvent): void => {
      const node = nodes.find((n) => n.id === draggingId);
      const off = dragOffsetRef.current;
      if (!node || !off) return;
      const local = clienteParaSvg(ev.clientX, ev.clientY);
      node.x = local.x - off.ox;
      node.y = local.y - off.oy;
      node.vx = 0; node.vy = 0;
      lastInteractionRef.current = Date.now();
    };
    const onUp = (): void => {
      setDraggingId(null);
      dragOffsetRef.current = null;
      lastInteractionRef.current = Date.now();
      panZoomRef.current?.enablePan?.();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId, nodes]);

  // suprime warning de unused (tick é só pra forçar re-render)
  void tick;

  // Inicializa pan/zoom quando SVG renderizar/mudar
  useEffect(() => {
    if (!svgRef.current || !bounds) return;
    const spz = getSvgPanZoom();
    if (!spz) return;
    // Limpa instância anterior
    if (panZoomRef.current) {
      try { panZoomRef.current.destroy(); } catch { /* ok */ }
      panZoomRef.current = null;
    }
    // Timeout pra DOM settle
    const tid = setTimeout(() => {
      if (!svgRef.current) return;
      try {
        panZoomRef.current = spz(svgRef.current, {
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
        requestAnimationFrame(() => {
          if (panZoomRef.current) {
            panZoomRef.current.resize();
            panZoomRef.current.fit();
            panZoomRef.current.center();
          }
        });
      } catch (e) { console.warn('pan/zoom init:', e); }
    }, 50);
    return () => {
      clearTimeout(tid);
      if (panZoomRef.current) {
        try { panZoomRef.current.destroy(); } catch { /* ok */ }
        panZoomRef.current = null;
      }
    };
  }, [bounds, code]);

  // ─── Paleta e tokens ──────────────────────────────────────────────────────
  const PEACH = '#D99B73';
  const accents = mode === 'noturno' ? ACCENTS_NOTURNO : ACCENTS;
  const coresNivel = [accents.sage, accents.blue, accents.lavender, accents.clay, accents.rose];
  const isDark = mode === 'noturno';
  const corText = isDark ? '#EAE7E1' : '#2A2724';
  const corTextMute = isDark ? '#A8A49B' : '#7A766F';
  const corTextRoot = isDark ? '#F5D8B8' : '#7A4A2A';
  const corBgCanvas = isDark ? '#1B1D21' : '#FBF8F2';
  const corEdge = isDark ? '#3A3D44' : '#D9D2C4';

  // ─── Actions toolbar ──────────────────────────────────────────────────────
  const acaoZoomIn = (): void => panZoomRef.current?.zoomIn();
  const acaoZoomOut = (): void => panZoomRef.current?.zoomOut();
  const acaoFit = (): void => {
    panZoomRef.current?.resetZoom();
    panZoomRef.current?.fit();
    panZoomRef.current?.center();
  };
  const baixarSvg = (): void => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Embeda fundo da canvas como <rect> de fundo — assim o SVG fica legível
    // em qualquer visualizador (texto cream em fundo escuro). Sem isso, ao
    // abrir o .svg standalone, texto claro some em background branco padrão.
    const vb = clone.getAttribute('viewBox')?.split(' ').map(parseFloat);
    if (vb && vb.length === 4) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', String(vb[0]));
      bg.setAttribute('y', String(vb[1]));
      bg.setAttribute('width', String(vb[2]));
      bg.setAttribute('height', String(vb[3]));
      bg.setAttribute('fill', corBgCanvas);
      clone.insertBefore(bg, clone.firstChild);
    }
    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mindmap-${Date.now()}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ─── Background grade Miro-like ───────────────────────────────────────────
  const corPonto = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const gradeStyle: React.CSSProperties = semGrade ? {} : {
    backgroundImage: `radial-gradient(circle, ${corPonto} 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
  };

  // ─── Estado de erro ───────────────────────────────────────────────────────
  if (erro || !bounds || nodes.length === 0) {
    return (
      <div style={{
        background: t.surfaceMuted,
        border: `1px solid ${t.border}`,
        borderRadius: 12, padding: 20, minHeight,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12,
      }}>
        <AlertTriangle size={28} color={t.accents.peach} strokeWidth={1.6} />
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text, marginBottom: 6 }}>
            Mindmap vazio
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
            {erro || 'Não conseguimos extrair nenhum node do código. Gera um novo ou cola um Mermaid mindmap válido.'}
          </div>
        </div>
      </div>
    );
  }

  // viewBox FIXO com padding generoso. Não pode ser dinâmico senão briga com
  // o transform interno do svg-pan-zoom. Se o usuário arrastar um node pra
  // fora desse perímetro, ele pode panear/zoomar pra alcançar.
  const padding = Math.max(120, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.4);
  const width = (bounds.maxX - bounds.minX) + padding * 2;
  const height = (bounds.maxY - bounds.minY) + padding * 2;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}`;

  return (
    <div style={{ position: 'relative', minHeight }}>
      <div style={{
        background: t.surfaceMuted,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 0,
        minHeight,
        maxHeight: minHeight * 1.4,
        overflow: 'hidden',
        position: 'relative',
        ...gradeStyle,
      }}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: minHeight, display: 'block', cursor: 'grab' }}
        >
          <defs>
            <filter id="forja-obsidian-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ─── Edges: curvas Bézier suaves ──────────────────────────── */}
          {nodes.filter((n) => n.parent).map((n) => {
            const p = n.parent!;
            // Curva: ponto de controle = ponto médio puxado um pouco em direção
            // ao raio (cria efeito orgânico ao invés de linha reta)
            const midX = (p.x + n.x) / 2;
            const midY = (p.y + n.y) / 2;
            // Empurra o controle pro ângulo bissetriz pra dar curva suave
            const d = `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
            return (
              <path
                key={`e-${n.id}`}
                d={d}
                fill="none"
                stroke={corEdge}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}

          {/* ─── Nodes: dot + texto ───────────────────────────────────── */}
          {nodes.map((n) => {
            const isRoot = n.depth === 0;
            const corDot = isRoot ? PEACH : coresNivel[(n.depth - 1) % coresNivel.length];
            const r = isRoot ? 11 : n.depth === 1 ? 6 : n.depth === 2 ? 5 : 4;

            // Texto: posicionado PARA FORA (na direção oposta à raiz)
            const cosA = Math.cos(n.angle);
            const sinA = Math.sin(n.angle);
            const offset = r + 9;
            const textX = isRoot ? n.x : n.x + cosA * offset;
            const textY = isRoot ? n.y - 22 : n.y + sinA * offset;

            // Anchor inteligente baseado em qual lado o texto fica
            let anchor: 'start' | 'middle' | 'end' = 'middle';
            let baseline: 'middle' | 'hanging' | 'alphabetic' = 'middle';
            if (isRoot) {
              anchor = 'middle'; baseline = 'alphabetic';
            } else if (Math.abs(cosA) > 0.4) {
              anchor = cosA > 0 ? 'start' : 'end';
              baseline = 'middle';
            } else {
              anchor = 'middle';
              baseline = sinA > 0 ? 'hanging' : 'alphabetic';
            }

            const corTexto = isRoot ? corTextRoot : (n.depth <= 1 ? corText : corTextMute);
            const peso = isRoot ? 600 : 500;
            const tam = isRoot ? 18 : n.depth === 1 ? 14 : 13;

            const sendoArrastado = n.id === draggingId;
            return (
              <g key={n.id}>
                {/* Hitbox transparente maior — facilita pegar o node com mouse/dedo.
                    pointer-events:all força o circle a capturar mesmo sendo
                    transparente (alguns browsers ignoram fill="transparent"). */}
                {!isRoot && (
                  <circle
                    cx={n.x.toFixed(1)}
                    cy={n.y.toFixed(1)}
                    r={r + 8}
                    fill="transparent"
                    style={{
                      cursor: sendoArrastado ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      pointerEvents: 'all',
                    }}
                    onPointerDown={(e) => handlePointerDown(e, n.id)}
                    onMouseDown={bloquearMouse}
                  />
                )}
                <circle
                  cx={n.x.toFixed(1)}
                  cy={n.y.toFixed(1)}
                  r={sendoArrastado ? r + 2 : r}
                  fill={corDot}
                  stroke={corBgCanvas}
                  strokeWidth={isRoot ? 3 : 2}
                  opacity={isRoot ? 0.96 : sendoArrastado ? 1 : 0.88}
                  filter={isRoot || sendoArrastado ? 'url(#forja-obsidian-glow)' : undefined}
                  style={{
                    pointerEvents: 'none',
                    transition: sendoArrastado ? 'none' : 'r 0.2s ease, opacity 0.2s ease',
                  }}
                >
                  {isRoot && (
                    <animate
                      attributeName="opacity"
                      values="0.92;1;0.92"
                      dur="3.2s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                <text
                  x={textX.toFixed(1)}
                  y={textY.toFixed(1)}
                  textAnchor={anchor}
                  dominantBaseline={baseline}
                  fill={corTexto}
                  fontFamily="'Inter', 'SF Pro Display', -apple-system, sans-serif"
                  fontWeight={peso}
                  fontSize={tam}
                  style={{ letterSpacing: '-0.005em', userSelect: 'none', pointerEvents: 'none' }}
                >
                  {n.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ─── Toolbar flutuante ───────────────────────────────────────────── */}
      {showToolbar && (
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
          {onExpand && (
            <Tooltip title="Abrir em tela cheia">
              <Button type="text" size="small" icon={<Expand size={14} />} onClick={onExpand} />
            </Tooltip>
          )}
          <span style={{ width: 1, height: 18, background: t.borderSoft, margin: '0 2px' }} />
          <Tooltip title="Baixar como SVG (vetorial)">
            <Button type="text" size="small" icon={<Download size={14} />} onClick={baixarSvg} />
          </Tooltip>
        </div>
      )}

      {/* Hint de interação */}
      {showToolbar && (
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
          <Move size={11} /> arraste um node pra reposicionar · arraste o fundo pra mover · scroll pra zoom
        </div>
      )}
    </div>
  );
}
