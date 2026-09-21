/**
 * tightenPauses.ts
 * Shorten every silence in the cut to at most a chosen length.
 *
 * Silence reaches the final video two ways, in roughly equal measure (measured on
 * a delivered 12-minute edit: 54 pauses at joins, 62 inside kept ranges):
 *   - at a join, from the padding kept after one range and before the next;
 *   - inside a range, where several sentences were kept together and the gaps
 *     between them survived intact.
 * Both are handled the same way here: every quiet stretch in a kept range is
 * shortened so that no silence in the output exceeds `maxPauseSec`. A join
 * combines the tail of one range with the head of the next, so each edge keeps
 * only half of the allowance and the two halves meet at `maxPauseSec`.
 *
 * Where the audio is quiet is read from the audio itself (see audioEnvelope.ts),
 * never from ASR word timestamps, which close words early and would clip them.
 * The transcript only guards against deleting a softly spoken word: a short
 * window around each recognised word's centre is treated as sound, so silence is
 * shortened around it but never across it.
 *
 * Pure function of its inputs.
 */

import type { EdlRange, ScribeWord } from '../../../src/renderer/src/types/electron'
import type { TimeInterval } from './retakeDetection'
import type { AudioEnvelope } from './audioEnvelope'
import { MIN_KEEP, subtractIntervals } from './refineEdl'

/**
 * How far over the cap a silence must be before it is worth splitting (s).
 *
 * Every interior split costs a permanent extra segment, and the renderer pays
 * ~2.9s of fixed ffmpeg cost per segment — so splitting a 0.16s pause to remove
 * 0.01s of video is a bad trade. Measured on two recordings at a 0.15s cap:
 * this margin skips 47 and 49 splits (about a quarter of all segments, minutes
 * of render) and the price is ~1s of extra silence across a 12-minute video,
 * with the longest surviving pause at 0.20s instead of 0.15s.
 *
 * Kept small deliberately: at +0.10s it would skip ~80 splits but let 0.25s
 * pauses through, and 0.25s is the length this feature exists to remove.
 */
const MIN_GAIN = 0.05

/**
 * Half-width of the window kept around a recognised word's centre (s).
 *
 * Bounded on purpose. The ASR sometimes reports absurd spans in silence — a
 * 3.68s "SPAD.", a one-letter "A" lasting 0.72s. Guarding a word's whole span, or
 * the whole quiet stretch holding its centre, let those phantoms freeze pauses of
 * up to 1.8s in place. A real word's core sits within this window of its centre.
 *
 * Measured at a 0.10s limit on two recordings: ±0.15s left 33–45 pauses over
 * 0.25s, ±0.08s left 15–27, ±0.05s left 11–16 — none of them losing a word.
 * ±0.08s keeps a 160ms core, enough for a syllable; narrower gains little more.
 */
const WORD_GUARD_SEC = 0.08

/** How far above the room's background noise a frame must be to count as sound. */
const ABOVE_FLOOR_DB = 9

/**
 * The level below which a frame counts as silence, for this recording.
 *
 * Measured relative to the room's background noise, not fixed and not relative
 * to the speech: what counts as a pause depends on how noisy the room is, not on
 * how loudly the speaker talks. A raw take is mostly pauses between attempts, so
 * its 10th percentile is the room tone.
 *
 * The margin is calibrated, and the count of audible pauses is steep around it:
 * on two recordings, pauses of 0.25s+ went from ~17 at +6 dB to ~125 at +9 dB —
 * the breaths and room noise a listener hears as a pause sit just below +9. The
 * same margin landed on the same point of that curve in both recordings, while a
 * speech-relative threshold drifted with the speaker's level. Going much higher
 * starts treating the decaying tail of words as silence.
 */
export const quietThreshold = (db: Float32Array): number => {
  const sorted = Float32Array.from(db).sort()
  return sorted[Math.floor((sorted.length - 1) * 0.10)] + ABOVE_FLOOR_DB
}

/** Frames around each recognised word's centre, which must never count as quiet. */
const guardedFrames = (words: ScribeWord[], env: AudioEnvelope): Uint8Array => {
  const guarded = new Uint8Array(env.db.length)
  for (const w of words) {
    if (w.type !== 'word') continue
    const centre = (w.start + w.end) / 2
    const reach = Math.min((w.end - w.start) / 2, WORD_GUARD_SEC)
    const from = Math.max(0, Math.floor((centre - reach) / env.frameSec))
    const to = Math.min(guarded.length, Math.ceil((centre + reach) / env.frameSec))
    guarded.fill(1, from, to)
  }
  return guarded
}

/** Quiet stretches inside [start, end), in seconds, clipped to that interval. */
const quietRuns = (
  env: AudioEnvelope, threshold: number, guarded: Uint8Array, start: number, end: number,
): Array<[number, number]> => {
  const { frameSec, db } = env
  const first = Math.max(0, Math.floor(start / frameSec))
  const last = Math.min(db.length, Math.ceil(end / frameSec))
  const runs: Array<[number, number]> = []
  let runStart = -1
  for (let f = first; f <= last; f++) {
    const quiet = f < last && db[f] < threshold && !guarded[f]
    if (quiet && runStart < 0) runStart = f
    if (!quiet && runStart >= 0) {
      runs.push([Math.max(start, runStart * frameSec), Math.min(end, f * frameSec)])
      runStart = -1
    }
  }
  return runs
}

/**
 * Shorten every silence in `ranges` to at most `maxPauseSec`.
 *
 * Expressed as deletions rather than as a walk that rebuilds the ranges: each
 * over-long quiet run contributes the slice of itself that must go, and the
 * ranges are then cut by those slices. A run at a range boundary keeps its
 * allowance only on the inside, because the silence on the other side belongs to
 * the neighbouring range — so the two halves meet at `maxPauseSec` across a join.
 */
export const tightenPauses = (
  ranges: EdlRange[],
  words: ScribeWord[],
  env: AudioEnvelope,
  maxPauseSec: number,
): EdlRange[] => {
  const threshold = quietThreshold(env.db)
  const guarded = guardedFrames(words, env)
  const half = maxPauseSec / 2
  const edge = env.frameSec   // tolerance for "this run touches the range boundary"

  const cuts: TimeInterval[] = []
  for (const r of ranges) {
    for (const [a, b] of quietRuns(env, threshold, guarded, r.start, r.end)) {
      // Keep half the allowance on each side that faces speech, none on a side
      // that faces the join. An interior run must also be over the cap by enough
      // to be worth the extra segment; an edge run only moves a boundary.
      const atStart = a <= r.start + edge
      const atEnd = b >= r.end - edge
      const need = atStart || atEnd ? half : maxPauseSec + MIN_GAIN
      if (b - a <= need) continue

      cuts.push({ start: atStart ? a : a + half, end: atEnd ? b : b - half })
    }
  }

  return subtractIntervals(ranges, cuts).filter(r => r.end - r.start >= MIN_KEEP)
}
