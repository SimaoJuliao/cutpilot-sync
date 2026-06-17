/**
 * transcriptionCache.ts
 * Caches Groq Whisper results on disk so the same video is never
 * transcribed twice — saves time, API quota, and avoids rate-limit errors.
 *
 * Cache key = SHA-256( videoPath + fileSize + mtimeMs ).slice(0, 16)
 * Any change to the file (size or modification date) busts the cache
 * automatically, so stale results are never returned.
 *
 * Storage: <userData>/cache/transcriptions/<key>.json
 */

import { createHash } from 'crypto'
import {
  statSync, existsSync, readFileSync,
  writeFileSync, mkdirSync, readdirSync,
  unlinkSync
} from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Transcript } from '../../../src/renderer/src/types/electron'

const MAX_ENTRIES = 50   // keep at most 50 cached transcriptions
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

const getCacheDir = (): string => {
  const dir = join(app.getPath('userData'), 'cache', 'transcriptions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// Bump when the Deepgram request parameters change, so existing cache entries
// (transcribed with the old params) are invalidated automatically.
const PARAMS_VERSION = 'detect-gapfill-v5'

const getCacheKey = (videoPath: string): string => {
  const stat = statSync(videoPath)
  const raw = `${videoPath}:${stat.size}:${stat.mtimeMs}:${PARAMS_VERSION}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

// ── Public API ────────────────────────────────────────────────────────────────

export const getCachedTranscription = (videoPath: string): Transcript | null => {
  try {
    const key = getCacheKey(videoPath)
    const cachePath = join(getCacheDir(), `${key}.json`)
    if (!existsSync(cachePath)) return null

    const entry = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
      savedAt: number
      transcript: Transcript
    }

    // Expire entries older than MAX_AGE_MS
    if (Date.now() - entry.savedAt > MAX_AGE_MS) {
      unlinkSync(cachePath)
      return null
    }

    console.log('[transcription-cache] hit —', key)
    return entry.transcript
  } catch {
    return null  // corrupt / unreadable entry — treat as miss
  }
}

export const cacheTranscription = (videoPath: string, transcript: Transcript): void => {
  try {
    const dir = getCacheDir()
    const key = getCacheKey(videoPath)
    const cachePath = join(dir, `${key}.json`)

    writeFileSync(cachePath, JSON.stringify({ savedAt: Date.now(), transcript }), 'utf-8')
    console.log('[transcription-cache] saved —', key)

    // Evict oldest entries if over the limit
    evictOldest(dir)
  } catch (e) {
    console.warn('[transcription-cache] write failed:', e)
    // Non-fatal — the transcription still worked, just won't be cached
  }
}

const evictOldest = (dir: string): void => {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const p = join(dir, f)
        return { path: p, mtime: statSync(p).mtimeMs }
      })
      .sort((a, b) => a.mtime - b.mtime)  // oldest first

    if (files.length > MAX_ENTRIES) {
      files.slice(0, files.length - MAX_ENTRIES).forEach(({ path }) => {
        try { unlinkSync(path) } catch { /* skip */ }
      })
    }
  } catch { /* skip */ }
}
