/**
 * refineEdl.ts
 * Deterministic post-processing of Claude's EDL.
 *
 * Claude PROPOSES the keep-ranges (editorial judgment); this layer DISPOSES of
 * what it can't be trusted to do reliably:
 *
 *   1. Retake chains — for every chain Claude touched (kept ANY take of), force
 *      the output to contain the chain's KEEPER (the fullest/last take) and
 *      remove the other takes. This fixes both failure modes: Claude keeping a
 *      botched take, AND Claude cutting the good take while keeping a botched
 *      one (which would otherwise leave the topic truncated or missing).
 *      Chains Claude cut entirely are left alone (intentional removal).
 *
 *   2. Dead air — split kept ranges at internal silences longer than MAX_SILENCE
 *      and trim each run to the speech it contains (drops pure-silence fragments
 *      and long pauses Claude left between takes).
 *
 * Operating on TIME (not text) guarantees the result regardless of how Claude
 * built its ranges. Detection is shared with buildPrompt.
 */

import type { EdlRange, Transcript } from '../../../src/renderer/src/types/electron'
import { detectRetakeChainSpans, type TimeInterval } from './retakeDetection'

const MIN_KEEP = 0.15    // drop fragments shorter than this after surgery (s)
const MAX_SILENCE = 2.0  // gaps longer than this are dead air → split/trim (s)
const PAD = 0.12         // natural breath kept around each speech run (s)

const duration = (rs: EdlRange[]): number => rs.reduce((s, r) => s + (r.end - r.start), 0)
const overlapsAny = (span: TimeInterval, ranges: EdlRange[]): boolean =>
  ranges.some(r => r.start < span.end && r.end > span.start)

/** Remove every cut interval from the ranges, splitting ranges as needed. */
const subtractIntervals = (ranges: EdlRange[], cuts: TimeInterval[]): EdlRange[] => {
  let result = ranges.map(r => ({ ...r }))
  for (const cut of cuts) {
    const next: EdlRange[] = []
    for (const r of result) {
      if (cut.end <= r.start || cut.start >= r.end) { next.push(r); continue } // no overlap
      if (cut.start > r.start) next.push({ ...r, end: cut.start })             // keep head
      if (cut.end < r.end) next.push({ ...r, start: cut.end })                 // keep tail
    }
    result = next
  }
  return result
}

/** Sort by start and merge overlapping ranges (dedupes a re-added keeper). */
const mergeOverlapping = (ranges: EdlRange[]): EdlRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: EdlRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

/**
 * Clamp each range to the actual speech it contains:
 *   - a range with NO words is dropped (pure-silence fragment);
 *   - internal gaps longer than MAX_SILENCE split the range into speech runs;
 *   - each run is tightened to [firstWord − PAD, lastWord + PAD].
 */
const clampToSpeech = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  const words = transcript.words.filter(w => w.type === 'word').sort((a, b) => a.start - b.start)
  const out: EdlRange[] = []

  for (const r of ranges) {
    const inside = words.filter(w => w.end > r.start && w.start < r.end)
    if (inside.length === 0) continue // pure silence → drop

    let runStart = 0
    for (let i = 1; i <= inside.length; i++) {
      const gap = i < inside.length ? inside[i].start - inside[i - 1].end : Infinity
      if (gap > MAX_SILENCE) {
        const first = inside[runStart]
        const last = inside[i - 1]
        out.push({
          ...r,
          start: Math.max(r.start, first.start - PAD),
          end: Math.min(r.end, last.end + PAD),
        })
        runStart = i
      }
    }
  }
  return out
}

/**
 * Apply deterministic retake enforcement + dead-air trimming to Claude's EDL.
 * Pure function of (ranges, transcript) — no side effects.
 */
export const refineEdl = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  if (ranges.length === 0) return ranges

  const chains = detectRetakeChainSpans(transcript)

  // Only act on chains Claude actually included (kept ANY take of) — leave
  // topics Claude deliberately cut alone.
  const active = chains.filter(ch => overlapsAny(ch.topic, ranges))
  const cuts = active.flatMap(ch => ch.cuts)
  const keepers = active
    .map(ch => ch.keeper)
    .filter((k): k is TimeInterval => k !== null)
    .map(k => ({ start: k.start, end: k.end, label: 'retake-keeper' }))

  // 1. Remove the botched takes, then 2. guarantee each keeper is present.
  const enforced = mergeOverlapping([...subtractIntervals(ranges, cuts), ...keepers])
  // 3. Trim dead air / drop silence fragments.
  const refined = mergeOverlapping(clampToSpeech(enforced, transcript))
    .filter(r => r.end - r.start >= MIN_KEEP)

  const keepersAdded = active.filter(ch => ch.keeper && !overlapsAny(ch.keeper, ranges)).length
  console.log(
    `[refineEdl] ranges ${ranges.length}→${refined.length} | ` +
    `active chains ${active.length}/${chains.length} | keepers restored ${keepersAdded} | ` +
    `kept ${duration(ranges).toFixed(1)}s→${duration(refined).toFixed(1)}s`
  )

  return refined
}
