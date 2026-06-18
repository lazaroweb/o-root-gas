import React from 'react';
import { Segmented, Select, Input } from 'antd';
import { useTokens } from '../themeContext';
import type { Ideia, Sistema } from '../types';

export interface Contexto {
  modo: 'ideia' | 'sistema' | 'texto';
  ideiaId?: string;
  sistemaId?: string;
  texto?: string;
}

interface Props {
  value: Contexto;
  onChange: (c: Contexto) => void;
  ideias: Ideia[];
  sistemas: Sistema[];
  placeholder?: string;
}

export default function ContextoPicker({ value, onChange, ideias, sistemas, placeholder }: Props): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={value.modo}
          onChange={(v) => onChange({ modo: v as Contexto['modo'] })}
          options={[
            { label: 'Ideia', value: 'ideia' },
            { label: 'Sistema', value: 'sistema' },
            { label: 'Texto livre', value: 'texto' },
          ]}
        />
      </div>
      {value.modo === 'ideia' && (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Selecione uma ideia"
          style={{ width: '100%' }}
          value={value.ideiaId}
          onChange={(v) => onChange({ ...value, ideiaId: v })}
          options={ideias.map((i) => ({ value: i.id, label: i.titulo }))}
          notFoundContent={<span style={{ color: t.textTertiary }}>Nenhuma ideia cadastrada</span>}
        />
      )}
      {value.modo === 'sistema' && (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Selecione um sistema"
          style={{ width: '100%' }}
          value={value.sistemaId}
          onChange={(v) => onChange({ ...value, sistemaId: v })}
          options={sistemas.map((s) => ({ value: s.id, label: s.nome }))}
          notFoundContent={<span style={{ color: t.textTertiary }}>Nenhum sistema cadastrado</span>}
        />
      )}
      {value.modo === 'texto' && (
        <Input.TextArea
          value={value.texto}
          onChange={(e) => onChange({ ...value, texto: e.target.value })}
          placeholder={placeholder || 'Descreva sua ideia, o problema e o que você quer construir...'}
          autoSize={{ minRows: 3, maxRows: 8 }}
        />
      )}
    </div>
  );
}
