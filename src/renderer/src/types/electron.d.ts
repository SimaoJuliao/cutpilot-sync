// Types for the Electron contextBridge API and shared domain types

export interface ScribeWord {
  text: string
  start: number
  end: number
  type?: 'word' | 'spacing' | 'audio_event'
  speaker?: number
}

export interface Transcript {
  words: ScribeWord[]
  language: string
  text: string
}

export interface EdlRange {
  start: number
  end: number
  label?: string
}

export interface BuildPromptOptions {
  transcript: Transcript
  videoName: string
  language: string
}

export interface RenderOptions {
  videoPath: string
  edlJSON: string
  outputDir: string
  /** Optional webcam video (no audio). Will be cut with the same EDL ranges. */
  webcamPath?: string
  /** Seconds to subtract from every EDL timestamp when cutting the webcam.
   *  Use when the webcam started later than the screen recording.
   *  Defaults to 0 (both recordings started simultaneously). */
  syncOffsetSec?: number
}

export interface RenderProgress {
  pct: number
  message: string
}

export interface RenderResult {
  outputPath: string
  duration: number
  segments: number
  /** Set when a webcam video was also cut. */
  webcamOutputPath?: string
}

export interface ElectronFile extends File {
  path: string
}

export interface ElectronAPI {
  // Video pipeline
  selectVideo: () => Promise<string | null>
  transcribe: (videoPath: string) => Promise<Transcript>
  callClaude: (opts: BuildPromptOptions) => Promise<EdlRange[]>
  render: (opts: RenderOptions) => Promise<RenderResult>
  openFolder: (path: string) => Promise<void>
  checkFFmpeg: () => Promise<boolean>
  onTranscribeProgress: (cb: (pct: number) => void) => void
  onClaudeProgress: (cb: (chunk: string) => void) => void
  onRenderProgress: (cb: (progress: RenderProgress) => void) => void
  removeAllListeners: (channel: string) => void

  // Auth
  deleteAccount: (accessToken: string) => Promise<void>
  onDeepLink: (cb: (url: string) => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
