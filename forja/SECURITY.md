# Forja — Segurança

Modelo de segurança da Forja, com foco no Cofre criptografado (zero-knowledge).

---

## TL;DR

| Componente | Modelo |
|---|---|
| **Cofre** | Zero-knowledge AES-256-GCM, chaves derivadas client-side via PBKDF2 |
| **Chaves API (LLM/GitHub)** | Script Properties (privadas ao seu projeto GAS) |
| **Dados gerais** | Google Sheets (privacidade da sua conta Google) |
| **Snapshot/Backup** | JSON cifra somente o cofre; resto vai em claro (é seu, mas atenção ao compartilhar) |
| **Transporte** | HTTPS nativo do `script.google.com` |
| **Autenticação** | OAuth do Google (single-user, web app rodando como você) |

---

## Threat model

**Cenários que a Forja protege:**

1. ✅ **Cofre vazado em snapshot** → ciphertext sem senha-mestra é ruído
2. ✅ **Servidor (GAS) comprometido** → não tem senha-mestra, não decifra cofre
3. ✅ **Chave LLM roubada** → guardada em Script Properties privadas, não é exposta ao frontend
4. ✅ **Acesso não autorizado ao web app** → OAuth do Google; só você abre

**Cenários que a Forja NÃO protege:**

1. ❌ **Sua conta Google comprometida** → atacante vê Sheets, Script Properties, snapshot
2. ❌ **Browser comprometido (malware/extensão)** → captura senha-mestra do cofre
3. ❌ **Você compartilha senha-mestra** → cofre comprometido
4. ❌ **Você comita snapshot.json em repo público** → cofre cifrado vai junto (sem senha-mestra ainda é seguro, mas dados não-cofre vazam)
5. ❌ **Brute force se senha-mestra fraca** → PBKDF2 com 100k iter ajuda mas <12 chars é arriscado

---

## Cofre — protocolo completo

### Setup inicial

```
Usuário cria senha-mestra P
1. salt = WebCrypto.getRandomValues(16 bytes)
2. wrappingKey = PBKDF2(P, salt, 100_000 iter, SHA-256) → AES-256
3. vaultKey = WebCrypto.generateKey(AES-GCM, 256) → AES-256 aleatória
4. wrapIv = WebCrypto.getRandomValues(12 bytes)
5. wrappedKey = AES-GCM-Encrypt(vaultKey, wrappingKey, wrapIv)
6. verificador = AES-GCM-Encrypt("forja-vault-v1", vaultKey, novoIv) + IV junto

Servidor armazena (em Script Properties):
  - COFRE_SALT          = base64(salt)
  - COFRE_WRAPPED_KEY   = base64(wrappedKey)
  - COFRE_WRAP_IV       = base64(wrapIv)
  - COFRE_VERIFICADOR   = base64(verificador)

Servidor JAMAIS vê: P, wrappingKey, vaultKey
```

### Unlock (próximas sessões)

```
Usuário digita senha P
1. Frontend baixa config: salt, wrappedKey, wrapIv, verificador
2. wrappingKey = PBKDF2(P, salt, 100_000 iter)
3. Tenta: vaultKey = AES-GCM-Decrypt(wrappedKey, wrappingKey, wrapIv)
4. Verifica: AES-GCM-Decrypt(verificador, vaultKey) === "forja-vault-v1" ?
   - SIM → desbloqueado, vaultKey vive na memória React
   - NÃO → senha errada (sem revelar mais nada)
```

### Adicionar segredo

```
Usuário digita: { label, segredo, ... }
1. iv = WebCrypto.getRandomValues(12 bytes)
2. cipher = AES-GCM-Encrypt(segredo, vaultKey, iv)
3. Salva na sheet `Cofre`:
   { id, label, categoria, iv: base64(iv), cipher: base64(cipher), ... }

Servidor SÓ vê: label, categoria (metadados) + ciphertext.
PLAINTEXT do segredo nunca trafega.
```

### Revelar segredo

```
Usuário clica "👁 Revelar"
1. Frontend pega { iv, cipher } do estado
2. plaintext = AES-GCM-Decrypt(cipher, vaultKey, iv)
3. Mostra inline (cache em memória, NÃO persistente)

Auto-lock: após 5 minutos sem interação, vaultKey é zerada.
```

### Reset (emergência)

Se você esquece a senha-mestra:

```
1. Botão "Reset emergencial" em Atelier > Cofre
2. Confirmação dupla
3. Servidor deleta:
   - Script Properties COFRE_*
   - TODA a sheet Cofre (ciphertexts inúteis sem vaultKey)
4. Cofre volta ao estado "não inicializado"
```

⚠️ Não há recovery. Não há backup remoto. Por isso o snapshot exporta o cofre cifrado — você pode reimportar e usar a senha-mestra antiga.

---

## Chaves API (LLM, GitHub)

Guardadas em **Script Properties**, que são:

- Privadas ao seu projeto GAS
- Não enviadas ao frontend (o servidor faz as chamadas externas via `UrlFetchApp`)
- Acessíveis APENAS ao código do seu próprio projeto + ao próprio Google

O frontend recebe apenas `temChave: true/false` pra renderizar UI ("já configurado" vs "configure agora").

