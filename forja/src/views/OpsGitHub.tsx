import React, { useState, useEffect } from 'react';
import { Button, Empty, Spin, Tag, Input, Alert } from 'antd';
import { RefreshCw, ExternalLink, Star, CircleDot, GitBranch, Lock, Search } from 'lucide-react';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { GitHubRepo, ServerResponse } from '../types';

function tempoRelativo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const dias = Math.floor(diff / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  return `há ${Math.floor(meses / 12)} ano(s)`;
}

export default function OpsGitHub(): React.ReactElement {
  const t = useTokens();
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const carregar = () => {
    setLoading(true);
    setErro(null);
    callServer<ServerResponse<GitHubRepo[]>>('getGitHubRepos')
      .then(res => { if (res.ok && res.data) setRepos(res.data as GitHubRepo[]); else setErro(res.error || 'Erro'); })
      .catch(() => setErro('Os repositórios carregam no app publicado, com GitHub configurado.'))
      .finally(() => setLoading(false));
  };
  useEffect(carregar, []);

  const filtrados = (repos || []).filter(r => !busca || r.nome.toLowerCase().includes(busca.toLowerCase()) || r.descricao.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Input prefix={<Search size={15} color={t.textTertiary} />} placeholder="Buscar repositório..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320 }} allowClear />
        <Button icon={<RefreshCw size={15} />} loading={loading} onClick={carregar}>Atualizar</Button>
      </div>

      {erro && <Alert type="warning" showIcon message={erro} style={{ marginBottom: 14 }} action={<Button size="small" onClick={carregar}>Tentar de novo</Button>} />}

      <Panel
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><GitBranch size={18} strokeWidth={1.6} color={t.accents.lavender} /> Repositórios</span>}
        extra={repos ? <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue }}>{repos.length} repos</Tag> : null}
        padding={8}
      >
        {loading && !repos ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : !repos || filtrados.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={erro ? 'Configure o GitHub em Configurações' : 'Nenhum repositório'} style={{ padding: 32 }} />
        ) : (
          filtrados.map((r) => (
            <div key={r.fullName} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderBottom: `1px solid ${t.borderSoft}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{r.nome}</span>
                  {r.privado && <Lock size={12} color={t.textTertiary} />}
                  {r.sistemaNome && <Tag bordered={false} style={{ background: `${t.accents.sage}1a`, color: t.accents.sage, fontSize: 11 }}>↔ {r.sistemaNome}</Tag>}
                </div>
                <div style={{ color: t.textTertiary, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao || 'Sem descrição'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.textTertiary, fontSize: 12 }}>
                {r.linguagem && <span style={{ color: t.textSecondary }}>{r.linguagem}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star size={13} /> {r.stars}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CircleDot size={13} /> {r.issues}</span>
                <span style={{ fontFamily: FONTS.mono, minWidth: 84, textAlign: 'right' }}>{tempoRelativo(r.pushedAt)}</span>
              </div>
              <Button type="text" size="small" icon={<ExternalLink size={15} />} href={r.url} target="_blank" />
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
