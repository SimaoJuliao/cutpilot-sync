/**
 * audioEnvelope.ts
 * The loudness of a source video over time, in 10ms frames.
 *
 * Tightening pauses needs to know where the audio is ACTUALLY quiet. The ASR's
 * word timestamps can't answer that: they are estimates that habitually close a
 * word early (whole runs come back quantised with no gaps), so cutting to them
 * clips syllables. The envelope is measured from the samples themselves.
 *
 * Computed once per source file and cached — decoding the audio of a long
 * recording takes a few seconds, and the same file is often re-processed.
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getFFmpegPath } from './ffmpeg'
import { getCacheDir, evictOldest, cacheKey, writeAtomic } from './diskCache'
import { singleFlight } from './concurrency'

const FRAME_SEC = 0.01                              // read off the envelope via `frameSec`
const SAMPLE_RATE = 8000                            // plenty for a speech envelope
const SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_SEC
const MAX_ENVELOPES = 20                            // ~1MB each for a 40-minute source

export interface AudioEnvelope {
  frameSec: number
  /** RMS level of each frame, in dBFS. */
  db: Float32Array
}

/** Stream the audio out of ffmpeg and fold it into frame levels as it arrives,
 *  rather than buffering tens of MB of PCM for a long recording. */
const measure = (videoPath: string): Promise<Float32Array> => new Promise((resolve, reject) => {
  const ff = spawn(getFFmpegPath(), [
    '-v', 'error', '-i', videoPath,
    '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-',
  ])

  const levels: number[] = []
  let sum = 0
  let count = 0
  let carry: Buffer | null = null   // a sample split across two chunks

  ff.stdout.on('data', (chunk: Buffer) => {
    const buf = carry ? Buffer.concat([carry, chunk]) : chunk
    const whole = buf.length - (buf.length % 2)
    for (let i = 0; i < whole; i += 2) {
      const v = buf.readInt16LE(i) / 32768
      sum += v * v
      if (++count === SAMPLES_PER_FRAME) {
        levels.push(10 * Math.log10(sum / SAMPLES_PER_FRAME + 1e-12))
        sum = 0
        count = 0
      }
    }
    carry = whole < buf.length ? buf.subarray(whole) : null
  })

  let stderr = ''
  ff.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
  ff.on('error', reject)
  ff.on('close', (code) => code === 0
    ? resolve(Float32Array.from(levels))
    : reject(new Error(`ffmpeg exit ${code} ao ler o áudio: ${stderr.slice(-300)}`)))
})

const load = (file: string): AudioEnvelope => {
  const b = readFileSync(file)
  // Copy out of the Buffer so the view is aligned regardless of its byteOffset.
  const bytes = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  return { frameSec: FRAME_SEC, db: new Float32Array(bytes) }
}

export const getAudioEnvelope = (videoPath: string): Promise<AudioEnvelope> => {
  const dir = getCacheDir('envelopes')
  const file = join(dir, `${cacheKey(videoPath, `${SAMPLE_RATE}:${SAMPLES_PER_FRAME}`)}.f32`)
  if (existsSync(file)) return Promise.resolve(load(file))

  return singleFlight(file, async () => {
    const db = await measure(videoPath)
    // Caching is an optimisation here, not the product: a failed write costs the
    // next render one more decode, which is not worth failing this one over.
    await writeAtomic(file, tmp =>
      writeFileSync(tmp, Buffer.from(db.buffer, db.byteOffset, db.byteLength)))
      .catch(e => console.warn('[envelope] cache write failed:', e))
    evictOldest(dir, MAX_ENVELOPES, f => f.endsWith('.f32'))
    return { frameSec: FRAME_SEC, db }
  })
}
