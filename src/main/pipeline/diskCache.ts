/**
 * diskCache.ts
 * Where the app keeps its own on-disk caches, and how they are pruned.
 *
 * The location is deliberate and load-bearing. Windows paths are
 * case-insensitive, so `<userData>/cache` IS Chromium's own `Cache` directory —
 * anything stored beside it gets wiped whenever Chromium prunes its HTTP cache.
 * That silently destroyed transcriptions that cost real API credits, and left
 * half-written video proxies behind. Everything we cache therefore lives under
 * `<userData>/cps-cache/`, which Chromium does not touch.
 *
 * This module exists so that root is named once. It was duplicated across two
 * caches before, which is exactly how the original bug survived a rename.
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs'
import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import { app } from 'electron'

/** Absolute path to one of our cache subdirectories, created if missing. */
export const getCacheDir = (name: string): string => {
  const dir = join(app.getPath('userData'), 'cps-cache', name)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Cache key for a derivative of `videoPath`, built from the file's identity plus
 * whatever parameters produced the derivative.
 *
 * Size and mtime bust the key whenever the source changes, so a stale result is
 * never served. `params` busts it whenever WE change how the derivative is made
 * — a different sample rate, proxy size, or ASR request — which is why every
 * caller must pass one.
 */
export const cacheKey = (videoPath: string, params: string): string => {
  const st = statSync(videoPath)
  return createHash('sha256')
    .update(`${videoPath}:${st.size}:${st.mtimeMs}:${params}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Write `file` via a uniquely-named temp file, so `file` only ever exists
 * complete.
 *
 * A run interrupted midway — app closed, machine slept — must leave debris, not
 * a truncated file that `existsSync` would then happily serve as a valid cache
 * entry forever. The temp name is random rather than derived from the pid
 * because two producers in one process share a pid. `suffix` is for callers
 * whose eviction filter matches on extension; the temp name keeps it so the
 * filter can exclude writes still in progress.
 *
 * `write` is handed the temp path and must create it. Throws if it cannot be
 * put in place, having removed the temp file — callers for whom caching is
 * merely an optimisation should catch that and carry on.
 */
export const writeAtomic = async (
  file: string,
  write: (tmpPath: string) => Promise<void> | void,
  suffix = '',
): Promise<void> => {
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp${suffix}`
  try {
    await write(tmp)
    renameSync(tmp, file)
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* skip */ }
    throw e
  }
}

/**
 * Keep the newest `keep` entries in `dir` and delete the rest, oldest first.
 * `isEntry` decides what counts — callers must exclude their own in-progress
 * temp files, or an encode still being written can be evicted mid-write.
 * Best-effort: a cache that cannot be pruned is not worth failing a job over.
 */
export const evictOldest = (dir: string, keep: number, isEntry: (file: string) => boolean): void => {
  try {
    const files = readdirSync(dir)
      .filter(isEntry)
      .map(f => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime)
    files.slice(0, Math.max(0, files.length - keep))
      .forEach(({ path }) => { try { unlinkSync(path) } catch { /* skip */ } })
  } catch { /* skip */ }
}
