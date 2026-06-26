import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Select, Button, Tooltip } from 'antd';
import { LayoutDashboard, ArrowUpRight, ArrowDownRight, Wallet, Building2, Receipt, FileText, LineChart, Landmark, Scale, Settings2, Layers, Plus, FolderArchive, KeyRound } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import SubNav, { type SubNavItem } from '../components/SubNav';
import FinEmpresas from './FinEmpresas';
import type { Empresa } from '../types';
import FinResumo from './FinResumo';
import FinReceitas from './FinReceitas';
import FinCobrancas from './FinCobrancas';
import FinCustos from './FinCustos';
import FinEmpresaDespesas from './FinEmpresaDespesas';
import FinProjecao from './FinProjecao';
import FinConciliacao from './FinConciliacao';
import FinImpostos from './FinImpostos';
import FinDocumentos from './FinDocumentos';
import FinCofre from './FinCofre';
// v1.3: tab Pessoal — mini sistema financeiro pessoal (despesas, cartões, Pix,
// contas a pagar). Totalmente separado das receitas/custos do negócio.
// v1.13: separação macro Empresa × Pessoal — cada lado com suas próprias abas,
// pra setorizar e organizar visualmente (Empresa = negócio, Pessoal = vida).
import FinPessoal from './FinPessoal';
import callServer from '../gas-client';
import type { Sistema, ServerResponse } from '../types';

function tabLabel(icon: React.ReactNode, texto: string): React.ReactElement {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{icon} {texto}</span>;
}

type EmpresaView = 'resumo' | 'receber' | 'cobrancas' | 'despesas' | 'pagar' | 'projecao' | 'conciliacao' | 'impostos' | 'documentos' | 'cofre';

function FinEmpresa({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const [view, setView] = useState<EmpresaView>('resumo');
  // Duas macro-seções na mesma coluna (via `group` do SubNav):
  // Financeiro = gestão do dinheiro (entradas, saídas planejadas, projeção);
  // Contabilidade = registros e obrigações (livro-caixa, conciliação, impostos).
  const NAV: SubNavItem<EmpresaView>[] = [
    { key: 'resumo', icon: LayoutDashboard, label: 'Visão geral', accent: 'peach', group: 'Financeiro', desc: 'Saúde financeira do negócio: receita, custo e lucro por app.' },
    { key: 'receber', icon: ArrowUpRight, label: 'A receber', accent: 'sage', group: 'Financeiro', desc: 'Assinaturas e cobranças a receber dos clientes.' },
    { key: 'cobrancas', icon: FileText, label: 'Cobranças', accent: 'blue', group: 'Financeiro', desc: 'Emita boleto e PIX com baixa automática por webhook.' },
    { key: 'pagar', icon: ArrowDownRight, label: 'A pagar', accent: 'rose', group: 'Financeiro', desc: 'Custos recorrentes (contratos): fornecedor, valor e próxima cobrança.' },
    { key: 'projecao', icon: LineChart, label: 'Projeção', accent: 'lavender', group: 'Financeiro', desc: 'Caixa pra frente, mês a mês: entradas previstas × saídas, saldo e runway.' },
    { key: 'despesas', icon: Receipt, label: 'Despesas', accent: 'clay', group: 'Contabilidade', desc: 'Livro-caixa mensal: contas, boletos e recibos — com importação por PDF/foto.' },
    { key: 'conciliacao', icon: Landmark, label: 'Conciliação', accent: 'blue', group: 'Contabilidade', desc: 'Importe o extrato (OFX) e case cada transação com o sistema, dando baixa.' },
    { key: 'impostos', icon: Scale, label: 'Impostos', accent: 'clay', group: 'Contabilidade', desc: 'Provisão e acompanhamento do DAS/Simples: base, alíquota, guia e reserva.' },
    { key: 'documentos', icon: FolderArchive, label: 'Documentos', accent: 'sage', group: 'Documentos', desc: 'Cofre dos documentos da empresa: contrato social, CNPJ, certificados e certidões.' },
    { key: 'cofre', icon: KeyRound, label: 'Cofre', accent: 'peach', group: 'Documentos', desc: 'Segredos da empresa: senha do certificado digital, gov.br/e-CAC e tokens — guardados na área protegida do app.' },
  ];
  return (
    <SubNav items={NAV} value={view} onChange={setView} ariaLabel="Áreas do Financeiro da Empresa">
      {view === 'resumo' && <FinResumo />}
      {view === 'receber' && <FinReceitas sistemas={sistemas} />}
      {view === 'cobrancas' && <FinCobrancas sistemas={sistemas} />}
      {view === 'despesas' && <FinEmpresaDespesas sistemas={sistemas} />}
      {view === 'pagar' && <FinCustos sistemas={sistemas} />}
      {view === 'projecao' && <FinProjecao />}
      {view === 'conciliacao' && <FinConciliacao />}
      {view === 'impostos' && <FinImpostos />}
      {view === 'documentos' && <FinDocumentos />}
      {view === 'cofre' && <FinCofre />}
    </SubNav>
  );
}

// Seletor de empresa (multi-empresa): escolhe a empresa ativa que escopa todas as
// telas da aba Empresa, ou "Consolidado" pra somar todas. '__todas__' = consolidado.
// O rodapé do dropdown traz as ações de criar/gerenciar empresas — é onde a pessoa
// naturalmente procura por "minhas empresas", então é ali que descobre o multi-CNPJ.
function SeletorEmpresa({ empresas, ativa, onChange, onGerir, onNova }: {
  empresas: Empresa[]; ativa: string; onChange: (id: string) => void; onGerir: () => void; onNova: () => void;
}): React.ReactElement {
  const t = useTokens();
  const umaSo = empresas.length <= 1;
  const options = [
    ...(empresas.length > 1 ? [{ value: '__todas__', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Layers size={14} /> Consolidado</span>) }] : []),
    ...empresas.map((e) => ({
      value: e.id,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: e.cor || '#8b5cf6', display: 'inline-block' }} />
          {e.nomeFantasia || e.razaoSocial}
        </span>
      ),
    })),
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Select
        value={ativa}
        onChange={onChange}
        options={options}
        style={{ minWidth: 230 }}
        popupMatchSelectWidth={false}
        prefix={<Building2 size={14} style={{ color: t.textTertiary }} />}
        dropdownRender={(menu) => (
          <>
            {menu}
            <div style={{ height: 1, background: t.border, margin: '6px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', padding: 4, gap: 2 }}>
              <Button type="text" size="small" icon={<Plus size={14} />} onClick={onNova} style={{ justifyContent: 'flex-start', color: t.text }}>
                Nova empresa
              </Button>
              <Button type="text" size="small" icon={<Settings2 size={14} />} onClick={onGerir} style={{ justifyContent: 'flex-start', color: t.text }}>
                Gerenciar empresas
              </Button>
            </div>
          </>
        )}
      />
      {umaSo ? (
        <Tooltip title="Você pode cadastrar várias empresas (CNPJs) e ver cada uma — ou o consolidado.">
          <Button type="dashed" icon={<Plus size={15} />} onClick={onNova}>Adicionar empresa</Button>
        </Tooltip>
      ) : (
        <Tooltip title="Gerenciar empresas">
          <Button icon={<Settings2 size={16} />} onClick={onGerir} />
        </Tooltip>
      )}
    </div>
  );
}

