# CutPilot Sync

AI-powered desktop video editor — transcribes your footage, decides the cuts, and renders the final result automatically.

---

## What it does

1. **Drop a video** (MP4, MOV, MKV, AVI, WEBM) — screen recording, talking head, lecture, anything with speech
2. **AI analyses it** — Deepgram transcribes every word with precise timestamps; Claude identifies the best segments to keep and cuts dead air, retakes, filler words, and long pauses
3. **Get the result** — a clean, ready-to-publish video in the same folder as the original

Optionally add a **webcam recording** — the app cuts both files at the exact same points, keeping them in sync.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron 31 + electron-vite |
| UI | React 18 + TypeScript + Tailwind CSS |
| Fonts | Bebas Neue (display) + JetBrains Mono (mono) |
| Transcription | Deepgram Nova-3 — word-level timestamps, speaker diarisation |
| AI editing | Anthropic Claude (`claude-sonnet-4-5`) |
| Rendering | FFmpeg (installed locally by the user) |
| Auth | Supabase Auth (email + password) |
| Auto-update | electron-updater + GitHub Releases |

---

## Project structure

```
src/
├── main/                        # Main process (Node.js / Electron)
│   ├── index.ts                 # Window, deep links, IPC handlers, auto-updater
│   ├── i18n/
│   │   ├── pt.ts                # Portuguese strings for Electron dialogs
│   │   └── index.ts             # Active locale export
│   └── pipeline/
│       ├── transcribe.ts        # Deepgram Nova-3 → word-level transcript
│       ├── buildPrompt.ts       # Formats transcript into a Claude prompt (EDL request)
│       ├── callClaude.ts        # Calls Claude API → edit decision list (EDL)
│       ├── render.ts            # FFmpeg → extracts segments, concat, loudnorm
│       └── transcriptionCache.ts # SHA-256 disk cache — avoids re-transcribing unchanged files
├── preload/
│   └── index.ts                 # Secure main ↔ renderer bridge (contextBridge)
└── renderer/src/                # React UI
    ├── App.tsx                  # Root: auth gate + header + step router
    ├── components/
    │   ├── Auth/
    │   │   ├── AuthScreen.tsx         # Login, signup, forgot, verify, reset views
    │   │   └── AccountSettings.tsx    # Change password, logout, delete account
    │   ├── Onboarding/          # First-run welcome screen
    │   ├── StepUpload/          # Video drop zones + webcam + sync offset
    │   ├── StepProcess/         # Live progress: transcribe → analyse → export
    │   └── StepDone/            # Result stats + open folder
    ├── hooks/
    │   ├── useApp.ts            # Global step state (upload → process → done)
    │   └── useAuth.ts           # Auth state, deep-link handling, all auth actions
    ├── lib/
    │   ├── supabase.ts          # Supabase client (renderer)
    │   └── utils.ts             # cn(), fmtTime(), dirname(), basename()
    └── i18n/
        ├── pt.ts                # All UI strings in Portuguese
        └── index.ts             # Active locale export
```

---

