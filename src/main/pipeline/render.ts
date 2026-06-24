/**
 * render.ts
 * Takes the EDL JSON (array of {start, end, label}) and source video,
 * extracts each segment, concatenates, and writes the output file.
 *
 * Pipeline:
 *   1. Parse + validate EDL
 *   2. Extract each segment with re-encoding (frame-precise cuts)
 *   3. Concat the per-segment video and audio streams
 *   4. Two-pass loudnorm (-14 LUFS / -1 dBTP / LRA 11)
 *   5. Final encode — PiP overlay (single video) or webcam as a second file
 *
 * Encoder/fps probing lives in ffprobe.ts; the concurrency pool in concurrency.ts.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, mkdirSync, unlinkSync, rmdirSync, rmSync } from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir } from 'os'
import type { EdlRange, RenderResult, RenderProgress, PipPosition } from '../../../src/renderer/src/types/electron'
import { getFFmpegPath } from './ffmpeg'
import { detectEncoder, detectFps, type EncoderConfig, type Fps } from './ffprobe'
import { runPool } from './concurrency'

const execFileAsync = promisify(execFile)

type ProgressCallback = (progress: RenderProgress) => void

interface LoudnormStats {
  input_i: string
  input_lra: string
  input_tp: string
  input_thresh: string
  target_offset: string
}

/**
 * How many segments to cut at once. Hardware encoders (nvenc/qsv/amf) have spare
 * headroom, so we run more in parallel. libx264 already saturates the CPU, so we
 * keep the pool small to avoid oversubscription — the win there comes mainly from
 * overlapping the per-segment seek/decode/IO, not the encode itself.
 */
const segmentConcurrency = (encoder: EncoderConfig): number =>
  encoder.label.includes('GPU') ? 4 : 2

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline stages
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractResult { vClipPaths: string[]; aClipPaths: string[] }

/**
 * Cut every kept range into a frame-exact video clip and a sample-exact PCM
 * audio clip, on SEPARATE streams.
 *
 * CRITICAL (sync fix): cutting the main video WITH audio per segment and then
 * concatenating made the concat demuxer chain each segment by its (slightly
 * longer) AUDIO duration, padding the video timeline. Across ~70 segments this
 * dropped the effective frame rate (29.97 → ~29.90) so the main video drifted out
 * of sync with the webcam — which is cut video-only and stays at exactly 29.97.
 * We now cut video-only (frame-locked, identical to the webcam path) and audio-only
 * as PCM (no AAC priming, sample-exact concat), then mux them back together during
 * the final encode. This keeps the main video frame-locked to the webcam.
 *
 * Each segment's frame count is the single source of truth for its length: video
 * is cut to EXACTLY segFrames frames, audio to EXACTLY segFrames/fps seconds — so
 * the picture never drifts from the voice no matter how many segments there are.
 *
 * Segments run in a bounded-concurrency pool; within each segment the video and
 * audio cuts run together (audio is cheap, so it overlaps the video encode).
 */
const extractSegments = async (
  videoPath: string,
  ranges: EdlRange[],
  fps: Fps,
  encoder: EncoderConfig,
  clipsDir: string,
  onProgress: ProgressCallback | undefined,
  pctStart: number,
  pctEnd: number,
): Promise<ExtractResult> => {
  // Pre-assign deterministic paths so concat order matches timeline order,
  // regardless of which segment finishes first in the pool.
  const vClipPaths = ranges.map((_, i) => join(clipsDir, `v_${String(i).padStart(3, '0')}.mp4`))
  const aClipPaths = ranges.map((_, i) => join(clipsDir, `a_${String(i).padStart(3, '0')}.wav`))

  let done = 0
  await runPool(ranges, segmentConcurrency(encoder), async (r, i) => {
    const segFrames = Math.max(1, Math.round((r.end - r.start) * fps.value))
    const segDur = (segFrames * fps.den / fps.num).toFixed(6)

    await Promise.all([
      // Video-only — exactly segFrames frames, frame-locked to the webcam
      execFileAsync(getFFmpegPath(), [
        '-y',
        '-ss', String(r.start),
        '-i', videoPath,
        '-frames:v', String(segFrames),
        ...encoder.videoArgs,
        '-an',
        '-avoid_negative_ts', 'make_zero',
        vClipPaths[i],
      ]),
      // Audio-only PCM — exactly segDur seconds (apad covers any shortfall at EOF)
      execFileAsync(getFFmpegPath(), [
        '-y',
        '-ss', String(r.start),
        '-i', videoPath,
        '-t', segDur,
        '-af', 'apad',
        '-vn',
        '-c:a', 'pcm_s16le',
        aClipPaths[i],
      ]),
    ])

    done++
    const pct = pctStart + Math.round((done / ranges.length) * (pctEnd - pctStart))
    onProgress?.({ pct, message: `A extrair segmento ${done}/${ranges.length}…` })
  })

  return { vClipPaths, aClipPaths }
}

