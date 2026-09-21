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
import { existsSync } from 'fs'
import { join } from 'path'
import { getFFmpegPath } from './ffmpeg'
import { getCacheDir, evictOldest, cacheKey, writeAtomic } from './diskCache'
import { singleFlight } from './concurrency'

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

// .tmp.mp4 also ends in .mp4 — never evict an encode that is still running
const isFinishedProxy = (file: string) => file.endsWith('.mp4') && !file.includes('.tmp.')

/** Build (or reuse) the proxy for one video. Returns its absolute path. */
export const makeSyncProxy = (videoPath: string): Promise<string> => {
  const dir = getProxyDir()
  const out = join(dir, `${cacheKey(videoPath, `${PROXY_SECONDS}x${PROXY_HEIGHT}`)}.mp4`)
  if (existsSync(out)) return Promise.resolve(out)

  return singleFlight(out, async () => {
    await writeAtomic(out, tmp => execFileAsync(getFFmpegPath(), [
      '-y',
      '-t', String(PROXY_SECONDS),
      '-i', videoPath,
      '-vf', `scale=-2:${PROXY_HEIGHT}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      tmp,
    ], { maxBuffer: 10 * 1024 * 1024 }).then(() => undefined), '.mp4')
    evictOldest(dir, MAX_PROXIES, isFinishedProxy)
    return out
  })
}
