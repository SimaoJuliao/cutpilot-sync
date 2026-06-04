/* global __GROQ_API_KEY__ __DEEPGRAM_API_KEY__ __ANTHROPIC_API_KEY__ __SUPABASE_URL__ __SUPABASE_SERVICE_ROLE_KEY__ */
import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import { strings } from './i18n'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { BuildPromptOptions, RenderOptions } from '../renderer/src/types/electron'

import { transcribeVideo } from './pipeline/transcribe'
import { getCachedTranscription, cacheTranscription } from './pipeline/transcriptionCache'
import { buildPrompt } from './pipeline/buildPrompt'
import { callClaude } from './pipeline/callClaude'
import { renderVideo } from './pipeline/render'

// ── Single instance + deep link setup ──────────────────────────────────────

let win: BrowserWindow | null = null
let pendingDeepLink: string | null = null

// Force a fixed userData path so dev and protocol-handler invocations share
// the same single-instance lock file — prevents two windows opening on deep link.
app.setPath('userData', join(app.getPath('appData'), 'CutPilotSync'))

// Register the cutpilotsync:// protocol so the OS knows to open this app.
// In dev mode on Windows the app isn't "installed", so we point electron.exe
// directly at the compiled main entry (out/main/index.js).
// NOTE: app.getAppPath() is used instead of process.cwd() because Windows
// launches protocol handlers with cwd=C:\Windows\System32, making cwd unreliable.
if (!app.isPackaged && process.platform === 'win32') {
  app.setAsDefaultProtocolClient('cutpilotsync', process.execPath, [
    join(app.getAppPath(), 'out', 'main', 'index.js'),
  ])
} else {
  app.setAsDefaultProtocolClient('cutpilotsync')
}

// Windows / Linux: prevent a second instance — forward the URL instead
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', (_event, argv) => {
  console.log('[second-instance] argv:', argv)
  const url = argv.find(arg => arg.startsWith('cutpilotsync://'))
  console.log('[second-instance] deep link url:', url ?? 'NOT FOUND')
  if (url) sendDeepLink(url)
  if (win) { win.show(); win.focus() }
})

// macOS: same-instance open-url event
app.on('open-url', (_event, url) => sendDeepLink(url))

// Check if launched with a deep-link as CLI arg (Windows cold-start)
const urlFromArgs = process.argv.find(a => a.startsWith('cutpilotsync://'))
if (urlFromArgs) pendingDeepLink = urlFromArgs

const sendDeepLink = (url: string) => {
  console.log('[sendDeepLink] win exists:', !!win, '| url:', url)
  if (win) {
    win.webContents.send('auth:deep-link', url)
    console.log('[sendDeepLink] IPC sent to renderer')
  } else {
    pendingDeepLink = url
    console.log('[sendDeepLink] stored as pendingDeepLink')
  }
}

// ── Window ──────────────────────────────────────────────────────────────────

// Icon path: .ico on Windows, .icns on macOS, .png on Linux
const iconFile = process.platform === 'win32' ? 'icon.ico'
  : process.platform === 'darwin' ? 'icon.icns'
    : 'icon.png'
const appIcon = join(__dirname, '../../build', iconFile)

