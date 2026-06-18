# Driver — Conectar OneDrive e contas Google extras (OAuth)

Guia passo-a-passo pra ligar a sincronização multi-cloud do **Atelier → Driver**.
A conexão é via **OAuth** (consentimento) — o Forja **nunca** pede sua senha.
Os tokens ficam no `UserProperties` do script; as credenciais do app OAuth ficam
no `ScriptProperties`.

## Visão geral (3 passos)

1. **Registre um app OAuth** no provedor (Azure pro OneDrive / Google Cloud pra contas Google).
2. **Cole Client ID + Secret** no Forja (Driver → Contas & nuvens → **Credenciais OAuth**).
3. Clique em **Conectar** na conta → consinta na janela → pronto.

> A **Redirect URI** que você precisa registrar aparece no próprio modal de
> Credenciais (botão de copiar). Ela tem o formato:
> `https://script.google.com/macros/d/<SCRIPT_ID>/usercallback`

---

## A) OneDrive / Microsoft 365 (Microsoft Graph)

1. Acesse o **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**.
   - Link direto: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
2. **Name:** `Forja Driver` (ou o que quiser).
3. **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts" (multi-tenant + pessoal).
4. **Redirect URI:** plataforma **Web** → cole a Redirect URI do Forja (modal Credenciais).
5. **Register**.
6. Copie o **Application (client) ID** → é o seu **Client ID**.
7. **Certificates & secrets** → **New client secret** → copie o **Value** (não o "Secret ID") → é o seu **Client Secret**.
8. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → adicione:
   - `Files.Read`
   - `User.Read`
   - `offline_access`
9. No Forja: **Credenciais OAuth** → provedor **OneDrive** → cole Client ID + Secret → **Salvar**.
10. **Conectar** na conta OneDrive.

> Conta corporativa/escolar pode exigir aprovação do admin do tenant. Conta
> pessoal Microsoft conecta direto.

---

## B) Conta Google extra (Google Drive)

1. Acesse o **Google Cloud Console** → crie/seleciona um projeto.
   - https://console.cloud.google.com/
2. **APIs & Services** → **Enabled APIs & services** → **+ Enable APIs** → habilite **Google Drive API**.
3. **OAuth consent screen**:
   - User type: **External** (ou Internal, se Workspace).
   - Preencha nome do app, e-mail de suporte e de contato.
   - **Scopes:** adicione `.../auth/drive.readonly`.
   - **Test users:** adicione os e-mails das contas Google que você vai conectar
     (enquanto o app estiver em "Testing").
4. **Credentials** → **Create credentials** → **OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs:** cole a Redirect URI do Forja (modal Credenciais).
   - **Create** → copie **Client ID** e **Client Secret**.
5. No Forja: **Credenciais OAuth** → provedor **Google Drive (outra conta)** → cole → **Salvar**.
6. **Conectar** na conta → escolha a conta Google desejada → consinta.

> Uma única credencial Google cobre **várias** contas Google extras — cada conta
> vira uma conexão própria (token separado).

---

## Depois de conectar

- **Driver → Arquivos**: o seletor de fonte no topo lista "Meu Drive (este app)"
  e cada conta remota conectada. Troque pra navegar pastas, buscar e abrir arquivos.
- **Desconectar**: revoga o token local da conta (as credenciais do provedor ficam).
- **Reconfigurar credenciais**: basta salvar de novo no modal Credenciais.

## Solução de problemas

- **"redirect_uri_mismatch"**: a Redirect URI no provedor tem que ser **idêntica**
  à mostrada no modal (copie pelo botão).
- **OneDrive 401/403**: confirme as permissões delegadas (`Files.Read`, `User.Read`,
  `offline_access`) e que o secret colado é o **Value**, não o ID.
- **Google "access_denied" / app não verificado**: adicione sua conta em **Test users**
  na tela de consentimento, ou publique o app.
- **Token expira**: o `offline_access` / `access_type=offline` garante refresh
  automático. Se desconectar sozinho, clique em **Conectar** de novo.
