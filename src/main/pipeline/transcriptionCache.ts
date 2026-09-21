/**
 * transcriptionCache.ts
 * Caches Groq Whisper results on disk so the same video is never
 * transcribed twice — saves time, API quota, and avoids rate-limit errors.
 *
 * Keyed by `cacheKey` in diskCache.ts, so any change to the file — or to
 * PARAMS_VERSION below — busts the cache automatically and stale results are
 * never returned.
 *
 * Storage: <userData>/cps-cache/transcriptions/<key>.json — see diskCache.ts
 * for why that root is not `<userData>/cache`.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { Transcript } from '../../../src/renderer/src/types/electron'
import { getCacheDir, evictOldest, cacheKey } from './diskCache'

const MAX_ENTRIES = 50   // keep at most 50 cached transcriptions
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

const cacheDir = () => getCacheDir('transcriptions')

// Bump when the Deepgram request parameters change, so existing cache entries
// (transcribed with the old params) are invalidated automatically.
const PARAMS_VERSION = 'detect-gapfill-keyterm-v8'

const getCacheKey = (videoPath: string): string => cacheKey(videoPath, PARAMS_VERSION)

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