### Substituir chave

Vá em `Configurações > Conexão de IA`, preencha o campo de chave (o placeholder mostra `••••••••• (mantida)`). Salvar substitui no servidor.

### Inspecionar via GAS

Editor GAS → `Configurações do projeto > Script properties` → você vê os nomes (`LLM_API_KEY`) mas o valor é seu mesmo. Não compartilhe screenshot.

---

## Snapshot export — o que vaza

O JSON gerado por `Backup & Restore > Baixar snapshot`:

| Dado | No snapshot? | Sensível? |
|---|---|---|
| Sistemas, ideias, clientes, custos, etc. | ✅ Sim, em claro | Sim (cuide do arquivo) |
| Skills, snippets, templates, bookmarks | ✅ Sim, em claro | Pode conter prompts proprietários |
| Cofre — metadados (label, categoria, URL) | ✅ Sim, em claro | Médio |
| Cofre — segredos (cipher, iv) | ✅ Sim, CIFRADO | Sem senha-mestra: inútil |
| Cofre — config (salt, wrappedKey, etc.) | ✅ Sim | Só perigoso com a senha-mestra |
| **Chaves LLM/GitHub** | ❌ NUNCA | — |
| **Tokens OAuth** | ❌ NUNCA | — |

**Recomendação:** trate o snapshot como dado confidencial. Não comite em repo público. Guarde em pasta cifrada (Disk Utility no Mac, BitLocker no Windows, EncFS no Linux) ou em cloud com encryption-at-rest sob sua chave.

---

## Encryption details

| Parâmetro | Valor | Por quê |
|---|---|---|
| Algoritmo simétrico | **AES-256-GCM** | Padrão moderno, authenticated encryption (não dá pra alterar ciphertext sem detectar) |
| Derivação de chave | **PBKDF2-SHA256, 100k iter** | Lento o suficiente pra travar brute force, rápido o suficiente pra UX (~200ms) |
| IV | 12 bytes random por encryption | GCM requer IV único; never reuse |
| Salt | 16 bytes random por usuário | Inviabiliza rainbow tables |
| Verificador | Texto fixo `"forja-vault-v1"` cifrado | Permite validar senha sem comparar hashes |

Implementação 100% em `src/cofreCrypto.ts` usando **Web Crypto API nativa do browser** — sem dependência de libs externas (CryptoJS, sjcl, etc.) que poderiam ter bugs ou ser comprometidas via supply chain.

---

## Por que client-side?

Alternativa seria cifrar no servidor (GAS) com `Utilities.computeHmacSignature` + `Utilities.newBlob` ... mas:

1. A senha-mestra teria que trafegar até o servidor → expõe a transporte (HTTPS é seguro, mas zero-knowledge é mais forte)
2. O servidor teria a chance de logar/cachear → quebra zero-knowledge
3. Se o GAS for comprometido (improvável mas possível), perdeu o cofre

Client-side: senha nunca sai do browser, vaultKey nunca persiste em disco, só vive em memória de uma aba aberta.

---

## Auditoria & Verificação

Você é developer e quer auditar a crypto? Olhe:

1. **`forja/src/cofreCrypto.ts`** (~120 linhas) — toda a lógica de chaves
2. **`forja/src/components/CofrePanel.tsx`** — fluxo de UI (unlock, encrypt, decrypt, reset)
3. **`forja/src/server.ts` → `cofreGetConfig`, `cofreSetConfig`, `cofreList`, `cofreSave`** — APIs do servidor (note que NUNCA tocam em plaintext)

Achou bug? Abra issue. Suporte responsável: bater na minha porta antes (single-user app, mas qualquer melhoria é bem-vinda).

---

## Boas práticas pro usuário

1. **Senha-mestra forte**: 16+ caracteres, mix de tipos. Use um gerador.
2. **Não reuse senha**: a senha-mestra deve ser exclusiva da Forja.
3. **Guarde-a em outro lugar**: 1Password, Bitwarden, KeePass — porque se esquecer, é game over.
4. **Não compartilhe screenshot do cofre destravado**.
5. **Auto-lock**: deixe ativado (default 5 min). Se trabalha em ambiente compartilhado, reduza pra 1 min.
6. **Snapshot regular**: mensal, mínimo. Guarde com a senha-mestra separada (mas em local seguro).

---

## Resumo do que o Google Apps Script enxerga

| Onde o servidor enxerga | Conteúdo |
|---|---|
| Sheets | Tudo: sistemas, ideias, financeiro, cofre metadados (label, categoria, IV, ciphertext) |
| Script Properties | Chaves LLM/GitHub, config do cofre (salt, wrappedKey — todos cifrados ou opacos) |
| Memória de execução | Plaintext da request, JSON de resposta, mas SÓ DURANTE a execução (não loga) |

O servidor **NUNCA** vê:
- Senha-mestra do cofre
- vaultKey (derivada client-side)
- Plaintext dos segredos do cofre
- Plaintext da resposta do LLM (passa de cliente → servidor → LLM e volta — não persiste)

---

**Encontrou problema de segurança?** Abra issue privada ou contate diretamente. Não publique exploits.