export default function Financeiro(): React.ReactElement {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [ativa, setAtiva] = useState<string>('');
  const [tab, setTab] = useState<string>('empresa');
  const [gerirOpen, setGerirOpen] = useState(false);
  const [gerirNovo, setGerirNovo] = useState(false);

  useEffect(() => {
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); })
      .catch(() => setSistemas([]));
  }, []);

  const loadEmpresas = useCallback(() => {
    callServer<ServerResponse<{ empresas: Empresa[]; ativa: string; consolidado: boolean }>>('getEmpresas')
      .then(res => {
        if (res.ok && res.data) {
          const d = res.data as { empresas: Empresa[]; ativa: string; consolidado: boolean };
          setEmpresas(d.empresas || []);
          setAtiva(d.consolidado ? '__todas__' : (d.ativa || (d.empresas[0]?.id ?? '')));
        }
      })
      .catch(() => { /* preview */ });
  }, []);
  useEffect(loadEmpresas, [loadEmpresas]);

  const trocarEmpresa = (id: string) => {
    setAtiva(id);
    callServer('setEmpresaAtiva', id).catch(() => { /* segue */ });
  };

  const items = [
    { key: 'empresa', label: tabLabel(<Building2 size={16} />, 'Empresa'), children: <FinEmpresa key={`emp-${ativa}`} sistemas={sistemas} /> },
    { key: 'pessoal', label: tabLabel(<Wallet size={16} />, 'Pessoal'), children: <FinPessoal /> },
  ];

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1160, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Financeiro"
        subtitle="Empresa e Pessoal lado a lado — receitas, custos, lucro de cada app e suas finanças pessoais."
        extra={tab === 'empresa' ? (
          <SeletorEmpresa
            empresas={empresas}
            ativa={ativa}
            onChange={trocarEmpresa}
            onGerir={() => { setGerirNovo(false); setGerirOpen(true); }}
            onNova={() => { setGerirNovo(true); setGerirOpen(true); }}
          />
        ) : undefined}
      />
      <Tabs activeKey={tab} onChange={setTab} items={items} size="large" />
      <FinEmpresas
        open={gerirOpen}
        abrirNovo={gerirNovo}
        onClose={() => { setGerirOpen(false); setGerirNovo(false); }}
        onChange={loadEmpresas}
      />
    </div>
  );
}
