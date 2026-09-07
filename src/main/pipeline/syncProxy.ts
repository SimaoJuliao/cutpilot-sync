/**
 * syncProxy.ts
 * Small, low-resolution copies of the first minutes of each source video, used
 * only by the sync-marker UI.
 *
 * Why proxies: the sources are 4K, and scrubbing them frame by frame in a
 * <video> element means decoding 4K on every seek — far too slow to hunt for a
 * marker. A 360p copy of the opening scrubs instantly (measured: ~14s to build
 * one from 2 minutes of 4K, then it is cached and reused).
 *
 * The proxy ALWAYS starts at source time 0, with no -ss, so a timestamp read off
 * the proxy is the same timestamp in the source. That identity is what makes the
 * computed offset exact — do not "optimise" this by seeking into the source.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { createHash, randomBytes } from 'crypto'
import { existsSync, statSync, unlinkSync, renameSync } from 'fs'
import { join } from 'path'
import { getFFmpegPath } from './ffmpeg'
import { getCacheDir, evictOldest } from './diskCache'

const execFileAsync = promisify(execFile)

/** How much of the opening is proxied.
 *
 *  Build time is dominated by decoding the 4K source and scales linearly with
 *  this number — 120s took ~14s, 60s takes ~7s — so it is the only lever that
 *  matters. Measured alternatives that did NOT help: hardware decode is 3-4x
 *  SLOWER here (each 4K frame has to be copied back from GPU memory for the
 *  software filter and encoder), `-lowres` is ignored by the H.264 decoder, and
 *  a cheaper scaler saves ~1s at this length while visibly degrading the image.
 *
 *  60s comfortably covers the opening of a take, which is where the speaker is
 *  already talking and lip-sync can be judged. */
export const PROXY_SECONDS = 60
const PROXY_HEIGHT = 360
const MAX_PROXIES = 8   // keep the cache small — these are disposable

export const getProxyDir = (): string => getCacheDir('sync-proxies')

const keyFor = (videoPath: string): string => {
  const st = statSync(videoPath)
  return createHash('sha256')
    .update(`${videoPath}:${st.size}:${st.mtimeMs}:${PROXY_SECONDS}x${PROXY_HEIGHT}`)
    .digest('hex')
    .slice(0, 16)
}

// .tmp.mp4 also ends in .mp4 — never evict an encode that is still running
const isFinishedProxy = (file: string) => file.endsWith('.mp4') && !file.includes('.tmp.')

/** Encodes already running, keyed by output path. Two callers asking for the
 *  same proxy at the same time must share one encode, not race each other:
 *  React StrictMode fires the requesting effect twice in development, and two
 *  ffmpeg processes writing one output produce a truncated file — which then
 *  looks like a valid cache entry and reaches the player as an unplayable
 *  video. Opening the dialog twice quickly does the same thing in production. */
const inFlight = new Map<string, Promise<string>>()

/** Build (or reuse) the proxy for one video. Returns its absolute path. */
export const makeSyncProxy = (videoPath: string): Promise<string> => {
  const dir = getProxyDir()
  const out = join(dir, `${keyFor(videoPath)}.mp4`)
  if (existsSync(out)) return Promise.resolve(out)

  const running = inFlight.get(out)
  if (running) return running

  // Encode to a unique temp name and rename into place, so a run interrupted
  // midway (app closed, machine slept) can never leave a truncated file that the
  // existsSync above would then happily serve as a valid cached proxy.
  const task = (async () => {
    const tmp = `${out}.${randomBytes(6).toString('hex')}.tmp.mp4`
    try {
      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-t', String(PROXY_SECONDS),
        '-i', videoPath,
        '-vf', `scale=-2:${PROXY_HEIGHT}`,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
        '-c:a', 'aac', '-b:a', '64k',
        '-movflags', '+faststart',
        tmp,
      ], { maxBuffer: 10 * 1024 * 1024 })
      renameSync(tmp, out)
    } catch (e) {
      try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* skip */ }
      throw e
    }
    evictOldest(dir, MAX_PROXIES, isFinishedProxy)
    return out
  })()

  inFlight.set(out, task)
  return task.finally(() => inFlight.delete(out))
}
