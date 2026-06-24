/**
 * ffprobe.ts
 * Interrogates FFmpeg and source videos for capabilities and properties:
 *   - detectEncoder(): the best available H.264 encoder on this machine
 *   - detectFps():     a video's exact frame rate (snapped to a standard rational)
 *
 * These are general "ask FFmpeg / ask the file" concerns, independent of the
 * render pipeline, so they live next to ffmpeg.ts (the binary path resolver).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { cpus } from 'os'
import { getFFmpegPath } from './ffmpeg'

const execFileAsync = promisify(execFile)

// ─────────────────────────────────────────────────────────────────────────────
// Encoder detection
// ─────────────────────────────────────────────────────────────────────────────

export interface EncoderConfig {
  label: string       // human-readable name for logs
  videoArgs: string[] // ffmpeg args replacing -c:v … for segment encoding
}

/**
 * Probe whether a given FFmpeg encoder is available on this machine by running
 * a quick 1-frame null encode.  Returns true if FFmpeg exits without error.
 */
const probeEncoder = async (codec: string): Promise<boolean> => {
  try {
    await execFileAsync(getFFmpegPath(), [
      '-f', 'lavfi', '-i', 'nullsrc=s=64x64',
      '-vframes', '1',
      '-c:v', codec,
      '-f', 'null', '-',
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Detect the best available video encoder:
 *   1. NVIDIA GPU  (h264_nvenc)
 *   2. AMD GPU     (h264_amf)
 *   3. Intel GPU   (h264_qsv)
 *   4. CPU libx264 — quality/speed tuned to core count
 *
 * Result is cached so the probe only runs once per process.
 */
let _encoderCache: EncoderConfig | null = null

export const detectEncoder = async (): Promise<EncoderConfig> => {
  if (_encoderCache) return _encoderCache

  // Hardware encoders — much faster than CPU, equivalent quality
  if (await probeEncoder('h264_nvenc')) {
    _encoderCache = {
      label: 'NVIDIA GPU (nvenc)',
      videoArgs: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '18', '-b:v', '0'],
    }
    return _encoderCache
  }

  if (await probeEncoder('h264_amf')) {
    _encoderCache = {
      label: 'AMD GPU (amf)',
      videoArgs: ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '20'],
    }
    return _encoderCache
  }

  if (await probeEncoder('h264_qsv')) {
    _encoderCache = {
      label: 'Intel GPU (qsv)',
      videoArgs: ['-c:v', 'h264_qsv', '-global_quality', '18', '-preset', 'faster'],
    }
    return _encoderCache
  }

  // Software fallback — adapt quality/speed to available CPU cores
  const cores = cpus().length
  const crf = cores >= 8 ? '16' : cores >= 4 ? '18' : '20'
  const preset = cores >= 8 ? 'fast' : 'veryfast'

  _encoderCache = {
    label: `CPU libx264 CRF ${crf} (${cores} cores)`,
    videoArgs: ['-c:v', 'libx264', '-crf', crf, '-preset', preset],
  }
  return _encoderCache
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame-rate detection
// ─────────────────────────────────────────────────────────────────────────────

export interface Fps { num: number; den: number; value: number }

// Standard broadcast/web frame rates. We snap a printed (rounded) fps to its exact
// rational — e.g. "29.97" → 30000/1001 — so per-segment frame counts and audio
// durations can be computed exactly and stay locked together over a long timeline.
const STANDARD_FPS: Fps[] = [
  { num: 24000, den: 1001, value: 24000 / 1001 },
  { num: 24, den: 1, value: 24 },
  { num: 25, den: 1, value: 25 },
  { num: 30000, den: 1001, value: 30000 / 1001 },
  { num: 30, den: 1, value: 30 },
  { num: 48, den: 1, value: 48 },
  { num: 50, den: 1, value: 50 },
  { num: 60000, den: 1001, value: 60000 / 1001 },
  { num: 60, den: 1, value: 60 },
]

/** Probe a video's frame rate via `ffmpeg -i`, snapping to the nearest standard
 *  rational so frame maths is exact. Falls back to a /1000 rational for odd rates. */
export const detectFps = async (videoPath: string): Promise<Fps> => {
  const stderr = await new Promise<string>((resolve) => {
    execFile(getFFmpegPath(), ['-i', videoPath], (_e, _o, err) => resolve(err ?? ''))
  })
  const m = stderr.match(/([0-9]+(?:\.[0-9]+)?)\s*fps/)
  const printed = m ? parseFloat(m[1]) : 30000 / 1001

  let best = STANDARD_FPS[3]
  let bestDiff = Infinity
  for (const s of STANDARD_FPS) {
    const diff = Math.abs(s.value - printed)
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  if (bestDiff > 0.1) {
    const num = Math.round(printed * 1000)
    return { num, den: 1000, value: num / 1000 }
  }
  return best
}
