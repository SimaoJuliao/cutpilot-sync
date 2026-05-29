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

import { execFile }                                                       from 'child_process'
import { promisify }                                                      from 'util'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync }  from 'fs'
import { join, basename, extname }                                        from 'path'
import { tmpdir }                                                         from 'os'
import type { EdlRange, RenderResult, RenderProgress }                    from '../../../src/renderer/src/types/electron'

const execFileAsync = promisify(execFile)

type ProgressCallback = (progress: RenderProgress) => void

interface LoudnormStats {
  input_i:       string
  input_lra:     string
  input_tp:      string
  input_thresh:  string
  target_offset: string
}

export const renderVideo = async (
  videoPath:   string,
  edlJSON:     string,
  outputDir:   string,
  onProgress?: ProgressCallback,
): Promise<RenderResult> => {

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

  onProgress?.({ pct: 5, message: `${ranges.length} segmentos identificados` })

  // ── 2. Working dirs ───────────────────────────────────────────────────────
  const workDir   = join(tmpdir(), `vea_render_${Date.now()}`)
  const clipsDir  = join(workDir, 'clips')
  mkdirSync(clipsDir, { recursive: true })

  const baseName   = basename(videoPath, extname(videoPath))
  const outputPath = join(outputDir, `${baseName}_editado.mp4`)

  try {
    // ── 3. Extract segments ─────────────────────────────────────────────────
    const clipPaths: string[] = []

    for (let i = 0; i < ranges.length; i++) {
      const r    = ranges[i]
      const clip = join(clipsDir, `seg_${String(i).padStart(3, '0')}.mp4`)
      clipPaths.push(clip)

      const pct = 5 + Math.round((i / ranges.length) * 70)
      onProgress?.({ pct, message: `A extrair segmento ${i + 1}/${ranges.length}…` })

      await execFileAsync('ffmpeg', [
        '-y',
        '-ss', String(r.start),
        '-to', String(r.end),
        '-i',   videoPath,
        '-c:v', 'libx264', '-crf', '22', '-preset', 'medium',
        '-c:a', 'aac',     '-b:a', '192k',
        '-avoid_negative_ts', 'make_zero',
        clip,
      ])
    }

    // ── 4. Concat ────────────────────────────────────────────────────────────
    onProgress?.({ pct: 77, message: 'A juntar segmentos…' })
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
    onProgress?.({ pct: 85, message: 'A normalizar áudio…' })

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
    onProgress?.({ pct: 92, message: 'A aplicar loudnorm…' })
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', concatOut,
      '-c:v', 'copy',
      '-af', loudnormFilter,
      '-c:a', 'aac', '-b:a', '192k',
      outputPath,
    ])

    const totalDuration = ranges.reduce((sum, r) => sum + (r.end - r.start), 0)
    onProgress?.({ pct: 100, message: 'Concluído!' })

    return { outputPath, duration: totalDuration, segments: ranges.length }

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