## Development setup

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [FFmpeg](https://ffmpeg.org/download.html) installed and on PATH

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Deepgram (transcription)
DEEPGRAM_API_KEY=...

# Anthropic Claude (AI editing)
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (auth)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# GitHub (publishing releases — only needed when running npm run dist)
GH_TOKEN=ghp_...
```

> **Note:** `.env` is in `.gitignore` and is never committed. All keys are compiled into the app bundle at build time via Vite's `define` — the `.env` file is not shipped inside the installer.

### 3. Run in development

```bash
npm run dev
```

### 4. Build for distribution

```bash
# Build installer only (no upload)
npm run dist

# Build + publish to GitHub Releases
$env:GH_TOKEN = (Get-Content .env | Where-Object { $_ -match '^GH_TOKEN=' }) -replace '^GH_TOKEN=', ''
npm run dist -- --publish=always
```

The installer is generated in `/dist` (`.exe` on Windows, `.dmg` on macOS).

---

## Releasing a new version

1. Make your changes
2. Bump the version in `package.json` (e.g. `0.0.1` → `0.0.2`)
3. Run the publish command above
4. electron-builder builds the installer, uploads it to GitHub Releases, and generates `latest.yml`
5. Users with the app already installed receive an automatic update notification on next launch

---

## Supabase setup

### 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your users
3. Wait ~2 minutes for provisioning

### 2. Copy the keys

**Settings → API** → copy to `.env`:

| Supabase field | Variable |
|---|---|
| Project URL | `SUPABASE_URL` |
| anon public | `SUPABASE_ANON_KEY` |
| service_role secret | `SUPABASE_SERVICE_ROLE_KEY` |

### 3. Configure redirect URL

**Authentication → URL Configuration**:

| Field | Value |
|---|---|
| Site URL | `cutpilotsync://auth/callback` |
| Redirect URLs | `cutpilotsync://auth/callback` |

This ensures password-reset links open directly in the app.

### 4. Configure email (Resend)

By default, Supabase free tier limits outbound emails to ~2–4/hour. To remove the cap:

1. Create an account at [resend.com](https://resend.com) and generate an API key with **Sending access**
2. Add and verify your domain in Resend
3. In Supabase → **Settings → Authentication → SMTP Settings**:

| Field | Value |
|---|---|
| Enable Custom SMTP | ✅ ON |
| Sender email | `noreply@yourdomain.com` |
| Sender name | `CutPilot Sync` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |

### 5. Customise email templates

**Authentication → Email Templates → Reset Password**:

```html
<h2>Reset your password</h2>
<p>Click the link below to set a new password. The link expires in 1 hour.</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

**Authentication → Email Templates → Confirm signup**:

```html
<h2>Confirm your email</h2>
<p>Click the link below to activate your account.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email</a></p>
```

### 6. Enable email confirmation (production)

**Authentication → Providers → Email** → **Confirm email**: ✅ ON

Disable this during development to speed up testing.

---

## Authentication flow

```
App starts
  │
  ├─ authLoading → shows "…"
  │
  ├─ no user → AuthScreen
  │     ├─ login
  │     ├─ signup → verify (confirmation email)
  │     ├─ forgot → sends link → verify
  │     └─ reset (triggered by cutpilotsync:// deep link)
  │
  └─ authenticated user → Main app
        └─ ⚙ AccountSettings
              ├─ view email
              ├─ change password
              ├─ sign out
              └─ delete account
```

### Password reset deep link

1. User clicks "Forgot password?" and enters their email
2. Supabase sends an email with a link pointing to `cutpilotsync://auth/callback`
3. User clicks the link → OS opens the app with the token in the URL fragment
4. `useAuth.ts` detects `type=recovery`, restores the session, shows the new-password form
5. User sets a new password → automatic login

---

## Environment variables — reference

| Variable | Used in | How to get |
|---|---|---|
| `DEEPGRAM_API_KEY` | Main process (transcription) | [deepgram.com](https://deepgram.com) → API Keys |
| `ANTHROPIC_API_KEY` | Main process (AI editing) | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SUPABASE_URL` | Main + Renderer | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Renderer only | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Main process only | Supabase → Settings → API → service_role |
| `GH_TOKEN` | Build time only (publishing) | GitHub → Settings → Developer settings → Personal access tokens |

---

## Production checklist

### APIs
- [ ] `DEEPGRAM_API_KEY` valid and with available credits
- [ ] `ANTHROPIC_API_KEY` valid and with sufficient credits
- [ ] `GH_TOKEN` has `Contents: Read and write` on the target repository

### Supabase
- [ ] All Supabase variables filled in `.env`
- [ ] Site URL and Redirect URL set to `cutpilotsync://auth/callback`
- [ ] Custom SMTP (Resend) configured and tested
- [ ] Email confirmation enabled
- [ ] Domain verified in Resend
- [ ] Email templates customised (reset + signup)
- [ ] Full auth flow tested: signup → confirm email → login → reset password → change password → logout → delete account

### App
- [ ] FFmpeg available on the target machine
- [ ] Tested on a clean machine (no dev dependencies)
- [ ] `cutpilotsync://` deep link works in the production build
- [ ] GitHub repository is **public** (required for anonymous installer downloads)
- [ ] Release is published (not Draft) on GitHub Releases
