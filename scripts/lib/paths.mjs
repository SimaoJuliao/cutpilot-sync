/**
 * paths.mjs
 * Locations the dev scripts share, named once.
 *
 * The transcription cache path in particular must stay in step with
 * src/main/pipeline/diskCache.ts. It is NOT under <userData>/cache: on Windows
 * that folder is the same directory as Chromium's own `Cache` (paths are
 * case-insensitive), which Chromium wipes when it prunes its HTTP cache. The
 * scripts had their own copy of this path when it was fixed, which is exactly
 * how a rename comes to miss one caller.
 */

import { readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

/** Repository root (this file lives in <root>/scripts/lib/). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Transcripts kept deliberately for regression runs. */
export const CORPUS_DIR = join(ROOT, '.edl-corpus')

/** Snapshots of what the deterministic EDL layer decided, per corpus entry. */
export const BASELINE_DIR = join(ROOT, '.edl-baselines')

/** The app's own transcription cache — mirrors diskCache.ts `getCacheDir`. */
export const defaultCacheDir = () => {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'CutPilotSync', 'cps-cache', 'transcriptions')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'CutPilotSync', 'cps-cache', 'transcriptions')
  }
  return join(homedir(), '.config', 'CutPilotSync', 'cps-cache', 'transcriptions')
}

/** JSON files in `dir`, newest first, as { file, path, mtime }. */
export const jsonFilesByNewest = (dir) =>
  readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
