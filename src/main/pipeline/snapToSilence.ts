/**
 * snapToSilence.ts
 * Snaps EDL cut boundaries to REAL audio silence so a cut never lands mid-word.
 *
 * Why this exists: every boundary so far was derived from Deepgram word
 * timestamps, which are approximate — a word's audio often spills past its
 * reported [start, end]. That makes cuts clip word onsets/tails ("GPU" → "G")
 * or even drop boundary words. Word timestamps can't be trusted for the exact
 * cut point, so we use the audio itself as ground truth.
 *
 * For each range, if a boundary sits inside SPEECH we extend it OUTWARD to the
 * nearest real silence (within a cap). We only ever extend — never trim — so a
 * word can never be lost; at worst a few hundred ms of extra air is kept.
 *
 * Best-effort: if silencedetect yields nothing or fails, ranges pass through.
 */

import { execFile } from 'child_process'
import type { EdlRange } from '../../../src/renderer/src/types/electron'

const NOISE_DB = -30   // level below which audio counts as silence
const MIN_SIL = 0.10   // minimum silence length to register (seconds)
// Forward (end) snap can be generous — it rescued clipped word tails ("GPU"→"G").
const MAX_FWD_SNAP = 0.75
// Backward (start) snap is small: just enough to polish a clipped onset. Kept
// small so it can never undo an intra-phrase repeat trim (which moves the start
// later by a whole repeated block).
const MAX_BACK_SNAP = 0.20
const LEAD = 0.08      // air kept before speech when snapping a start
const TRAIL = 0.12     // air kept after speech when snapping an end

interface Silence { start: number; end: number }

const detectSilence = (ffmpeg: string, videoPath: string): Promise<Silence[]> =>
  new Promise((resolve) => {
    let stderr = ''
    const ff = execFile(ffmpeg, [
      '-i', videoPath,
      '-vn', // audio only — far faster, no video decode
      '-af', `silencedetect=noise=${NOISE_DB}dB:d=${MIN_SIL}`,
      '-f', 'null', '-',
    ])
    ff.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    ff.on('error', () => resolve([]))
    ff.on('close', () => {
      const silences: Silence[] = []
      let curStart: number | null = null
      for (const line of stderr.split('\n')) {
        const s = line.match(/silence_start:\s*(-?[\d.]+)/)
        const e = line.match(/silence_end:\s*(-?[\d.]+)/)
        if (s) curStart = parseFloat(s[1])
        else if (e && curStart !== null) {
          silences.push({ start: curStart, end: parseFloat(e[1]) })
          curStart = null
        }
      }
      resolve(silences)
    })
  })

const inSilence = (t: number, sils: Silence[]): boolean =>
  sils.some(s => t >= s.start && t <= s.end)

export const snapToSilence = async (
  ranges: EdlRange[],
  videoPath: string,
  ffmpeg: string,
): Promise<EdlRange[]> => {
  try {
    const sils = await detectSilence(ffmpeg, videoPath)
    if (sils.length === 0) return ranges

    let snaps = 0
    const out = ranges.map((r) => {
      let { start, end } = r

      // START in speech → nudge back to the nearest preceding silence (small)
      if (!inSilence(start, sils)) {
        let best: Silence | null = null
        for (const s of sils) {
          if (s.end <= start && start - s.end <= MAX_BACK_SNAP && (!best || s.end > best.end)) best = s
        }
        if (best) { start = Math.max(best.start, best.end - LEAD); snaps++ }
      }

      // END in speech → move forward to the nearest following silence
      if (!inSilence(end, sils)) {
        let best: Silence | null = null
        for (const s of sils) {
          if (s.start >= end && s.start - end <= MAX_FWD_SNAP && (!best || s.start < best.start)) best = s
        }
        if (best) { end = Math.min(best.end, best.start + TRAIL); snaps++ }
      }

      // Outward-only guarantee: never lose any of the original span
      return { ...r, start: Math.max(0, Math.min(start, r.start)), end: Math.max(end, r.end) }
    })

    // Merge overlaps created by snapping
    out.sort((a, b) => a.start - b.start)
    const merged: EdlRange[] = []
    for (const seg of out) {
      const prev = merged[merged.length - 1]
      if (prev && seg.start <= prev.end) prev.end = Math.max(prev.end, seg.end)
      else merged.push({ ...seg })
    }

    console.log(`[snapToSilence] ${sils.length} silences detected, snapped ${snaps} boundary(ies)`)
    return merged
  } catch (err) {
    console.warn('[snapToSilence] skipped:', err instanceof Error ? err.message : err)
    return ranges
  }
}
