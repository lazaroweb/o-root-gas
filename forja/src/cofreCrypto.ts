// ─── Cofre — primitivas de criptografia (browser-side, Web Crypto API) ──────
//
// Modelo zero-knowledge: o servidor NUNCA vê texto plano nem a senha-mestra.
//
// Fluxo de inicialização (primeira vez que o user usa o cofre):
//   1. User escolhe uma senha-mestra.
//   2. Gera um salt aleatório (16 bytes).
//   3. Deriva uma "wrapping key" via PBKDF2(senha, salt, 250k iterações).
//   4. Gera uma "vault key" aleatória (AES-256-GCM, 32 bytes).
//   5. Encripta a vault key com a wrapping key → wrappedKey + wrapIv.
//   6. Cifra um "verificador" conhecido com a vault key → guarda no server.
//      (Serve pra confirmar "essa senha está certa" antes de tentar decifrar tudo.)
//   7. Salva no server (PropertiesService) apenas: salt, wrappedKey, wrapIv, verificador.
//
// Fluxo de unlock:
//   1. User digita a senha-mestra.
//   2. Derive wrapping key com mesma senha + salt salvo.
//   3. Decripta wrappedKey → vault key.
//   4. Decripta o verificador. Se der texto esperado → senha está certa. Mantém
//      vault key em memória (nunca persiste).
//
// Fluxo de cifrar segredo:
//   1. Gera IV aleatório (12 bytes).
//   2. AES-GCM(vaultKey, plaintext, iv) → ciphertext.
//   3. Envia {iv, cipher} pro server.
//
// Fluxo de decifrar:
//   1. AES-GCM-decrypt(vaultKey, cipher, iv) → plaintext.

const TEXTO_VERIFICADOR = 'forja:cofre:ok:v1';
const PBKDF2_ITERATIONS = 250_000;

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function importarSenha(senha: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
}

async function derivarWrappingKey(senha: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await importarSenha(senha);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
}

async function gerarVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export interface CofreConfigInicial {
  salt: string;
  wrappedKey: string;
  wrapIv: string;
  verificador: string;
}

/**
 * Inicializa o cofre pela primeira vez.
 *
 * Gera salt + wrapping key (PBKDF2 da senha) + vault key (AES-256 random) +
 * verificador (texto conhecido cifrado), e devolve:
 *  - `config`: pra ser persistida no servidor (Script Properties)
 *  - `vaultKey`: pra usar imediatamente em memória (não persiste)
 *
 * @param senha Senha-mestra escolhida pelo usuário. Não é armazenada.
 * @throws Nenhum (Web Crypto não falha em condições normais)
 */
export async function inicializarCofre(senha: string): Promise<{ config: CofreConfigInicial; vaultKey: CryptoKey }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bufToB64(saltBytes);

  const wrappingKey = await derivarWrappingKey(senha, salt);
  const vaultKey = await gerarVaultKey();

  // Exporta a vault key como raw bytes pra cifrar com a wrapping key
  const rawVault = await crypto.subtle.exportKey('raw', vaultKey);
  const wrapIvBytes = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKeyBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIvBytes },
    wrappingKey,
    rawVault,
  );

  // Cifra um texto conhecido com a vault key → verificador.
  const verIvBytes = crypto.getRandomValues(new Uint8Array(12));
  const verCipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: verIvBytes },
    vaultKey,
    new TextEncoder().encode(TEXTO_VERIFICADOR),
  );

  // O verificador combina iv + ciphertext em um único campo
  const verificadorBytes = new Uint8Array(verIvBytes.length + new Uint8Array(verCipherBuf).length);
  verificadorBytes.set(verIvBytes, 0);
  verificadorBytes.set(new Uint8Array(verCipherBuf), verIvBytes.length);

  return {
    config: {
      salt,
      wrappedKey: bufToB64(wrappedKeyBuf),
      wrapIv: bufToB64(wrapIvBytes),
      verificador: bufToB64(verificadorBytes),
    },
    vaultKey,
  };
}

/**
 * Tenta destravar o cofre com a senha-mestra + config existente.
 *
 * Faz dupla validação: (1) decifra o `wrappedKey` com a `wrappingKey` derivada,
 * e (2) decifra o `verificador` e compara com o texto conhecido. Apenas se ambos
 * passarem é que a vault key é considerada válida.
 *
 * @returns `CryptoKey` da vault se a senha estiver correta, `null` caso contrário.
 *          O retorno opaco (null vs erro) evita timing attacks.
 */
export async function destravarCofre(
  senha: string,
  config: { salt: string; wrappedKey: string; wrapIv: string; verificador: string },
): Promise<CryptoKey | null> {
  try {
    const wrappingKey = await derivarWrappingKey(senha, config.salt);

    // Decripta a wrapped vault key
    const rawVaultBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBuf(config.wrapIv) },
      wrappingKey,
      b64ToBuf(config.wrappedKey),
    );

    const vaultKey = await crypto.subtle.importKey(
      'raw',
      rawVaultBuf,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt'],
    );

    // Valida com o verificador (iv + cipher concatenados)
    const verifBytes = b64ToBuf(config.verificador);
    const verIv = verifBytes.slice(0, 12);
    const verCipher = verifBytes.slice(12);
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: verIv },
      vaultKey,
      verCipher,
    );
    const decoded = new TextDecoder().decode(decryptedBuf);
    if (decoded !== TEXTO_VERIFICADOR) return null;

    return vaultKey;
  } catch {
    // Decryption error = senha errada (ou cofre corrompido)
    return null;
  }
}

export interface SegredoCifrado {
  iv: string;
  cipher: string;
}

/**
 * Cifra um segredo (string) com a vaultKey usando AES-GCM e um IV aleatório.
 *
 * Cada chamada gera um IV novo (12 bytes random) — NUNCA reutilizar IV em GCM,
 * isso destrói a confidencialidade. O IV vai junto no payload em claro (é normal).
 *
 * @param vaultKey Chave AES-GCM 256 obtida via `destravarCofre` ou `inicializarCofre`.
 * @param plaintext Texto puro do segredo (chave de API, senha, etc.)
 * @returns Objeto com `iv` (base64) e `cipher` (base64) — pronto pra persistir.
 */
export async function cifrarSegredo(vaultKey: CryptoKey, plaintext: string): Promise<SegredoCifrado> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    vaultKey,
    new TextEncoder().encode(plaintext),
  );
  return { iv: bufToB64(ivBytes), cipher: bufToB64(cipherBuf) };
}

/**
 * Decifra um segredo cifrado anteriormente por `cifrarSegredo`.
 *
 * @throws DOMException se o ciphertext foi alterado/truncado (GCM detecta
 *         tampering via tag de autenticação) — a UI deve tratar como dado corrompido.
 */
export async function decifrarSegredo(vaultKey: CryptoKey, dados: { iv: string; cipher: string }): Promise<string> {
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(dados.iv) },
    vaultKey,
    b64ToBuf(dados.cipher),
  );
  return new TextDecoder().decode(buf);
}
