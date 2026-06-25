// FinDocumentos — cofre de documentos da empresa ativa. Contrato social, cartão
// CNPJ, certificados, certidões etc. O arquivo é guardado no Google Drive (pasta
// por empresa) e aqui listamos os metadados, com categoria, validade e ação de
// abrir/baixar. Escopado pela empresa selecionada no topo.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Select, DatePicker, Input, Modal, Form, Upload, Popconfirm, Empty, Tooltip, App as AntApp } from 'antd';
import { Plus, Trash2, ExternalLink, FileText, UploadCloud, AlertTriangle, Pencil } from 'lucide-react';
import dayjs from 'dayjs';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface Documento {
  id: string; empresaId: string; nome: string; categoria: string; mime: string;
  tamanho: number; driveFileId: string; url: string; validade: string; notas: string; criadoEm: string;
}

function formatBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Lê um File como base64 puro (sem o prefixo data:).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ''); resolve(r.indexOf(',') >= 0 ? r.substring(r.indexOf(',') + 1) : r); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FinDocumentos(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [upOpen, setUpOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<{ documentos: Documento[]; categorias: string[] }>>('getDocumentosEmpresa')
      .then((res) => {
        if (res.ok && res.data) {
          const d = res.data as { documentos: Documento[]; categorias: string[] };
          setDocs(d.documentos || []);
          setCategorias(d.categorias || []);
        }
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrirUpload = () => { setEditId(null); setArquivo(null); form.resetFields(); form.setFieldsValue({ categoria: 'Outros' }); setUpOpen(true); };
  const abrirEdit = (d: Documento) => {
    setEditId(d.id); setArquivo(null);
    form.resetFields();
    form.setFieldsValue({ nome: d.nome, categoria: d.categoria, validade: d.validade ? dayjs(d.validade) : null, notas: d.notas });
    setUpOpen(true);
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const validade = (v['validade'] as dayjs.Dayjs | null)?.format('YYYY-MM-DD') || '';
      if (editId) {
        const res = await callServer<ServerResponse<unknown>>('atualizarDocumentoEmpresa', editId, { nome: v['nome'], categoria: v['categoria'], validade, notas: v['notas'] });
        if (res.ok) { message.success('Documento atualizado'); setUpOpen(false); load(); }
        else message.error(res.error || 'Erro');
      } else {
        if (!arquivo) { message.error('Escolha um arquivo.'); setSaving(false); return; }
        const base64 = await fileToBase64(arquivo);
        const res = await callServer<ServerResponse<unknown>>('uploadDocumentoEmpresa', {
          nome: String(v['nome'] || arquivo.name), categoria: v['categoria'], mime: arquivo.type || 'application/octet-stream', base64, validade, notas: v['notas'],
        });
        if (res.ok) { message.success('Documento guardado'); setUpOpen(false); load(); }
        else message.error(res.error || 'Erro ao subir');
      }
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const remover = (d: Documento) => callServer<ServerResponse<unknown>>('excluirDocumentoEmpresa', d.id).then((r) => { if (r.ok) { message.success('Removido'); load(); } else message.error(r.error || 'Erro'); });

  const hoje = dayjs();
  const venceProx = (validade: string) => validade && dayjs(validade).isBefore(hoje.add(30, 'day'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: t.textSecondary, fontSize: 13 }}>
          Documentos da empresa selecionada — guardados no seu Google Drive.
        </div>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<Plus size={15} />} onClick={abrirUpload}>Adicionar documento</Button>
      </div>

      <Panel title={`Documentos (${docs.length})`} padding={8}>
        <Table
          rowKey="id"
          dataSource={docs}
          loading={loading}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum documento ainda — adicione o contrato social, cartão CNPJ…" /> }}
          columns={[
            {
              title: 'Documento', dataIndex: 'nome', ellipsis: true,
              render: (v: string, d: Documento) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FileText size={15} style={{ color: t.textTertiary, flexShrink: 0 }} />
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</a>
                </div>
              ),
            },
            { title: 'Categoria', dataIndex: 'categoria', width: 160, ellipsis: true, render: (v: string) => <Tag>{v}</Tag> },
            { title: 'Tamanho', dataIndex: 'tamanho', width: 100, align: 'right', render: (v: number) => <span style={{ color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 12 }}>{formatBytes(v)}</span> },
            {
              title: 'Validade', dataIndex: 'validade', width: 130,
              render: (v: string) => v
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: venceProx(v) ? t.accents.rose : t.textSecondary }}>{venceProx(v) && <AlertTriangle size={13} />}{dayjs(v).format('DD/MM/YYYY')}</span>
                : <span style={{ color: t.textTertiary }}>—</span>,
            },
            { title: 'Enviado', dataIndex: 'criadoEm', width: 120, render: (v: string) => <span style={{ color: t.textTertiary, fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> },
            {
              title: 'Ações', key: 'acoes', align: 'right', width: 140,
              render: (_: unknown, d: Documento) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Tooltip title="Abrir no Drive"><Button size="small" icon={<ExternalLink size={14} />} href={d.url} target="_blank" /></Tooltip>
                  <Tooltip title="Editar"><Button size="small" icon={<Pencil size={14} />} onClick={() => abrirEdit(d)} /></Tooltip>
                  <Popconfirm title="Excluir documento?" description="Vai pra lixeira do Drive." okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => remover(d)}>
                    <Button size="small" danger icon={<Trash2 size={14} />} />
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <div style={{ color: t.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        Os arquivos ficam no seu Google Drive, na pasta "Forja — Documentos", organizados por empresa. Tamanho máximo por arquivo: 25 MB.
      </div>

      <Modal
        title={editId ? 'Editar documento' : 'Adicionar documento'}
        open={upOpen}
        onCancel={() => setUpOpen(false)}
        onOk={() => form.submit()}
        okText={editId ? 'Salvar' : 'Enviar'}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={salvar} style={{ marginTop: 8 }}>
          {!editId && (
            <Form.Item label="Arquivo" required>
              <Upload.Dragger
                maxCount={1}
                multiple={false}
                beforeUpload={(file) => { setArquivo(file); if (!form.getFieldValue('nome')) form.setFieldsValue({ nome: file.name }); return false; }}
                onRemove={() => setArquivo(null)}
                fileList={arquivo ? [{ uid: '1', name: arquivo.name } as never] : []}
              >
                <p style={{ margin: 0, color: t.textSecondary }}><UploadCloud size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Clique ou arraste o arquivo aqui</p>
              </Upload.Dragger>
            </Form.Item>
          )}
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Informe um nome' }]}>
            <Input placeholder="Ex.: Contrato social 2024" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="categoria" label="Categoria" rules={[{ required: true }]}>
              <Select options={(categorias.length ? categorias : ['Outros']).map((c) => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="validade" label="Validade (opcional)" tooltip="Pra certidões/certificados — alerta quando perto de vencer.">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} placeholder="Observações" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
