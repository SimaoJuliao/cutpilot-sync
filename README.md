# Video Editor App

Editor de vídeo automático com IA — transcreve, decide os cortes e renderiza o resultado final.

---

## O que faz

1. **Carregas um vídeo** (MP4, MOV, MKV, AVI, WEBM)
2. **A IA analisa** — transcreve o áudio com Groq Whisper e envia para o Claude da Anthropic, que decide os melhores cortes com base no conteúdo
3. **Recebe o resultado** — o vídeo final editado, pronto a publicar

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| App desktop | Electron 31 + electron-vite |
| UI | React 18 + TypeScript + Tailwind CSS |
| Fontes | Bebas Neue (display) + JetBrains Mono (mono) |
| Transcrição | Groq Whisper (`whisper-large-v3-turbo`) — gratuito |
| IA de corte | Anthropic Claude (`claude-opus-4-5` ou similar) |
| Renderização | FFmpeg (local, instalado pelo utilizador) |
| Auth | Supabase Auth (email/password) |
| Email | Resend (SMTP personalizado) |

---

## Estrutura do projeto

```
src/
├── main/                    # Processo principal (Node.js / Electron)
│   ├── index.ts             # Janela, deep links, IPC handlers
│   └── pipeline/
│       ├── transcribe.ts    # Groq Whisper → segmentos com timestamps
│       ├── buildPrompt.ts   # Formata transcrição para o Claude
│       ├── callClaude.ts    # Chama Claude API → lista de cortes (EDL)
│       └── render.ts        # FFmpeg → renderiza vídeo final
├── preload/
│   └── index.ts             # Bridge segura main ↔ renderer (contextBridge)
└── renderer/src/            # Interface React
    ├── App.tsx              # Root: auth gate + layout principal
    ├── components/
    │   ├── Auth/
    │   │   ├── AuthScreen.tsx      # Login, signup, forgot, verify, reset
    │   │   └── AccountSettings.tsx # Alterar password, logout, eliminar conta
    │   ├── Onboarding/      # Ecrã de boas-vindas (primeira vez)
    │   ├── StepUpload/      # Upload + validação do vídeo
    │   ├── StepProcess/     # Progresso do pipeline (transcrição → IA → render)
    │   └── StepDone/        # Resultado final + abrir pasta
    ├── hooks/
    │   ├── useApp.ts        # Estado global da app (step, videoPath, result)
    │   └── useAuth.ts       # Auth state, deep links, todas as acções de auth
    ├── lib/
    │   ├── supabase.ts      # Cliente Supabase (renderer)
    │   └── utils.ts         # cn(), fmtTime(), dirname(), basename()
    └── i18n/
        └── pt.ts            # Todas as strings em português
```

---

## Setup de desenvolvimento

### Pré-requisitos

- [Node.js](https://nodejs.org) 18+
- [FFmpeg](https://ffmpeg.org/download.html) instalado e no PATH

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Cria um ficheiro `.env` na raiz do projecto:

```env
# Groq (transcrição — gratuito)
GROQ_API_KEY=gsk_...

# Anthropic Claude (IA de corte)
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (auth)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

> ⚠️ Nunca commites o `.env` — está no `.gitignore`.
> A `SERVICE_ROLE_KEY` só é usada no processo principal (Node.js). Nunca é exposta ao renderer.

### 3. Correr em desenvolvimento

```bash
npm run dev
```

### 4. Build para distribuição

```bash
npm run dist
```

Gera o instalador em `/dist` (`.exe` no Windows, `.dmg` no macOS).

---

## Configuração do Supabase

### 1. Criar o projecto

1. Vai a [supabase.com](https://supabase.com) → **New project**
2. Escolhe região **West EU (Ireland)**
3. Aguarda ~2 minutos

### 2. Copiar as chaves

**Settings → API** → copia para o `.env`:

| Campo no Supabase | Variável |
|---|---|
| Project URL | `SUPABASE_URL` |
| anon public | `SUPABASE_ANON_KEY` |
| service_role secret | `SUPABASE_SERVICE_ROLE_KEY` |

### 3. Configurar URL de redirect

**Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `videoeditor://auth/callback` |
| Redirect URLs | `videoeditor://auth/callback` |

> Isto faz com que os links de reset de password abram directamente a app.

### 4. Configurar email (Resend)

Por defeito, o Supabase gratuito só envia ~2-4 emails por hora. Para remover esse limite:

**a)** Cria conta em [resend.com](https://resend.com)

**b)** Resend → **API Keys** → **Create API Key**
- Name: `supabase-video-editor`
- Permission: `Sending access`
- Copia a chave (`re_...`)

**c)** Resend → **Domains** → adiciona o teu domínio (ex: `videoeditor.pt`)
- Segue as instruções de DNS que o Resend fornece
- Aguarda verificação (pode demorar minutos a horas dependendo do DNS)

