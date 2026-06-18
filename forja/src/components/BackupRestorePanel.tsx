import React, { useRef, useState } from 'react';
import {
  Button, App as AntApp, Alert, Checkbox, Modal, Tag, Tooltip, Switch, Space,
} from 'antd';
import {
  Database, Download, Upload, FileJson, Shield, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface PreviewItem { sheet: string; novos: number; existentes: number; }
interface ImportDetalhe { sheet: string; inseridos: number; apagados: number; }

interface PreviewResult {
  versaoSnapshot: string;
  geradoEm: string;
  cofreNoSnapshot: boolean;
  cofreLocal: boolean;
  resumo: PreviewItem[];
}

export default function BackupRestorePanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportando, setExportando] = useState(false);
  const [incluirHistorico, setIncluirHistorico] = useState(false);

  // Import flow state
  const [payloadCarregado, setPayloadCarregado] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modo, setModo] = useState<'merge' | 'substituir'>('merge');
  const [restaurarCofre, setRestaurarCofre] = useState(false);
  const [importando, setImportando] = useState(false);

  const exportar = async () => {
    setExportando(true);
    try {
      const r = await callServer<ServerResult>('snapshotExport', { incluirHistorico });
      if (!r.ok || !r.data) { message.error(r.error || 'Erro ao exportar'); return; }
      const data = r.data as { geradoEm: string };
      const json = JSON.stringify(r.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = (data.geradoEm || new Date().toISOString()).replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      a.href = url;
      a.download = `forja-snapshot-${ts}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.success('Snapshot exportado');
    } catch {
      message.error('Erro ao exportar — rode no Apps Script publicado');
    } finally { setExportando(false); }
  };

  const abrirArquivo = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const payload = JSON.parse(txt);
      if (!payload.version || !payload.dados) {
        message.error('Arquivo não parece ser um snapshot Forja válido (faltam version/dados).');
        return;
      }
      setPayloadCarregado(payload);
      // Pede preview ao servidor
      const r = await callServer<ServerResult>('snapshotPreview', payload);
      if (!r.ok || !r.data) { message.error(r.error || 'Erro no preview'); return; }
      setPreview(r.data as PreviewResult);
      setModalAberto(true);
    } catch (err) {
      message.error('Não consegui ler o arquivo: ' + (err instanceof Error ? err.message : 'erro'));
    } finally {
      // reset pra permitir re-selecionar o mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executarImport = async () => {
    if (!payloadCarregado) return;
    setImportando(true);
    try {
      const r = await callServer<ServerResult>('snapshotImport', payloadCarregado, {
        modo,
        restaurarCofreConfig: restaurarCofre,
      });
      if (!r.ok || !r.data) { message.error(r.error || 'Erro'); return; }
      const d = r.data as { totalInseridos: number; totalApagados: number; cofreRestaurado: boolean; detalhes: ImportDetalhe[] };
      message.success(`Restore concluído: ${d.totalInseridos} inseridos${d.totalApagados ? `, ${d.totalApagados} apagados` : ''}${d.cofreRestaurado ? ', cofre restaurado' : ''}.`);
      setModalAberto(false);
      setPayloadCarregado(null);
      setPreview(null);
    } catch {
      message.error('Erro ao importar — rode no Apps Script publicado');
    } finally { setImportando(false); }
  };

  const totalRegistros = preview?.resumo.reduce((acc, x) => acc + x.novos, 0) || 0;

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} strokeWidth={1.6} color={t.accents.sage} />
          Backup & Restore
          <Tooltip title="Snapshot completo da Forja em JSON. Use pra migrar de planilha, recovery, ou transferir entre instâncias.">
            <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* EXPORT */}
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Download size={16} color={t.accents.sage} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600, color: t.text }}>Exportar snapshot</span>
          </div>
          <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, margin: '4px 0 14px', lineHeight: 1.5 }}>
            Baixa um JSON com TODOS os dados da Forja: sistemas, ideias, financeiro, atelier, cofre cifrado. Sem chaves de API.
          </p>
          <Checkbox checked={incluirHistorico} onChange={(e) => setIncluirHistorico(e.target.checked)}>
            <span style={{ fontSize: 12 }}>Incluir histórico (Timeline + Auditorias) — pode ficar grande</span>
          </Checkbox>
          <div style={{ marginTop: 12 }}>
            <Button type="primary" icon={<Download size={14} />} loading={exportando} onClick={exportar}>
              Baixar snapshot.json
            </Button>
          </div>
        </div>

        {/* IMPORT */}
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Upload size={16} color={t.accents.peach} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600, color: t.text }}>Importar snapshot</span>
          </div>
          <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, margin: '4px 0 14px', lineHeight: 1.5 }}>
            Restaura dados a partir de um snapshot. Sempre faz dry-run antes (mostra o que vai mudar).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button icon={<FileJson size={14} />} onClick={abrirArquivo}>
            Selecionar arquivo…
          </Button>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 14, fontSize: 12 }}
        message={
          <span>
            <Shield size={12} style={{ verticalAlign: 'text-top', marginRight: 4 }} />
            O cofre é exportado <strong>cifrado</strong>. Sem sua senha-mestra, o conteúdo continua inacessível mesmo se o arquivo vazar.
          </span>
        }
      />

      <Modal
        open={modalAberto}
        onCancel={() => setModalAberto(false)}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} color={t.accents.sage} /> Preview da importação
          </span>
        }
        width={680}
        footer={[
          <Button key="cancel" onClick={() => setModalAberto(false)}>Cancelar</Button>,
          <Button
            key="apply"
            type="primary"
            danger={modo === 'substituir'}
            icon={<Upload size={14} />}
            loading={importando}
            onClick={executarImport}
          >
            {modo === 'substituir' ? 'SUBSTITUIR (apaga tudo)' : `Aplicar restore (+${totalRegistros})`}
          </Button>,
        ]}
      >
        {preview && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <Tag color="blue">v{preview.versaoSnapshot}</Tag>
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
                gerado em {new Date(preview.geradoEm).toLocaleString('pt-BR')}
              </span>
            </div>

            <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text }}>Modo de importação</span>
                <Space size={8}>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>Merge</span>
                  <Switch
                    checked={modo === 'substituir'}
                    onChange={(v) => setModo(v ? 'substituir' : 'merge')}
                  />
                  <span style={{ fontSize: 11, color: modo === 'substituir' ? t.accents.rose : t.textTertiary, fontWeight: modo === 'substituir' ? 600 : 400 }}>Substituir</span>
                </Space>
              </div>
              {modo === 'merge' ? (
                <Alert
                  type="success"
                  showIcon
                  message={<span style={{ fontSize: 12 }}>Modo seguro: adiciona registros que ainda não existem. Não apaga nada.</span>}
                />
              ) : (
                <Alert
                  type="error"
                  showIcon
                  icon={<AlertTriangle size={14} />}
                  message={<span style={{ fontSize: 12 }}><strong>PERIGO:</strong> apaga TODOS os registros existentes nas sheets do snapshot e reimporta. Use só em emergência.</span>}
                />
              )}
            </div>

            {preview.cofreNoSnapshot && (
              <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Shield size={14} color={t.accents.peach} />
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text }}>Configuração do Cofre</span>
                </div>
                <Checkbox checked={restaurarCofre} onChange={(e) => setRestaurarCofre(e.target.checked)}>
                  <span style={{ fontSize: 12 }}>
                    Restaurar config do cofre {preview.cofreLocal && <Tag color="warning" style={{ marginLeft: 6, fontSize: 10 }}>vai sobrescrever cofre local</Tag>}
                  </span>
                </Checkbox>
                <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
                  Necessário se você quer continuar usando a mesma senha-mestra do snapshot. Sem isso, os ciphertexts vêm mas sem como decifrar.
                </div>
              </div>
            )}

            <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 8 }}>
              <strong>Resumo por sheet</strong> (registros no snapshot / já existentes localmente):
            </div>
            <div style={{ maxHeight: 280, overflow: 'auto', border: `1px solid ${t.borderSoft}`, borderRadius: 8 }}>
              {preview.resumo.filter((r) => r.novos > 0 || r.existentes > 0).map((r, idx) => (
                <div
                  key={r.sheet}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 12px',
                    borderTop: idx > 0 ? `1px solid ${t.borderSoft}` : 'none',
                    background: idx % 2 === 0 ? 'transparent' : t.surfaceMuted,
                  }}
                >
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text }}>{r.sheet}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.textTertiary }}>
                    <strong style={{ color: r.novos > 0 ? t.accents.sage : t.textTertiary }}>{r.novos}</strong> / {r.existentes}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </Panel>
  );
}