/** Concat the per-segment video clips and audio clips into single streams.
 *  Both concats are independent so they run together (stream copy — fast). */
const concatStreams = async (
  vClipPaths: string[],
  aClipPaths: string[],
  workDir: string,
): Promise<{ videoConcat: string; audioConcat: string }> => {
  const toListFile = (paths: string[]) =>
    paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')

  const vConcatList = join(workDir, 'vconcat.txt')
  const aConcatList = join(workDir, 'aconcat.txt')
  writeFileSync(vConcatList, toListFile(vClipPaths))
  writeFileSync(aConcatList, toListFile(aClipPaths))

  const videoConcat = join(workDir, 'video_concat.mp4')
  const audioConcat = join(workDir, 'audio_concat.wav')
  await Promise.all([
    execFileAsync(getFFmpegPath(), ['-y', '-f', 'concat', '-safe', '0', '-i', vConcatList, '-c', 'copy', videoConcat]),
    execFileAsync(getFFmpegPath(), ['-y', '-f', 'concat', '-safe', '0', '-i', aConcatList, '-c', 'copy', audioConcat]),
  ])

  return { videoConcat, audioConcat }
}

/** Pass 1 of loudnorm: measure the concatenated audio and return the fully
 *  parameterised pass-2 filter string (falls back to a generic filter if the
 *  measurement JSON can't be parsed). */
const measureLoudnorm = async (audioConcat: string): Promise<string> => {
  const GENERIC = 'loudnorm=I=-14:TP=-1:LRA=11'

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

  const match = measureOutput.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/)
  if (!match) return GENERIC
  try {
    const stats = JSON.parse(match[0]) as LoudnormStats
    return [
      'loudnorm=I=-14:TP=-1:LRA=11:linear=true',
      `measured_I=${stats.input_i}`,
      `measured_LRA=${stats.input_lra}`,
      `measured_TP=${stats.input_tp}`,
      `measured_thresh=${stats.input_thresh}`,
      `offset=${stats.target_offset}`,
    ].join(':')
  } catch {
    return GENERIC
  }
}

/**
 * Cut the webcam to frame-exact segments and concat to `outPath`.
 * Each webcam segment is cut to the SAME duration as the main video's frame-exact
 * segment (identical frame count when the cameras share a frame rate — the usual
 * case), keeping the webcam locked to the main video and therefore to the audio.
 * Re-encodes (NOT stream-copy) so cuts are frame-accurate; stream-copy snaps to
 * keyframes that differ between cameras and breaks sync. Cleans its own temp clips.
 */