**d)** Supabase → **Settings → Authentication → SMTP Settings**:

| Campo | Valor |
|---|---|
| Enable Custom SMTP | ✅ ON |
| Sender email | `noreply@teudominio.com` |
| Sender name | `Video Editor` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a tua API key do Resend (`re_...`) |

### 5. Personalizar templates de email

**Authentication → Email Templates → Reset Password** — substitui o link de confirmação:

```html
<h2>Redefinir a tua password</h2>
<p>Clica no link abaixo para definir uma nova password. O link expira em 1 hora.</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir password</a></p>
<p>Se não pediste isto, podes ignorar este email com segurança.</p>
```

**Authentication → Email Templates → Confirm signup**:

```html
<h2>Confirma o teu email</h2>
<p>Clica no link abaixo para activar a tua conta.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar email</a></p>
```

### 6. Activar confirmação de email (produção)

**Authentication → Providers → Email**:
- **Confirm email**: ✅ ON (desliga durante desenvolvimento para facilitar testes)

---

## Checklist de produção

Antes de distribuir a app, verifica:

### Supabase
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` preenchidos no `.env`
- [ ] Site URL e Redirect URL configurados: `videoeditor://auth/callback`
- [ ] Custom SMTP (Resend) configurado e testado
- [ ] "Confirm email" activado
- [ ] Domínio verificado no Resend
- [ ] Templates de email personalizados (reset + signup)
- [ ] Testar fluxo completo: signup → confirmar email → login → reset password → login → alterar password → logout → eliminar conta

### APIs
- [ ] `GROQ_API_KEY` válida e com créditos (free tier)
- [ ] `ANTHROPIC_API_KEY` válida e com créditos suficientes

### App
- [ ] FFmpeg detectado no instalador (ou bundled)
- [ ] Build testado em máquina limpa
- [ ] Protocolo `videoeditor://` funciona no build final (não é necessário testar em dev)
- [ ] `.env` incluído no build (ver `extraResources` no `package.json`)

---

## Fluxo de autenticação

```
App inicia
  │
  ├─ authLoading → mostra "…"
  │
  ├─ !user → AuthScreen
  │     ├─ login
  │     ├─ signup → verify (email de confirmação)
  │     ├─ forgot → envia link → verify
  │     └─ reset (accionado por deep link videoeditor://)
  │
  └─ user autenticado → App principal
        └─ ⚙ AccountSettings
              ├─ ver email
              ├─ alterar password
              ├─ terminar sessão
              └─ eliminar conta
```

### Deep link (reset de password)

1. User clica "Esqueceste a password?" → introduce email
2. Supabase envia email com link do tipo `https://xxx.supabase.co/auth/v1/verify?...&redirect_to=videoeditor://auth/callback`
3. User clica o link no email
4. Supabase verifica e redireciona para `videoeditor://auth/callback#access_token=...&type=recovery`
5. O OS abre a app com esse URL
6. `useAuth.ts` detecta `type=recovery`, define a sessão, mostra o formulário de nova password
7. User define a nova password → login automático

---

## Variáveis de ambiente — referência completa

| Variável | Onde é usada | Como obter |
|---|---|---|
| `GROQ_API_KEY` | Main process (transcrição) | [console.groq.com](https://console.groq.com) → API Keys |
| `ANTHROPIC_API_KEY` | Main process (IA de corte) | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SUPABASE_URL` | Main + Renderer | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Renderer apenas | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Main process apenas | Supabase → Settings → API → service_role |
