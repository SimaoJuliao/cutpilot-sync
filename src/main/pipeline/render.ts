/**
 * render.ts
 * Takes the EDL JSON (array of {start, end, label}) and source video,
 * extracts each segment, concatenates, and writes the output file.
 *
 * Pipeline:
 *   1. Parse + validate EDL
 *   2. Extract each segment with re-encoding (frame-precise cuts)
 *   3. Write ffmpeg concat list
 *   4. Concat all segments (stream copy — fast)
 *   5. Two-pass loudnorm (-14 LUFS / -1 dBTP / LRA 11)
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, rmdirSync } from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir, cpus } from 'os'
import type { EdlRange, RenderResult, RenderProgress } from '../../../src/renderer/src/types/electron'

const execFileAsync = promisify(execFile)

type ProgressCallback = (progress: RenderProgress) => void

// ─────────────────────────────────────────────────────────────────────────────
// Encoder detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe whether a given FFmpeg encoder is available on this machine by running
 * a quick 1-frame null encode.  Returns true if FFmpeg exits without error.
 */
const probeEncoder = async (codec: string): Promise<boolean> => {
  try {
    await execFileAsync('ffmpeg', [
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

interface EncoderConfig {
  label: string    // human-readable name for logs
  videoArgs: string[] // ffmpeg args replacing -c:v … for segment encoding
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

const detectEncoder = async (): Promise<EncoderConfig> => {
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

interface LoudnormStats {
  input_i: string
  input_lra: string
  input_tp: string
  input_thresh: string
  target_offset: string
}

export const renderVideo = async (
  videoPath: string,
  edlJSON: string,
  outputDir: string,
  onProgress?: ProgressCallback,
  webcamPath?: string,
  syncOffsetSec?: number,
): Promise<RenderResult> => {

  // ── 0. Detect best encoder ────────────────────────────────────────────────
  const encoder = await detectEncoder()
  console.log(`[render] encoder: ${encoder.label}`)

  // ── 1. Parse EDL ─────────────────────────────────────────────────────────
  let ranges: EdlRange[]
  try {
    const parsed = JSON.parse(edlJSON) as unknown
    if (!Array.isArray(parsed)) throw new Error('not an array')
    const MIN_DURATION = 0.1 // seconds — discard micro-segments that would confuse FFmpeg
    const allRanges = (parsed as EdlRange[]).filter(
      (r) => typeof r.start === 'number' && typeof r.end === 'number'
    )
    ranges = allRanges.filter((r) => {
      if (r.end <= r.start) {
        console.warn(`[render] skipping inverted segment (start=${r.start}, end=${r.end})`)
        return false
      }
      if ((r.end - r.start) < MIN_DURATION) {
        console.warn(`[render] skipping micro-segment (${r.end - r.start}s < ${MIN_DURATION}s)`)
        return false
      }
      return true
    })
    if (ranges.length === 0) throw new Error('no valid ranges')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`EDL inválido: ${msg}`)
  }

  // Scale factors depend on whether we also have a webcam pass
  const hasWebcam = !!webcamPath
  // Main video occupies 5→75% (with webcam) or 5→92% (without)
  const mainSegEnd = hasWebcam ? 68 : 75
  const mainConcEnd = hasWebcam ? 72 : 80
  const loudEnd1 = hasWebcam ? 76 : 87
  const loudEnd2 = hasWebcam ? 80 : 92

  onProgress?.({ pct: 5, message: `${ranges.length} segmentos identificados` })

  // ── 2. Working dirs ───────────────────────────────────────────────────────
  const workDir = join(tmpdir(), `cps_render_${Date.now()}`)
  const clipsDir = join(workDir, 'clips')
  mkdirSync(clipsDir, { recursive: true })

  const baseName = basename(videoPath, extname(videoPath))
  const outputPath = join(outputDir, `${baseName}_editado.mp4`)

  try {
    // ── 3. Extract segments ─────────────────────────────────────────────────
    const clipPaths: string[] = []

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]
      const clip = join(clipsDir, `seg_${String(i).padStart(3, '0')}.mp4`)
      clipPaths.push(clip)

      const pct = 5 + Math.round((i / ranges.length) * (mainSegEnd - 5))
      onProgress?.({ pct, message: `A extrair segmento ${i + 1}/${ranges.length}…` })

      await execFileAsync('ffmpeg', [
        '-y',
        '-ss', String(r.start),
        '-to', String(r.end),
        '-i', videoPath,
        ...encoder.videoArgs,
        // Re-encode video (NOT stream-copy) so each segment gets clean timestamps
        // starting from 0. Stream-copy preserves the original source timestamps,
        // causing media players to report the full source duration and show timeline gaps.
        '-c:a', 'aac', '-b:a', '192k',
        '-avoid_negative_ts', 'make_zero',
        clip,
      ])
    }

    // ── 4. Concat ────────────────────────────────────────────────────────────
    onProgress?.({ pct: mainSegEnd + 1, message: 'A juntar segmentos…' })
    const concatList = join(workDir, 'concat.txt')
    writeFileSync(
      concatList,
      clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
    )

    const concatOut = join(workDir, 'concat_out.mp4')
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat', '-safe', '0',
      '-i', concatList,
      '-c', 'copy',
      concatOut,
    ])

    // ── 5. Loudnorm (two-pass) ──────────────────────────────────────────────
    onProgress?.({ pct: mainConcEnd + 1, message: 'A normalizar áudio…' })

    // Pass 1 — measure
    let measureOutput = ''
    await new Promise<void>((resolve, reject) => {
      const ff = execFile('ffmpeg', [
        '-i', concatOut,
        '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
        '-f', 'null', '-',
      ])
      ff.stderr?.on('data', (d: Buffer) => { measureOutput += d.toString() })
      ff.on('close', () => resolve())
      ff.on('error', reject)
    })

    // Extract stats and build pass-2 filter
    const match = measureOutput.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/)
    let loudnormFilter = 'loudnorm=I=-14:TP=-1:LRA=11'
    if (match) {
      try {
        const stats = JSON.parse(match[0]) as LoudnormStats
        loudnormFilter = [
          'loudnorm=I=-14:TP=-1:LRA=11:linear=true',
          `measured_I=${stats.input_i}`,
          `measured_LRA=${stats.input_lra}`,
          `measured_TP=${stats.input_tp}`,
          `measured_thresh=${stats.input_thresh}`,
          `offset=${stats.target_offset}`,
        ].join(':')
      } catch { /* use default filter */ }
    }

    // Pass 2 — apply
    onProgress?.({ pct: loudEnd1 + 1, message: 'A aplicar loudnorm…' })
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', concatOut,
      '-c:v', 'copy',
      '-af', loudnormFilter,
      '-c:a', 'aac', '-b:a', '192k',
      outputPath,
    ])

    const totalDuration = ranges.reduce((sum, r) => sum + (r.end - r.start), 0)

    // ── 6. Webcam pass (optional) ─────────────────────────────────────────────
    let webcamOutputPath: string | undefined
    if (webcamPath) {
      const offset = syncOffsetSec ?? 0
      const wcWorkDir = join(tmpdir(), `cps_render_wc_${Date.now()}`)
      const wcClipsDir = join(wcWorkDir, 'clips')
      mkdirSync(wcClipsDir, { recursive: true })

      const wcBase = basename(webcamPath, extname(webcamPath))
      webcamOutputPath = join(outputDir, `${wcBase}_editado.mp4`)
      const wcClipPaths: string[] = []
      const wcConcatList: string = join(wcWorkDir, 'concat.txt')

      try {
        for (let i = 0; i < ranges.length; i++) {
          const r = ranges[i]
          const clip = join(wcClipsDir, `seg_${String(i).padStart(3, '0')}.mp4`)
          wcClipPaths.push(clip)

          const pct = loudEnd2 + 1 + Math.round((i / ranges.length) * 14)
          onProgress?.({ pct, message: `A cortar câmara ${i + 1}/${ranges.length}…` })

          // Apply sync offset: shift timestamps so webcam aligns with screen recording
          const wcStart = Math.max(0, r.start - offset)
          const wcEnd = Math.max(wcStart + 0.1, r.end - offset)

          await execFileAsync('ffmpeg', [
            '-y',
            '-ss', String(wcStart),
            '-to', String(wcEnd),
            '-i', webcamPath,
            ...encoder.videoArgs,
            // Re-encode webcam (NOT stream-copy) so cuts are frame-accurate.
            // Stream-copy snaps to keyframes which differ between the two cameras,
            // causing the webcam to drift out of sync with the main video.
            '-an',             // no audio stream
            '-avoid_negative_ts', 'make_zero',
            clip,
          ])
        }

        onProgress?.({ pct: 97, message: 'A juntar câmara…' })
        writeFileSync(
          wcConcatList,
          wcClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
        )
        await execFileAsync('ffmpeg', [
          '-y',
          '-f', 'concat', '-safe', '0',
          '-i', wcConcatList,
          '-c', 'copy',
          webcamOutputPath,
        ])
      } finally {
        // Best-effort cleanup of webcam temp dir
        try { wcClipPaths.forEach((f) => unlinkSync(f)) } catch { /* skip */ }
        try { unlinkSync(wcConcatList) } catch { /* skip */ }
        try { rmdirSync(wcClipsDir) } catch { /* skip */ }
        try { rmdirSync(wcWorkDir) } catch { /* skip */ }
      }
    }

    onProgress?.({ pct: 100, message: 'Concluído!' })

    return { outputPath, duration: totalDuration, segments: ranges.length, webcamOutputPath }

  } finally {
    // Best-effort cleanup
    if (existsSync(clipsDir)) {
      try { readdirSync(clipsDir).forEach((f) => unlinkSync(join(clipsDir, f))) } catch { /* skip */ }
    }
    if (existsSync(workDir)) {
      try {
        readdirSync(workDir).forEach((f) => {
          try { unlinkSync(join(workDir, f)) } catch { /* skip dirs */ }
        })
      } catch { /* skip */ }
    }
  }
}
