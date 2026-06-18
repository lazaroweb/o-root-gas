// FinPerfil — sessão única que reúne TODOS os recortes do "perfil ideal" da
// família, pra não inflar o menu lateral. Um só item no SubNav, com pílulas
// internas que trocam entre:
//   • Meu ideal      — orçamento-alvo, construído 100% por você (sem realidade).
//   • Comparáveis    — a IA cruza o ideal com o gasto real (real × alvo).
//   • Fora do ideal  — gastos sem alvo: mapear, cortar ou manter fora.
//   • Plano          — roteiro por fases pra sair do real e chegar no ideal.
import React, { useState } from 'react';
import { Segmented } from 'antd';
import { Home, Scale, Scissors, Route } from 'lucide-react';
import FinPerfilIdeal from './FinPerfilIdeal';
import FinIdealVsReal from './FinIdealVsReal';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { CategoriaPessoal } from '../types';

type Recorte = 'ideal' | 'comparaveis' | 'fora' | 'plano';

export default function FinPerfil({ categorias }: { categorias: CategoriaPessoal[] }): React.ReactElement {
  const t = useTokens();
  const [recorte, setRecorte] = useState<Recorte>('ideal');

  const pill = (icon: React.ReactNode, texto: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 13 }}>
      {icon}{texto}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmented
        value={recorte}
        onChange={(v) => setRecorte(v as Recorte)}
        options={[
          { value: 'ideal', label: pill(<Home size={14} />, 'Meu ideal') },
          { value: 'comparaveis', label: pill(<Scale size={14} />, 'Comparáveis') },
          { value: 'fora', label: pill(<Scissors size={14} />, 'Fora do ideal') },
          { value: 'plano', label: pill(<Route size={14} />, 'Plano do real ao ideal') },
        ]}
      />
      {recorte === 'ideal' ? (
        <FinPerfilIdeal categorias={categorias} />
      ) : (
        <FinIdealVsReal categorias={categorias} aba={recorte} />
      )}
    </div>
  );
}
