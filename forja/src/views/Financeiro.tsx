import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { LayoutDashboard, ArrowUpRight, ArrowDownRight, Wallet, Building2, Receipt, FileText, LineChart, Landmark, Scale } from 'lucide-react';
import { PageHeader } from '../components/ui';
import SubNav, { type SubNavItem } from '../components/SubNav';
import FinResumo from './FinResumo';
import FinReceitas from './FinReceitas';
import FinCobrancas from './FinCobrancas';
import FinCustos from './FinCustos';
import FinEmpresaDespesas from './FinEmpresaDespesas';
import FinProjecao from './FinProjecao';
import FinConciliacao from './FinConciliacao';
import FinImpostos from './FinImpostos';
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

type EmpresaView = 'resumo' | 'receber' | 'cobrancas' | 'despesas' | 'pagar' | 'projecao' | 'conciliacao' | 'impostos';

function FinEmpresa({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const [view, setView] = useState<EmpresaView>('resumo');
  const NAV: SubNavItem<EmpresaView>[] = [
    { key: 'resumo', icon: LayoutDashboard, label: 'Visão geral', accent: 'peach', desc: 'Saúde financeira do negócio: receita, custo e lucro por app.' },
    { key: 'receber', icon: ArrowUpRight, label: 'A receber', accent: 'sage', desc: 'Assinaturas e cobranças a receber dos clientes.' },
    { key: 'cobrancas', icon: FileText, label: 'Cobranças', accent: 'blue', desc: 'Emita boleto e PIX com baixa automática por webhook.' },
    { key: 'despesas', icon: Receipt, label: 'Despesas', accent: 'clay', desc: 'Livro-caixa mensal: contas, boletos e recibos — com importação por PDF/foto.' },
    { key: 'pagar', icon: ArrowDownRight, label: 'A pagar', accent: 'rose', desc: 'Custos recorrentes (contratos): fornecedor, valor e próxima cobrança.' },
    { key: 'projecao', icon: LineChart, label: 'Projeção', accent: 'lavender', desc: 'Caixa pra frente, mês a mês: entradas previstas × saídas, saldo e runway.' },
    { key: 'conciliacao', icon: Landmark, label: 'Conciliação', accent: 'blue', desc: 'Importe o extrato (OFX) e case cada transação com o sistema, dando baixa.' },
    { key: 'impostos', icon: Scale, label: 'Impostos', accent: 'clay', desc: 'Provisão e acompanhamento do DAS/Simples: base, alíquota, guia e reserva.' },
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
    </SubNav>
  );
}

export default function Financeiro(): React.ReactElement {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);

  useEffect(() => {
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); })
      .catch(() => setSistemas([]));
  }, []);

  const items = [
    { key: 'empresa', label: tabLabel(<Building2 size={16} />, 'Empresa'), children: <FinEmpresa sistemas={sistemas} /> },
    { key: 'pessoal', label: tabLabel(<Wallet size={16} />, 'Pessoal'), children: <FinPessoal /> },
  ];

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1160, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Financeiro" subtitle="Empresa e Pessoal lado a lado — receitas, custos, lucro de cada app e suas finanças pessoais." />
      <Tabs defaultActiveKey="empresa" items={items} size="large" />
    </div>
  );
}
