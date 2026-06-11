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
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, rmdirSync, renameSync } from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir, cpus } from 'os'
import type { EdlRange, RenderResult, RenderProgress, PipPosition } from '../../../src/renderer/src/types/electron'
import { getFFmpegPath } from './ffmpeg'

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

// ─────────────────────────────────────────────────────────────────────────────
// Frame-rate detection
// ─────────────────────────────────────────────────────────────────────────────

interface Fps { num: number; den: number; value: number }

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
const detectFps = async (videoPath: string): Promise<Fps> => {
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
  pipPosition?: PipPosition,
): Promise<RenderResult> => {

  // ── 0. Detect best encoder ────────────────────────────────────────────────
  const encoder = await detectEncoder()
  console.log(`[render] encoder: ${encoder.label}`)

  // ── 0b. Detect source frame rate — enables frame-exact, drift-free cutting ──
  const fps = await detectFps(videoPath)
  console.log(`[render] source fps: ${fps.num}/${fps.den} (${fps.value.toFixed(4)})`)

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
    // ── 3. Extract segments — video and audio on SEPARATE paths ───────────────
    // CRITICAL (sync fix): cutting the main video WITH audio per segment and then
    // concatenating made the concat demuxer chain each segment by its (slightly
    // longer) AUDIO duration, padding the video timeline. Across ~70 segments this
    // dropped the effective frame rate (29.97 → ~29.90) so the main video drifted
    // out of sync with the webcam — which is cut video-only and stays at exactly
    // 29.97. We now cut video-only (frame-locked, identical to the webcam path)
    // and audio-only as PCM (no AAC priming, sample-exact concat), then mux them
    // back together during loudnorm. This keeps the main video frame-locked to the
    // webcam, eliminating the progressive drift.
    const vClipPaths: string[] = []
    const aClipPaths: string[] = []

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]
      const vClip = join(clipsDir, `v_${String(i).padStart(3, '0')}.mp4`)
      const aClip = join(clipsDir, `a_${String(i).padStart(3, '0')}.wav`)
      vClipPaths.push(vClip)
      aClipPaths.push(aClip)

      const pct = 5 + Math.round((i / ranges.length) * (mainSegEnd - 5))
      onProgress?.({ pct, message: `A extrair segmento ${i + 1}/${ranges.length}…` })

      // This segment's frame count is the single source of truth for its length.
      // Video is cut to EXACTLY segFrames frames; audio to EXACTLY segFrames/fps
      // seconds. Cutting video by frame count (not -to) and matching the audio to
      // it keeps every segment the same length in both streams — so the picture
      // never drifts from the voice, no matter how many segments there are.
      const segFrames = Math.max(1, Math.round((r.end - r.start) * fps.value))
      const segDur = (segFrames * fps.den / fps.num).toFixed(6)

      // Video-only — exactly segFrames frames, frame-locked to the webcam
      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-ss', String(r.start),
        '-i', videoPath,
        '-frames:v', String(segFrames),
        ...encoder.videoArgs,
        '-an',
        '-avoid_negative_ts', 'make_zero',
        vClip,
      ])

      // Audio-only PCM — exactly segDur seconds (apad covers any shortfall at EOF)
      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-ss', String(r.start),
        '-i', videoPath,
        '-t', segDur,
        '-af', 'apad',
        '-vn',
        '-c:a', 'pcm_s16le',
        aClip,
      ])
    }

    // ── 4. Concat video and audio separately ──────────────────────────────────
    onProgress?.({ pct: mainSegEnd + 1, message: 'A juntar segmentos…' })

    const vConcatList = join(workDir, 'vconcat.txt')
    const aConcatList = join(workDir, 'aconcat.txt')
    writeFileSync(vConcatList, vClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
    writeFileSync(aConcatList, aClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))

    const videoConcat = join(workDir, 'video_concat.mp4')
    const audioConcat = join(workDir, 'audio_concat.wav')
    await execFileAsync(getFFmpegPath(), [
      '-y', '-f', 'concat', '-safe', '0', '-i', vConcatList, '-c', 'copy', videoConcat,
    ])
    await execFileAsync(getFFmpegPath(), [
      '-y', '-f', 'concat', '-safe', '0', '-i', aConcatList, '-c', 'copy', audioConcat,
    ])

    // ── 5. Loudnorm (two-pass), muxing the frame-locked video with the audio ───
    onProgress?.({ pct: mainConcEnd + 1, message: 'A normalizar áudio…' })

    // Pass 1 — measure (on the concatenated audio)
    let measureOutput = ''
    await new Promise<void>((resolve, reject) => {
      const ff = execFile(getFFmpegPath(), [
        '-i', audioConcat,
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

    // Pass 2 — copy the frame-locked video, apply loudnorm to the muxed audio
    onProgress?.({ pct: loudEnd1 + 1, message: 'A aplicar loudnorm…' })
    await execFileAsync(getFFmpegPath(), [
      '-y',
      '-i', videoConcat,
      '-i', audioConcat,
      '-map', '0:v:0',
      '-map', '1:a:0',
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
      const wcFps = await detectFps(webcamPath)
      console.log(`[render] webcam fps: ${wcFps.num}/${wcFps.den} (${wcFps.value.toFixed(4)})`)
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

          // Cut the webcam to the SAME duration as the main video's frame-exact
          // segment. When both cameras share a frame rate (the usual case) this is
          // the identical frame count, keeping the webcam frame-locked to the main
          // video — and therefore in sync with the audio.
          const segFrames = Math.max(1, Math.round((r.end - r.start) * fps.value))
          const segDur = segFrames * fps.den / fps.num
          const wcFrames = Math.max(1, Math.round(segDur * wcFps.value))

          await execFileAsync(getFFmpegPath(), [
            '-y',
            '-ss', String(wcStart),
            '-i', webcamPath,
            '-frames:v', String(wcFrames),
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
        await execFileAsync(getFFmpegPath(), [
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

    // ── 7. PiP overlay (optional) ──────────────────────────────────────────────
    // When a position is chosen the webcam is composited onto the main video as
    // a picture-in-picture — the webcam is scaled to 25% of its own width and
    // placed in the selected corner with a 20px margin.
    if (webcamPath && pipPosition && webcamOutputPath) {
      onProgress?.({ pct: 98, message: 'A compor PiP…' })

      const overlayExpr: Record<PipPosition, string> = {
        'top-left':     '20:20',
        'top-right':    'W-w-20:20',
        'bottom-left':  '20:H-h-20',
        'bottom-right': 'W-w-20:H-h-20',
      }

      const pipTemp = join(workDir, 'pip_out.mp4')

      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-i', outputPath,       // main video (audio-normalised)
        '-i', webcamOutputPath, // webcam (no audio)
        '-filter_complex',
        `[1:v]scale=iw/4:-2[pip];[0:v][pip]overlay=${overlayExpr[pipPosition]}`,
        ...encoder.videoArgs,
        '-c:a', 'copy',
        pipTemp,
      ])

      // Replace the main output with the combined PiP file
      unlinkSync(outputPath)
      renameSync(pipTemp, outputPath)

      // Remove the separate webcam file — user gets one combined video
      try { unlinkSync(webcamOutputPath) } catch { /* skip */ }
      webcamOutputPath = undefined

      console.log(`[render] PiP overlay applied — position: ${pipPosition}`)
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
