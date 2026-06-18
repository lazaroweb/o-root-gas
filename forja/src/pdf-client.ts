// Helpers de PDF no cliente. O PDF é gerado no servidor (GAS) e devolvido em
// base64 — aqui convertemos pra Blob e disparamos o download de forma confiável,
// sem depender de window.print() (instável dentro do iframe do Apps Script).
import callServer from './gas-client';
import type { ServerResponse } from './types';

interface PdfPayload { filename: string; base64: string; mime?: string }

export function baixarPdfBase64(filename: string, base64: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = /\.pdf$/i.test(filename) ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

// Baixa um arquivo binário qualquer (ex.: XLSX) a partir de base64 + mime.
export function baixarArquivoBase64(filename: string, base64: string, mime: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

// Chama uma função do servidor que retorna { filename, base64 } e baixa o PDF.
// Retorna true em sucesso; em falha, lança com a mensagem do servidor.
export async function gerarEbaixarPdf(fnName: string, ...args: unknown[]): Promise<true> {
  const res = await callServer<ServerResponse<PdfPayload>>(fnName, ...args);
  if (res.ok && res.data && res.data.base64) {
    baixarPdfBase64(res.data.filename || 'documento.pdf', res.data.base64);
    return true;
  }
  throw new Error(res.error || 'Falha ao gerar o PDF');
}
