/**
 * refineRanges.ts
 * Turns Claude's coarse EDL ranges into tight, silence-trimmed cuts that ALWAYS
 * keep whole phrases — so a sentence is never cut off mid-word.
 *
 * Why phrase-based? Claude reasons over phrases (continuous-speech units split on
 * ≥0.5s silence). Its numeric range boundaries can land slightly inside a phrase,
 * which would drop the first/last word and make the sentence sound incomplete.
 * Working at phrase granularity removes that whole failure class:
 *
 *   1. Select the phrases Claude meant to keep (substantial overlap with a range).
 *   2. Group consecutive kept phrases whose gap is small (≤ KEEP_GAP) into one
 *      segment — preserving natural pauses; larger gaps stay cut (silence removed).
 *   3. Pad each segment ADAPTIVELY into the surrounding silence (never into a
 *      neighbouring phrase) to cover Deepgram's tight word timestamps.
 *
 * Deterministic and fast.
 */

import type { EdlRange, ScribeWord } from '../../../src/renderer/src/types/electron'
import { groupPhrases } from './phrases'

const KEEP_GAP = 0.6       // inter-phrase pause ≤ this is preserved; larger is cut ("Equilibrado")
const MIN_SEGMENT = 0.30   // discard segments shorter than this
const MAX_START_PAD = 0.12 // up to 120ms before a segment (covers word onsets)
const MAX_END_PAD = 0.28   // up to 280ms after a segment (covers trailing sounds/breath)
const EDGE_GUARD = 0.05    // always leave this much clean gap before the neighbouring phrase
const SELECT_RATIO = 0.5   // keep a phrase if ≥50% of it overlaps a Claude range…
const SELECT_ABS = 0.8     // …or if ≥0.8s of it does (covers very long phrases)

export const refineRanges = (ranges: EdlRange[], words: ScribeWord[]): EdlRange[] => {
  const phrases = groupPhrases(words)
  if (phrases.length === 0) return ranges

  // Time bounds of each phrase
  const bounds = phrases.map(p => ({ start: p[0].start, end: p[p.length - 1].end }))

  // ── 1. Select which phrases Claude meant to keep ────────────────────────────
  const keep = new Set<number>()
  const passthrough: EdlRange[] = [] // ranges with no phrase overlap (music/action)

  for (const range of ranges) {
    if (range.start < 0 || range.end <= range.start) continue // skip sentinel/inverted

    let matched = false
    for (let i = 0; i < bounds.length; i++) {
      const overlap = Math.min(range.end, bounds[i].end) - Math.max(range.start, bounds[i].start)
      if (overlap <= 0) continue
      const dur = bounds[i].end - bounds[i].start
      if (overlap >= SELECT_ABS || overlap >= SELECT_RATIO * dur) {
        keep.add(i)
        matched = true
      }
    }
    if (!matched) passthrough.push(range)
  }

  if (keep.size === 0) return ranges // nothing matched — fall back to Claude's raw ranges

  // ── 2. Group consecutive kept phrases separated by a small pause ────────────
  const keptIdx = [...keep].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const i of keptIdx) {
    const last = groups[groups.length - 1]
    if (last) {
      const prev = last[last.length - 1]
      if (i === prev + 1 && bounds[i].start - bounds[prev].end <= KEEP_GAP) {
        last.push(i)
        continue
      }
    }
    groups.push([i])
  }

  // ── 3. Build adaptively-padded segments ─────────────────────────────────────
  const refined: EdlRange[] = [...passthrough]

  for (const group of groups) {
    const fi = group[0]
    const li = group[group.length - 1]
    const first = bounds[fi]
    const last = bounds[li]

    // Available silence on each side = up to the neighbouring phrase
    const prevEnd = fi > 0 ? bounds[fi - 1].end : 0
    const nextStart = li < bounds.length - 1 ? bounds[li + 1].start : Infinity

    let start = Math.max(first.start - MAX_START_PAD, prevEnd + EDGE_GUARD)
    let end = Math.min(last.end + MAX_END_PAD, nextStart - EDGE_GUARD)

    // Never clip the phrase itself, even if neighbours are very close
    start = Math.max(0, Math.min(start, first.start))
    end = Math.max(end, last.end)

    if (end - start >= MIN_SEGMENT) refined.push({ start, end })
  }

  // ── 4. Merge only on true overlap (keeps inter-group silence trimmed) ───────
  refined.sort((a, b) => a.start - b.start)
  const merged: EdlRange[] = []
  for (const seg of refined) {
    const prev = merged[merged.length - 1]
    if (prev && seg.start <= prev.end) prev.end = Math.max(prev.end, seg.end)
    else merged.push({ ...seg })
  }

  return merged.length > 0 ? merged : ranges
}
