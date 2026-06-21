import React, { useState } from 'react';
import { Button, Spin, App as AntApp, Row, Col } from 'antd';
import { Users, Sparkles, ThumbsUp, AlertTriangle, Lightbulb, Flag } from 'lucide-react';
import { Panel } from '../components/ui';
import PremiumEmpty from '../components/PremiumEmpty';
import ContextoPicker, { type Contexto } from '../components/ContextoPicker';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Ideia, Sistema, ServerResponse } from '../types';

interface Parecer {
  persona: string;
  resumo: string;
  pontosFortes: string[];
  riscos: string[];
  recomendacoes: string[];
}
interface Sintese {
  decisaoRecomendada: string;
  proximosPassos: string[];
  alertas: string[];
}
interface ResultadoConselho {
  pareceres: Parecer[];
  sintese: Sintese;
}

const PERSONA_COR: Record<string, 'sage' | 'blue' | 'lavender' | 'peach' | 'clay'> = {
  'Product/BA': 'blue', UX: 'lavender', UI: 'peach', Arquitetura: 'sage', Engenharia: 'clay',
};

export default function IAConselho({ ideias, sistemas }: { ideias: Ideia[]; sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [contexto, setContexto] = useState<Contexto>({ modo: 'ideia' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultadoConselho | null>(null);

  const reunir = () => {
    setLoading(true);
    setResult(null);
    callServer<ServerResponse<ResultadoConselho>>('conselhoEspecialistas', contexto)
      .then(res => { if (res.ok && res.data) setResult(res.data as ResultadoConselho); else message.error(res.error || 'Erro'); })
      .catch(() => message.error('O conselho só funciona no app publicado, com IA configurada'))
      .finally(() => setLoading(false));
  };

  const lista = (titulo: string, icon: React.ReactNode, itens: string[], cor: string) => (
    itens && itens.length > 0 ? (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: cor, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{icon} {titulo}</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
          {itens.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    ) : null
  );

  return (
    <div>
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Users size={18} strokeWidth={1.6} color={t.accents.lavender} /> Conselho de especialistas</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>UX, UI, Arquitetura, Engenharia e Product/BA analisam sua ideia e recomendam o caminho — para você decidir sem retrabalho.</p>
        <ContextoPicker value={contexto} onChange={setContexto} ideias={ideias} sistemas={sistemas} />
        <Button type="primary" icon={<Sparkles size={16} />} loading={loading} onClick={reunir} style={{ marginTop: 14 }}>Reunir conselho</Button>
      </Panel>

      {loading && <Spin style={{ display: 'block', margin: '40px auto' }} tip="Reunindo especialistas..."><div style={{ height: 60 }} /></Spin>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <Row gutter={[16, 16]}>
            {result.pareceres.map((p, i) => {
              const cor = t.accents[PERSONA_COR[p.persona] || 'blue'];
              return (
                <Col xs={24} lg={12} key={i}>
                  <Panel padding={18} className="forja-lift" style={{ height: '100%', borderTop: `2px solid ${cor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: `${cor}22`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 600, fontSize: 14 }}>{p.persona.charAt(0)}</span>
                      <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>{p.persona}</span>
                    </div>
                    <p style={{ color: t.textSecondary, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{p.resumo}</p>
                    {lista('Pontos fortes', <ThumbsUp size={13} />, p.pontosFortes, t.accents.sage)}
                    {lista('Riscos', <AlertTriangle size={13} />, p.riscos, t.accents.clay)}
                    {lista('Recomendações', <Lightbulb size={13} />, p.recomendacoes, t.accents.blue)}
                  </Panel>
                </Col>
              );
            })}
          </Row>

          {result.sintese && (
            <div style={{ marginTop: 16 }}>
              <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Flag size={18} strokeWidth={1.6} color={t.accents.peach} /> Síntese & recomendação</span>}>
                <p style={{ color: t.text, fontSize: 14, lineHeight: 1.65, marginTop: 0 }}><strong>{result.sintese.decisaoRecomendada}</strong></p>
                {lista('Próximos passos', <Lightbulb size={13} />, result.sintese.proximosPassos, t.accents.sage)}
                {lista('Alertas', <AlertTriangle size={13} />, result.sintese.alertas, t.accents.clay)}
              </Panel>
            </div>
          )}
        </div>
      )}

      {!loading && !result && (
        <div style={{ marginTop: 18 }}>
          <PremiumEmpty
            icon={<Users size={26} strokeWidth={1.5} />}
            accent={t.accents.lavender}
            title="Seu conselho está pronto pra reunir"
            subtitle="Escolha um contexto acima e clique em Reunir conselho. Cinco especialistas — Product/BA, UX, UI, Arquitetura e Engenharia — analisam e entregam uma recomendação única."
          />
        </div>
      )}
    </div>
  );
}