const createWindow = () => {
  win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#161A22',
    icon: appIcon,
    show: false, // show only after maximize to avoid visual flash
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open maximized, then reveal — avoids the "small window → maximize" flash
  win.once('ready-to-show', () => {
    win?.maximize()
    win?.show()
  })

  // F12 toggles DevTools
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12') win!.webContents.toggleDevTools()
  })

  // Flush any pending deep link once the page is ready
  win.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      win?.webContents.send('auth:deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Auto-updater ─────────────────────────────────────────────────────────────

// On macOS without code signing, auto-download/install is blocked by Gatekeeper.
// Strategy:
//   - macOS: detect update → show dialog → open GitHub releases page in browser
//   - Windows/Linux: auto-download → show restart dialog
const isMacOS = process.platform === 'darwin'

if (isMacOS) {
  // On macOS, don't auto-download — just notify and redirect to download page
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    const t = strings.updater
    dialog.showMessageBox({
      type: 'info',
      title: t.availableTitle,
      message: `${t.availableMessage} (v${info.version})`,
      detail: t.availableDetail,
      buttons: [t.downloadBtn, t.skipBtn],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        shell.openExternal('https://github.com/SimaoJuliao/cutpilot-sync/releases/latest')
      }
    })
  })
} else {
  // Windows / Linux: auto-download works fine, show restart dialog when ready
  autoUpdater.on('update-downloaded', () => {
    const t = strings.updater
    dialog.showMessageBox({
      type: 'info',
      title: t.title,
      message: t.message,
      detail: t.detail,
      buttons: [t.restartBtn, t.laterBtn],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })
}

autoUpdater.on('error', (err) => {
  console.error('[updater] erro:', err?.message ?? err)
})

Menu.setApplicationMenu(null)
app.whenReady().then(() => {
  createWindow()
  // Check for updates 3 seconds after startup (gives the window time to load)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  }
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── IPC — Video pipeline ────────────────────────────────────────────────────

ipcMain.handle('select-video', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Selecionar vídeo',
    filters: [{ name: 'Vídeo', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] }],
    properties: ['openFile'],
  })
  return filePaths[0] ?? null
})

ipcMain.handle('transcribe', async (_event, videoPath: string) => {
  const apiKey = __DEEPGRAM_API_KEY__
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY não configurada — verifica o .env e reinicia')

  // Return cached result if the video hasn't changed — saves quota and time
  const cached = getCachedTranscription(videoPath)
  if (cached) {
    BrowserWindow.getAllWindows()[0]?.webContents.send('transcribe-progress', 100)
    return cached
  }

  try {
    const result = await transcribeVideo(videoPath, apiKey, (pct) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('transcribe-progress', pct)
    })
    cacheTranscription(videoPath, result)
    return result
  } catch (err) { console.error('[transcribe]', err); throw err }
})

ipcMain.handle('call-claude', async (_event, { transcript, videoName, language }: BuildPromptOptions) => {
  const apiKey = __ANTHROPIC_API_KEY__
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada — verifica o .env e reinicia')
  const prompt = buildPrompt(transcript, videoName, language)
  try {
    return await callClaude(prompt, apiKey, (chunk) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('claude-progress', chunk)
    })
  } catch (err) { console.error('[call-claude]', err); throw err }
})

ipcMain.handle('render', async (_event, { videoPath, edlJSON, outputDir, webcamPath, syncOffsetSec }: RenderOptions) => {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  try {
    return await renderVideo(videoPath, edlJSON, outputDir, (progress) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('render-progress', progress)
    }, webcamPath, syncOffsetSec)
  } catch (err) { console.error('[render]', err); throw err }
})

ipcMain.handle('open-folder', (_event, folderPath: string) => shell.openPath(folderPath))

ipcMain.handle('check-ffmpeg', async () => {
  const { execFileSync } = await import('child_process')
  const { getFFmpegPath } = await import('./pipeline/ffmpeg')
  try { execFileSync(getFFmpegPath(), ['-version'], { stdio: 'ignore' }); return true }
  catch { return false }
})

// ── IPC — Auth ──────────────────────────────────────────────────────────────

ipcMain.handle('auth:delete-account', async (_event, accessToken: string) => {
  const url = __SUPABASE_URL__
  const svcKey = __SUPABASE_SERVICE_ROLE_KEY__
  if (!url || !svcKey) throw new Error('Supabase não configurado no .env')

  // Use fetch directly to avoid Supabase Realtime WebSocket init (Node.js 20 has no native WS)

  // Step 1: resolve user ID from the access token
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: svcKey },
  })
  if (!userRes.ok) throw new Error('Utilizador não encontrado.')
  const { id: userId } = await userRes.json() as { id: string }

  // Step 2: delete via Admin API
  const deleteRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${svcKey}`, apikey: svcKey },
  })
  if (!deleteRes.ok) {
    const err = await deleteRes.json() as { message?: string }
    throw new Error(err.message ?? 'Erro ao eliminar conta.')
  }
})