const cutWebcam = async (
  webcamPath: string,
  ranges: EdlRange[],
  fps: Fps,
  encoder: EncoderConfig,
  workDir: string,
  syncOffsetSec: number,
  outPath: string,
  onProgress: ProgressCallback | undefined,
  basePct: number,
): Promise<void> => {
  const wcFps = await detectFps(webcamPath)
  console.log(`[render] webcam fps: ${wcFps.num}/${wcFps.den} (${wcFps.value.toFixed(4)})`)

  const wcClipsDir = join(workDir, 'wc_clips')
  mkdirSync(wcClipsDir, { recursive: true })
  const wcClipPaths = ranges.map((_, i) => join(wcClipsDir, `wc_${String(i).padStart(3, '0')}.mp4`))
  const wcConcatList = join(workDir, 'wcconcat.txt')

  try {
    let done = 0
    await runPool(ranges, segmentConcurrency(encoder), async (r, i) => {
      const wcStart = Math.max(0, r.start - syncOffsetSec)
      const segFrames = Math.max(1, Math.round((r.end - r.start) * fps.value))
      const segDur = segFrames * fps.den / fps.num
      const wcFrames = Math.max(1, Math.round(segDur * wcFps.value))

      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-ss', String(wcStart),
        '-i', webcamPath,
        '-frames:v', String(wcFrames),
        ...encoder.videoArgs,
        '-an',
        '-avoid_negative_ts', 'make_zero',
        wcClipPaths[i],
      ])

      done++
      onProgress?.({ pct: basePct + Math.round((done / ranges.length) * 12), message: `A cortar câmara ${done}/${ranges.length}…` })
    })

    writeFileSync(wcConcatList, wcClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
    await execFileAsync(getFFmpegPath(), [
      '-y', '-f', 'concat', '-safe', '0', '-i', wcConcatList, '-c', 'copy', outPath,
    ])
  } finally {
    try { wcClipPaths.forEach((f) => unlinkSync(f)) } catch { /* skip */ }
    try { unlinkSync(wcConcatList) } catch { /* skip */ }
    try { rmdirSync(wcClipsDir) } catch { /* skip */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export const renderVideo = async (
  videoPath: string,
  edlJSON: string,
  outputDir: string,
  onProgress?: ProgressCallback,
  webcamPath?: string,
  syncOffsetSec?: number,
  pipPosition?: PipPosition,
): Promise<RenderResult> => {

  // ── 0. Detect best encoder + source frame rate (frame-exact, drift-free cuts) ─
  const encoder = await detectEncoder()
  console.log(`[render] encoder: ${encoder.label}`)
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

  // Progress scale factors depend on whether we also have a webcam pass.
  // Main video occupies 5→68% (with webcam) or 5→75% (without).
  const hasWebcam = !!webcamPath
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
    // ── 3. Extract segments (video + audio on separate streams, in parallel) ──
    const { vClipPaths, aClipPaths } = await extractSegments(
      videoPath, ranges, fps, encoder, clipsDir, onProgress, 5, mainSegEnd,
    )

    // ── 4. Concat video and audio separately ──────────────────────────────────
    onProgress?.({ pct: mainSegEnd + 1, message: 'A juntar segmentos…' })
    const { videoConcat, audioConcat } = await concatStreams(vClipPaths, aClipPaths, workDir)

    // ── 5. Loudnorm pass 1 — measure on the concatenated audio ────────────────
    onProgress?.({ pct: mainConcEnd + 1, message: 'A normalizar áudio…' })
    const loudnormFilter = await measureLoudnorm(audioConcat)

    // ── 6. Final encode ───────────────────────────────────────────────────────
    let webcamOutputPath: string | undefined

    if (webcamPath && pipPosition) {
      // PiP mode: a SINGLE encode does overlay + loudnorm. Compositing the webcam
      // requires a video re-encode anyway, so we fold loudnorm and the audio mux
      // into the same pass instead of producing the main video and then re-encoding
      // the whole 4K file again just to overlay — saving one full encode.
      const webcamConcat = join(workDir, 'webcam_concat.mp4')
      await cutWebcam(webcamPath, ranges, fps, encoder, workDir, syncOffsetSec ?? 0, webcamConcat, onProgress, loudEnd1)

      onProgress?.({ pct: loudEnd1 + 14, message: 'A compor vídeo final…' })
      const overlayExpr: Record<PipPosition, string> = {
        'top-left': '20:20',
        'top-right': 'W-w-20:20',
        'bottom-left': '20:H-h-20',
        'bottom-right': 'W-w-20:H-h-20',
      }
      await execFileAsync(getFFmpegPath(), [
        '-y',
        '-i', videoConcat,    // [0] frame-locked main video
        '-i', webcamConcat,   // [1] frame-locked webcam
        '-i', audioConcat,    // [2] raw audio
        '-filter_complex',
        `[1:v]scale=iw/4:-2[pip];[0:v][pip]overlay=${overlayExpr[pipPosition]}[v];[2:a]${loudnormFilter}[a]`,
        '-map', '[v]', '-map', '[a]',
        ...encoder.videoArgs,
        '-c:a', 'aac', '-b:a', '192k',
        outputPath,
      ])
      console.log(`[render] PiP overlay folded into final encode — position: ${pipPosition}`)
    } else {
      // Standard mode: copy the frame-locked video (no encode) and loudnorm audio.
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

      // Two-file output: cut the webcam to its own separate file.
      if (webcamPath) {
        const wcBase = basename(webcamPath, extname(webcamPath))
        webcamOutputPath = join(outputDir, `${wcBase}_editado.mp4`)
        await cutWebcam(webcamPath, ranges, fps, encoder, workDir, syncOffsetSec ?? 0, webcamOutputPath, onProgress, loudEnd2)
      }
    }

    const totalDuration = ranges.reduce((sum, r) => sum + (r.end - r.start), 0)

    onProgress?.({ pct: 100, message: 'Concluído!' })

    return { outputPath, duration: totalDuration, segments: ranges.length, webcamOutputPath }

  } finally {
    // Best-effort cleanup — remove the whole working tree (files + dirs).
    try { rmSync(workDir, { recursive: true, force: true }) } catch { /* skip */ }
  }
}
