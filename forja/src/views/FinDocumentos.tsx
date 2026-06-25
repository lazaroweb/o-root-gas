// FinDocumentos — cofre de documentos da empresa ativa. Contrato social, cartão
// CNPJ, certificados, certidões etc. O arquivo é guardado no Google Drive (pasta
// por empresa) e aqui listamos os metadados, com categoria, validade e ação de
// abrir/baixar. Escopado pela empresa selecionada no topo.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Select, DatePicker, Input, Modal, Form, Upload, Popconfirm, Empty, Tooltip, Alert, Tree, Spin, App as AntApp } from 'antd';
import { Plus, Trash2, ExternalLink, FileText, UploadCloud, AlertTriangle, Pencil, Building2, Layers, FolderTree, Folder, Download, ShieldAlert, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface Documento {
  id: string; empresaId: string; nome: string; categoria: string; mime: string;
  tamanho: number; driveFileId: string; url: string; validade: string; notas: string; criadoEm: string; empresaNome?: string;
}

interface DriveNode {
  id: string; name: string; isFolder: boolean; url: string;
  mime?: string; size?: number; downloadUrl?: string; children?: DriveNode[];
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
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCor, setEmpresaCor] = useState('#8b5cf6');
  const [consolidado, setConsolidado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upOpen, setUpOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  // Autorização do Drive (escopo novo exige reconsentimento)
  const [driveAuth, setDriveAuth] = useState<{ checked: boolean; ok: boolean; url: string }>({ checked: false, ok: true, url: '' });
  // Árvore do Drive
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<DriveNode | null>(null);
  const [treeFolderUrl, setTreeFolderUrl] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<{ documentos: Documento[]; categorias: string[]; consolidado: boolean; empresaAtivaNome: string; empresaAtivaCor: string }>>('getDocumentosEmpresa')
      .then((res) => {
        if (res.ok && res.data) {
          const d = res.data as { documentos: Documento[]; categorias: string[]; consolidado: boolean; empresaAtivaNome: string; empresaAtivaCor: string };
          setDocs(d.documentos || []);
          setCategorias(d.categorias || []);
          setConsolidado(!!d.consolidado);
          setEmpresaNome(d.empresaAtivaNome || '');
          setEmpresaCor(d.empresaAtivaCor || '#8b5cf6');
        }
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  const checkAuth = useCallback(() => {
    callServer<ServerResponse<{ authorized: boolean; authUrl: string }>>('getDriveAuthStatus')
      .then((res) => {
        if (res.ok && res.data) {
          const d = res.data as { authorized: boolean; authUrl: string };
          setDriveAuth({ checked: true, ok: !!d.authorized, url: d.authUrl || '' });
        } else setDriveAuth({ checked: true, ok: true, url: '' });
      })
      .catch(() => setDriveAuth({ checked: true, ok: true, url: '' }));
  }, []);

  useEffect(() => { load(); checkAuth(); }, [load, checkAuth]);

  const abrirArvore = () => {
    setTreeOpen(true);
    setTreeLoading(true);
    setTreeData(null);
    callServer<ServerResponse<{ tree: DriveNode; folderUrl: string }>>('getDriveTreeEmpresa')
      .then((res) => {
        if (res.ok && res.data) {
          const d = res.data as { tree: DriveNode; folderUrl: string };
          setTreeData(d.tree || null);
          setTreeFolderUrl(d.folderUrl || '');
        } else message.error(res.error || 'Erro ao ler o Drive');
      })
      .catch(() => message.error('Erro ao ler o Drive'))
      .finally(() => setTreeLoading(false));
  };

  const recarregarArvore = () => {
    setTreeLoading(true);
    callServer<ServerResponse<{ tree: DriveNode; folderUrl: string }>>('getDriveTreeEmpresa')
      .then((res) => { if (res.ok && res.data) { const d = res.data as { tree: DriveNode; folderUrl: string }; setTreeData(d.tree || null); setTreeFolderUrl(d.folderUrl || ''); } })
      .finally(() => setTreeLoading(false));
  };

  const removerItemDrive = (node: DriveNode) => {
    callServer<ServerResponse<unknown>>('excluirDriveItem', node.id, node.isFolder)
      .then((r) => {
        if (r.ok) { message.success('Removido do Drive'); recarregarArvore(); load(); }
        else message.error(r.error || 'Erro ao apagar');
      })
      .catch(() => message.error('Erro ao apagar'));
  };

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

  const colEmpresa = {
    title: 'Empresa', dataIndex: 'empresaNome', width: 170, ellipsis: true,
    render: (v: string) => <span style={{ color: t.textSecondary, fontSize: 12.5 }}>{v || '—'}</span>,
  };
  const colsBase = [
    {
      title: 'Documento', dataIndex: 'nome', ellipsis: true,
      render: (v: string, d: Documento) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <FileText size={15} style={{ color: t.textTertiary, flexShrink: 0 }} />
          <a href={d.url} target="_blank" rel="noreferrer" style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</a>
        </div>
      ),
    },
    { title: 'Categoria', dataIndex: 'categoria', width: 150, ellipsis: true, render: (v: string) => <Tag>{v}</Tag> },
    ...(consolidado ? [colEmpresa] : []),
    { title: 'Tamanho', dataIndex: 'tamanho', width: 96, align: 'right' as const, render: (v: number) => <span style={{ color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 12 }}>{formatBytes(v)}</span> },
    {
      title: 'Validade', dataIndex: 'validade', width: 124,
      render: (v: string) => v
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: venceProx(v) ? t.accents.rose : t.textSecondary }}>{venceProx(v) && <AlertTriangle size={13} />}{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span style={{ color: t.textTertiary }}>—</span>,
    },
    { title: 'Enviado', dataIndex: 'criadoEm', width: 112, render: (v: string) => <span style={{ color: t.textTertiary, fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> },
    {
      title: 'Ações', key: 'acoes', align: 'right' as const, width: 134,
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
  ];

  // Converte a árvore do servidor pra treeData do Ant, com ações no título.
  const toAntNode = (n: DriveNode): Record<string, unknown> => ({
    key: n.id,
    isLeaf: !n.isFolder,
    title: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        {n.isFolder ? <Folder size={14} style={{ color: t.accents.clay, flexShrink: 0 }} /> : <FileText size={14} style={{ color: t.textTertiary, flexShrink: 0 }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{n.name}</span>
        {!n.isFolder && n.size ? <span style={{ color: t.textTertiary, fontSize: 11, fontFamily: FONTS.mono }}>{formatBytes(n.size)}</span> : null}
        <span className="forja-tree-actions" style={{ display: 'inline-flex', gap: 2 }}>
          <Tooltip title="Abrir no Drive"><Button type="text" size="small" icon={<ExternalLink size={13} />} href={n.url} target="_blank" /></Tooltip>
          {!n.isFolder && n.downloadUrl ? <Tooltip title="Baixar"><Button type="text" size="small" icon={<Download size={13} />} href={n.downloadUrl} target="_blank" /></Tooltip> : null}
          <Popconfirm
            title={n.isFolder ? 'Apagar a pasta e tudo dentro?' : 'Apagar este arquivo?'}
            description="Vai pra lixeira do Drive."
            okText="Apagar" cancelText="Cancelar" okButtonProps={{ danger: true }}
            onConfirm={() => removerItemDrive(n)}
          >
            <Tooltip title="Apagar"><Button type="text" size="small" danger icon={<Trash2 size={13} />} /></Tooltip>
          </Popconfirm>
        </span>
      </div>
    ),
    children: n.children && n.children.length ? n.children.map(toAntNode) : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Reautorização do Drive: escopo novo (auth/drive) exige reconsentimento. */}
      {driveAuth.checked && !driveAuth.ok && (
        <Alert
          type="error" showIcon icon={<ShieldAlert size={16} />}
          message="O Google Drive precisa ser reautorizado"
          description="Adicionamos permissão de escrita no Drive (pra guardar os documentos). Como o app roda com a sua conta, você precisa reautorizar uma vez — senão o upload falha."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              {driveAuth.url && <Button type="primary" href={driveAuth.url} target="_blank" onClick={() => message.info('Após autorizar na aba aberta, volte e clique em "Já autorizei".')}>Autorizar Google Drive</Button>}
              <Button icon={<RefreshCw size={14} />} onClick={checkAuth}>Já autorizei</Button>
            </div>
          }
        />
      )}

      {/* Barra de contexto: deixa explícito de QUAL empresa são estes documentos. */}
      {consolidado ? (
        <Alert
          type="warning" showIcon icon={<Layers size={16} />}
          message="Você está no Consolidado (todas as empresas)"
          description="A lista abaixo mostra os documentos de todas as empresas. Para anexar um documento, selecione uma empresa específica no seletor do topo."
          action={<Button icon={<FolderTree size={14} />} onClick={abrirArvore}>Ver árvore do Drive</Button>}
        />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 12, padding: '10px 14px',
        }}>
          <Building2 size={16} style={{ color: t.textTertiary }} />
          <span style={{ color: t.textSecondary, fontSize: 13 }}>Documentos de</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, color: t.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: empresaCor, display: 'inline-block' }} />
            {empresaNome || 'empresa selecionada'}
          </span>
          <span style={{ color: t.textTertiary, fontSize: 12.5 }}>· troque a empresa no seletor do topo</span>
          <div style={{ flex: 1 }} />
          <Button icon={<FolderTree size={15} />} onClick={abrirArvore}>Ver árvore do Drive</Button>
          <Button type="primary" icon={<Plus size={15} />} onClick={abrirUpload}>Adicionar documento</Button>
        </div>
      )}

      <Panel title={`Documentos (${docs.length})`} padding={8}>
        <Table
          rowKey="id"
          dataSource={docs}
          loading={loading}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum documento ainda — adicione o contrato social, cartão CNPJ…" /> }}
          columns={colsBase}
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 12px',
            }}>
              <Building2 size={15} style={{ color: t.textTertiary }} />
              <span style={{ color: t.textSecondary, fontSize: 12.5 }}>Será anexado a</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: t.text }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: empresaCor, display: 'inline-block' }} />
                {empresaNome || 'empresa selecionada'}
              </span>
            </div>
          )}
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

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderTree size={16} /> Árvore do Drive {consolidado ? '— todas as empresas' : (empresaNome ? `— ${empresaNome}` : '')}
          </div>
        }
        open={treeOpen}
        onCancel={() => setTreeOpen(false)}
        width={640}
        footer={[
          <Button key="reload" icon={<RefreshCw size={14} />} onClick={recarregarArvore} disabled={treeLoading}>Recarregar</Button>,
          treeFolderUrl ? <Button key="open" icon={<ExternalLink size={14} />} href={treeFolderUrl} target="_blank">Abrir pasta no Drive</Button> : null,
          <Button key="close" type="primary" onClick={() => setTreeOpen(false)}>Fechar</Button>,
        ]}
      >
        <style>{`.forja-tree-actions{opacity:0;transition:opacity .15s} .forja-drive-tree .ant-tree-treenode:hover .forja-tree-actions{opacity:1} .forja-drive-tree .ant-tree-node-content-wrapper{width:100%}`}</style>
        {treeLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
        ) : treeData ? (
          <div className="forja-drive-tree" style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Tree
              showLine
              blockNode
              defaultExpandedKeys={[treeData.id, ...((treeData.children || []).map((c) => c.id))]}
              treeData={[toAntNode(treeData)] as never}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pasta vazia — adicione documentos primeiro." />
        )}
      </Modal>
    </div>
  );
}
