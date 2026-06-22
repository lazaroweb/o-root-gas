// IdeiaCapturaQuick — modal flutuante global de captura zero-fricção.
//
// Filosofia (do usuário): "Tô trabalhando e vem várias coisa que preciso fazer
// que são pendências... pensei em ter uma sessão onde eu possa cadastrar todas
// as minhas ideias e isso possa de alguma forma depois ser refinada... um
// conceito de caixa onde coloco tudo e depois classifico."
//
// Implementação: hotkey `g+x` em qualquer tela abre este modal. Input gigante,
// foco automático, Enter salva e mantém o modal aberto pra rajada. Escape fecha.
// O resto da triagem fica pra depois (na IdeiasView, visão Inbox ou modo Foco).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, App as AntApp } from 'antd';
import type { InputRef } from 'antd';
import { Sparkles, Plus, ArrowRight, Check } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface IdeiaCapturaQuickProps {
  open: boolean;
  onClose: () => void;
  onIrParaIdeias: () => void;
  onCapturada?: () => void; // pra o Dashboard recarregar a badge "Inbox"
}

export default function IdeiaCapturaQuick({
  open, onClose, onIrParaIdeias, onCapturada,
}: IdeiaCapturaQuickProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [titulo, setTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Contagem nesta rajada: "capturadas 3 ✓" enquanto o modal fica aberto.
  const [rajada, setRajada] = useState(0);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      setTitulo('');
      setRajada(0);
      // Foco com delay pra esperar o modal abrir (animação do antd).
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open]);

  const capturar = useCallback(async () => {
    const tit = titulo.trim();
    if (!tit) return;
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('createIdeia', {
        titulo: tit,
        estado: 'nova',
        criadoEm: new Date().toISOString(),
      });
      if (!r.ok) {
        message.error(r.error || 'Não rolou capturar');
        return;
      }
      setTitulo('');
      setRajada((n) => n + 1);
      onCapturada?.();
      // Mantém o foco pro próximo Enter (rajada).
      setTimeout(() => inputRef.current?.focus(), 30);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }, [titulo, message, onCapturada]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={620}
      destroyOnClose
      // Sem padding extra do antd — controlamos visualmente.
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 18, overflow: 'hidden' },
      }}
      closable={false}
    >
      <div style={{
        padding: '24px 24px 18px',
        background: `linear-gradient(180deg, ${t.accents.peach}10 0%, ${t.surface} 80%)`,
        borderBottom: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${t.accents.peach}24`, color: t.accents.peach,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: t.text }}>
              Captura rápida
            </div>
            <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
              Joga aí. Tria depois com calma.
            </div>
          </div>
          {rajada > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${t.accents.sage}1f`, color: t.accents.sage,
              padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
            }}>
              <Check size={12} /> {rajada} capturada{rajada > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <Input
          ref={inputRef}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onPressEnter={capturar}
          placeholder="Qual a faísca? Escreve e aperta Enter."
          size="large"
          disabled={salvando}
          maxLength={240}
          style={{
            fontSize: 17, fontFamily: FONTS.display,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '14px 16px',
          }}
        />
      </div>

      <div style={{
        padding: '12px 24px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: t.surface,
      }}>
        <div style={{ fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span><kbd style={kbdStyle(t)}>Enter</kbd> salva</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span><kbd style={kbdStyle(t)}>Esc</kbd> fecha</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>Continue digitando pra rajada</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="middle" type="text" onClick={() => { onClose(); onIrParaIdeias(); }} icon={<ArrowRight size={14} />}>
            Ir pra Ideias
          </Button>
          <Button
            type="primary"
            size="middle"
            icon={<Plus size={14} />}
            onClick={capturar}
            loading={salvando}
            disabled={!titulo.trim()}
          >
            Capturar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function kbdStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    fontFamily: FONTS.mono,
    background: t.surfaceMuted,
    color: t.textSecondary,
    border: `1px solid ${t.border}`,
    padding: '1px 6px',
    borderRadius: 5,
    fontSize: 10,
  };
}
