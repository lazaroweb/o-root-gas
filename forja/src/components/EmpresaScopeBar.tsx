// EmpresaScopeBar — indicador + seletor compacto da empresa ativa.
//
// Fase 3b (v1.190.0): as conexões passam a ser escopadas por empresa. Como o
// SeletorEmpresa "rico" vive só no Financeiro, este bar leve dá contexto e
// troca de escopo onde as conexões são geridas (hub em Configurações). Usa as
// RPCs globais getEmpresas/setEmpresaAtiva — a mesma fonte de verdade.
import React, { useEffect, useState } from 'react';
import { Select, App as AntApp } from 'antd';
import { Building2 } from 'lucide-react';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

const TODAS = '__todas__';

interface EmpresaItem { id: string; nomeFantasia?: string; razaoSocial?: string; cor?: string }

export default function EmpresaScopeBar({ onChange }: { onChange?: () => void }): React.ReactElement | null {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [valor, setValor] = useState<string>('');
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    callServer<ServerResult>('getEmpresas')
      .then((r) => {
        if (!r.ok || !r.data) return;
        const d = r.data as { empresas: EmpresaItem[]; ativa: string; consolidado: boolean };
        setEmpresas(d.empresas || []);
        setValor(d.consolidado ? TODAS : String(d.ativa || ''));
      })
      .catch(() => { /* preview local */ });
  }, []);

  const trocar = (id: string) => {
    setTrocando(true);
    setValor(id);
    callServer<ServerResult>('setEmpresaAtiva', id)
      .then((r) => { if (r.ok) { if (onChange) onChange(); } else message.error(r.error || 'Erro ao trocar empresa'); })
      .catch(() => message.error('Troca de empresa só funciona no app publicado'))
      .finally(() => setTrocando(false));
  };

  // Single-company sem consolidado faz pouco sentido mostrar — mas mantemos pra
  // deixar claro o escopo. Se não houver empresa nenhuma, não renderiza.
  if (empresas.length === 0) return null;

  const options = [
    ...empresas.map((e) => ({ value: e.id, label: e.nomeFantasia || e.razaoSocial || 'Empresa' })),
    { value: TODAS, label: 'Consolidado (todas)' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
      <Building2 size={15} color={t.accents.lavender} />
      <span style={{ fontSize: 12.5, color: t.textSecondary }}>Escopo:</span>
      <Select
        size="small"
        value={valor || undefined}
        loading={trocando}
        onChange={trocar}
        options={options}
        style={{ minWidth: 200 }}
        placeholder="Empresa ativa"
      />
      <span style={{ fontSize: 11.5, color: t.textTertiary }}>as conexões abaixo seguem este escopo</span>
    </div>
  );
}
