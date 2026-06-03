import { contextBridge, ipcRenderer } from 'electron'
import type {
  Transcript,
  BuildPromptOptions,
  EdlRange,
  RenderOptions,
  RenderResult,
  RenderProgress,
} from '../renderer/src/types/electron'

contextBridge.exposeInMainWorld('api', {
  // ── Video pipeline ──────────────────────────────────────────────────────────
  selectVideo: (): Promise<string | null> => ipcRenderer.invoke('select-video'),
  transcribe: (videoPath: string): Promise<Transcript> => ipcRenderer.invoke('transcribe', videoPath),
  callClaude: (opts: BuildPromptOptions): Promise<EdlRange[]> => ipcRenderer.invoke('call-claude', opts),
  render: (opts: RenderOptions): Promise<RenderResult> => ipcRenderer.invoke('render', opts),
  openFolder: (path: string): Promise<void> => ipcRenderer.invoke('open-folder', path),
  checkFFmpeg: (): Promise<boolean> => ipcRenderer.invoke('check-ffmpeg'),

  onTranscribeProgress: (cb: (pct: number) => void) =>
    ipcRenderer.on('transcribe-progress', (_, v: number) => cb(v)),

  onClaudeProgress: (cb: (chunk: string) => void) =>
    ipcRenderer.on('claude-progress', (_, chunk: string) => cb(chunk)),

  onRenderProgress: (cb: (progress: RenderProgress) => void) =>
    ipcRenderer.on('render-progress', (_, v: RenderProgress) => cb(v)),

  removeAllListeners: (ch: string) => ipcRenderer.removeAllListeners(ch),

  // ── Auth ────────────────────────────────────────────────────────────────────
  /** Delete the currently logged-in user via the admin API (main process only). */
  deleteAccount: (accessToken: string): Promise<void> =>
    ipcRenderer.invoke('auth:delete-account', accessToken),

  /** Listen for deep-link callbacks (password reset). Returns a cleanup fn. */
  onDeepLink: (cb: (url: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, url: string) => cb(url)
    ipcRenderer.on('auth:deep-link', handler)
    return () => ipcRenderer.removeListener('auth:deep-link', handler)
  },
})
