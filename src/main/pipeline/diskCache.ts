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

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/** Absolute path to one of our cache subdirectories, created if missing. */
export const getCacheDir = (name: string): string => {
  const dir = join(app.getPath('userData'), 'cps-cache', name)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
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
