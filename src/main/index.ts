/* global __GROQ_API_KEY__ __DEEPGRAM_API_KEY__ __ANTHROPIC_API_KEY__ __SUPABASE_URL__ __SUPABASE_SERVICE_ROLE_KEY__ */
import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { BuildPromptOptions, RenderOptions } from '../renderer/src/types/electron'

import { transcribeVideo }                          from './pipeline/transcribe'
import { getCachedTranscription, cacheTranscription } from './pipeline/transcriptionCache'
import { buildPrompt }                                from './pipeline/buildPrompt'
import { callClaude }                                 from './pipeline/callClaude'
import { renderVideo }                                from './pipeline/render'

// ── Single instance + deep link setup ──────────────────────────────────────

let win: BrowserWindow | null = null
let pendingDeepLink: string | null = null

// Force a fixed userData path so dev and protocol-handler invocations share
// the same single-instance lock file — prevents two windows opening on deep link.
app.setPath('userData', join(app.getPath('appData'), 'CutPilotSync'))

// Register the videoeditor:// protocol so the OS knows to open this app.
// In dev mode on Windows the app isn't "installed", so we point electron.exe
// directly at the compiled main entry (out/main/index.js).
if (!app.isPackaged && process.platform === 'win32') {
  app.setAsDefaultProtocolClient('videoeditor', process.execPath, [
    join(process.cwd(), 'out', 'main', 'index.js'),
  ])
} else {
  app.setAsDefaultProtocolClient('videoeditor')
}

// Windows / Linux: prevent a second instance — forward the URL instead
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', (_event, argv) => {
  console.log('[second-instance] argv:', argv)
  const url = argv.find(arg => arg.startsWith('videoeditor://'))
  console.log('[second-instance] deep link url:', url ?? 'NOT FOUND')
  if (url) sendDeepLink(url)
  if (win) { win.show(); win.focus() }
})

// macOS: same-instance open-url event
app.on('open-url', (_event, url) => sendDeepLink(url))

// Check if launched with a deep-link as CLI arg (Windows cold-start)
const urlFromArgs = process.argv.find(a => a.startsWith('videoeditor://'))
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

const createWindow = () => {
  win = new BrowserWindow({
    width:     900,
    height:    680,
    minWidth:  760,
    minHeight: 560,
    titleBarStyle:   'hiddenInset',
    backgroundColor: '#161A22',
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
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

Menu.setApplicationMenu(null)
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── IPC — Video pipeline ────────────────────────────────────────────────────

ipcMain.handle('select-video', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title:   'Selecionar vídeo',
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

ipcMain.handle('render', async (_event, { videoPath, edlJSON, outputDir }: RenderOptions) => {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  try {
    return await renderVideo(videoPath, edlJSON, outputDir, (progress) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('render-progress', progress)
    })
  } catch (err) { console.error('[render]', err); throw err }
})

ipcMain.handle('open-folder', (_event, folderPath: string) => shell.openPath(folderPath))

ipcMain.handle('check-ffmpeg', async () => {
  const { execSync } = await import('child_process')
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true }
  catch { return false }
})

// ── IPC — Auth ──────────────────────────────────────────────────────────────

ipcMain.handle('auth:delete-account', async (_event, accessToken: string) => {
  const url     = __SUPABASE_URL__
  const svcKey  = __SUPABASE_SERVICE_ROLE_KEY__
  if (!url || !svcKey) throw new Error('Supabase não configurado no .env')

  // Dynamically import to keep the bundle lean
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Identify the user from their access token
  const { data: { user }, error: userErr } = await admin.auth.getUser(accessToken)
  if (userErr || !user) throw new Error('Utilizador não encontrado.')

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw new Error(error.message)
})
