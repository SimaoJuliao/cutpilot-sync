/**
 * transcriptionCache.ts
 * Caches Groq Whisper results on disk so the same video is never
 * transcribed twice — saves time, API quota, and avoids rate-limit errors.
 *
 * Cache key = SHA-256( videoPath + fileSize + mtimeMs ).slice(0, 16)
 * Any change to the file (size or modification date) busts the cache
 * automatically, so stale results are never returned.
 *
 * Storage: <userData>/cps-cache/transcriptions/<key>.json — see diskCache.ts
 * for why that root is not `<userData>/cache`.
 */

import { createHash } from 'crypto'
import { statSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { Transcript } from '../../../src/renderer/src/types/electron'
import { getCacheDir, evictOldest } from './diskCache'

const MAX_ENTRIES = 50   // keep at most 50 cached transcriptions
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

const cacheDir = () => getCacheDir('transcriptions')

// Bump when the Deepgram request parameters change, so existing cache entries
// (transcribed with the old params) are invalidated automatically.
const PARAMS_VERSION = 'detect-gapfill-keyterm-v8'

const getCacheKey = (videoPath: string): string => {
  const stat = statSync(videoPath)
  const raw = `${videoPath}:${stat.size}:${stat.mtimeMs}:${PARAMS_VERSION}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

// ── Public API ────────────────────────────────────────────────────────────────

export const getCachedTranscription = (videoPath: string): Transcript | null => {
  try {
    const key = getCacheKey(videoPath)
    const cachePath = join(cacheDir(), `${key}.json`)
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
    const dir = cacheDir()
    const key = getCacheKey(videoPath)
    const cachePath = join(dir, `${key}.json`)

    writeFileSync(cachePath, JSON.stringify({ savedAt: Date.now(), transcript }), 'utf-8')
    console.log('[transcription-cache] saved —', key)

    evictOldest(dir, MAX_ENTRIES, f => f.endsWith('.json'))
  } catch (e) {
    // Non-fatal — the transcription still worked, it just won't be cached
    console.warn('[transcription-cache] write failed:', e)
  }
}
