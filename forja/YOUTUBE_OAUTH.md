# Estudos → Conectar o YouTube (OAuth)

Guia passo-a-passo pra ligar o **Estudos → Minha conta** ao seu YouTube. A conexão
é via **OAuth próprio** (você cria um app no Google Cloud), igual ao Driver. O Forja
**nunca** pede sua senha — só recebe um token de **leitura** (`youtube.readonly`).

> Por que OAuth próprio e não a permissão nativa do app? Porque `youtube.readonly`
> é um scope "sensível". Em contas **Google Workspace** com app não verificado, o
> Google bloqueia a autorização e devolve **tela branca**. Usando o token de um
> conector OAuth seu (com sua tela de consentimento), isso não acontece.

---

## Visão geral (3 passos)

1. **Habilite a API + crie as credenciais** no Google Cloud.
2. **Cole Client ID + Secret** no Forja (Estudos → Minha conta → **Configurar**).
3. Clique em **Conectar** → consinta na janela → pronto.

A **Redirect URI** que você precisa registrar aparece no próprio modal de
credenciais (botão de copiar). Formato:
`https://script.google.com/macros/d/<SCRIPT_ID>/usercallback`

---

## Passo a passo

1. Acesse o **Google Cloud Console** → crie/seleciona um projeto.
   - https://console.cloud.google.com/
2. **APIs e serviços → Biblioteca** → procure **YouTube Data API v3** → **Ativar**.
3. **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo** (ou Interno, se for Workspace e você quiser só a org).
   - Preencha nome do app, e-mail de suporte e de contato.
   - **Escopos:** adicione `.../auth/youtube.readonly`.
   - **Usuários de teste:** adicione o e-mail da conta do YouTube que você vai conectar
     (necessário enquanto o app estiver em "Testing").
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados:** cole a Redirect URI do Forja (modal Configurar).
   - **Criar** → copie **Client ID** e **Client Secret**.
5. No Forja: **Estudos → Minha conta → Configurar** → cole Client ID + Secret → **Salvar**.
6. Clique em **Conectar** → escolha a conta → consinta. Depois clique em
   **Verificar conexão** se a tela não atualizar sozinha.

---

## Depois de conectar

- **Curtidos / Playlists / Buscar** ficam disponíveis na aba **Minha conta**.
- Cada vídeo pode ser **tocado** na aba Assistir ou **salvo nos favoritos**.
- **Desconectar**: ícone de sair no cabeçalho (revoga o token local; as credenciais ficam).

## Solução de problemas

- **"redirect_uri_mismatch"**: a Redirect URI no Google tem que ser **idêntica** à
  mostrada no modal (use o botão de copiar).
- **"Ative a YouTube Data API v3…"**: você criou as credenciais mas não habilitou a
  API no mesmo projeto (passo 2).
- **"access_denied" / app não verificado**: adicione sua conta em **Usuários de teste**
  na tela de consentimento, ou publique o app.
- **Conexão expirou**: clique em **Conectar** de novo (o `access_type=offline` renova
  o token automaticamente na maioria dos casos).
